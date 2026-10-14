const express = require('express');
const mongoose = require('mongoose');
const Turnaround = require('../models/Turnaround');
const Lir = require('../models/Lir');
const requireUser = require('../middleware/requireUser');
const validate = require('../services/lirValidation');
const addSystemMessage = require('../services/systemMessage');
const router = express.Router();
router.use(requireUser);
router.use((req,res,next) => {
  req.lirPermissions = validate.permissions(req.user);
  if (!req.lirPermissions.view) return res.status(403).json({ error:'LIR access is limited to OPS and RAMP' });
  res.set('Cache-Control','no-store');
  next();
});
router.use(express.json({ limit:'8mb' }));
router.param('flightId', async (req,res,next,id) => {
  if (!mongoose.isObjectIdOrHexString(id)) return res.status(400).json({ error:'Invalid flight' });
  const flight = await Turnaround.findById(id);
  if (!flight || flight.deleted) return res.status(404).json({ error:'Flight not found' });
  req.flight = flight;
  next();
});
router.param('documentId', (req,res,next,id) => {
  if (!mongoose.isObjectIdOrHexString(id)) return res.status(400).json({ error:'Invalid LIR' });
  next();
});
const latest = flightId => Lir.findOne({ turnaroundId:flightId }).sort({ revision:-1 });
async function notify(req, doc, message) {
  require("../services/lirLive").clearFlight(req.app.get("io"), req.flight._id);
  // Save success must remain success even if the optional chat notification fails.
  try { await addSystemMessage(req, req.flight._id, message); }
  catch (error) { console.error('LIR notification failed:', error.message); }
  req.app.get('io').to(String(req.flight._id)).emit('lirUpdated', { revision:doc.revision, status:doc.status });
}
router.get('/:flightId', async (req,res) => {
  const revisions = await Lir.find({ turnaroundId:req.flight._id })
    .select('-annotations -signature').sort({ revision:-1 });
  const doc = revisions.length ? await Lir.findById(revisions[0]._id) : null;
  res.json({ flight:{ id:req.flight._id, display:req.flight.flightNumberDisplay || `${req.flight.arrivalFlight}/${req.flight.departureFlight}`, operatingDate:req.flight.operatingDate },
    permissions:req.lirPermissions, sequence:req.flight.lirSequence || 0, document:doc, revisions });
});
router.get('/:flightId/:documentId', async (req,res) => {
  const doc = await Lir.findOne({ _id:req.params.documentId, turnaroundId:req.flight._id });
  if (!doc) return res.status(404).json({ error:'LIR not found' });
  res.json(doc);
});
router.get('/:flightId/:documentId/source', async (req,res) => {
  const doc = await Lir.findOne({ _id:req.params.documentId, turnaroundId:req.flight._id }).select('+original');
  if (!doc) return res.status(404).json({ error:'LIR not found' });
  res.set('X-Content-Type-Options','nosniff');
  res.set('Content-Disposition', `attachment; filename="${doc.filename}"`);
  res.type(doc.kind === 'pdf' ? 'application/pdf' : 'text/plain; charset=utf-8').send(doc.original);
});
router.post('/:flightId', async (req,res) => {
  if (!req.lirPermissions.upload) return res.status(403).json({ error:'Only OPS can upload a LIR' });
  let source;
  try { source = validate.source(req.body); }
  catch (error) { return res.status(400).json({ error:error.message }); }
  const expected = req.body.expectedSequence;
  const filter = { _id:req.flight._id, deleted:{ $ne:true } };
  if (expected === 0) filter.$or = [{ lirSequence:0 }, { lirSequence:{ $exists:false } }];
  else filter.lirSequence = expected;
  const flight = await Turnaround.findOneAndUpdate(filter, { $inc:{ lirSequence:1 } }, { new:true });
  if (!flight) return res.status(409).json({ error:'Another upload changed this flight. Refresh before uploading again.' });
  const doc = await Lir.create({ ...source, turnaroundId:flight._id, revision:flight.lirSequence,
    uploadedBy:req.user._id, uploadedByName:req.user.name });
  await notify(req, doc, `LIR v${doc.revision} uploaded by OPS — ready for RAMP`);
  res.status(201).json({ document:await Lir.findById(doc._id), sequence:flight.lirSequence });
});
router.put('/:flightId/:documentId/annotations', async (req,res) => {
  if (!req.lirPermissions.annotate) return res.status(403).json({ error:'Only RAMP can annotate a LIR' });
  let data;
  try { data = validate.annotations(req.body); }
  catch (error) { return res.status(400).json({ error:error.message }); }
  const current = await latest(req.flight._id);
  if (!current || String(current._id) !== req.params.documentId || current.status === 'COMPLETED') {
    return res.status(409).json({ error:'This LIR is superseded or completed. Refresh to view the latest version.' });
  }
  const update = { ...data, status:req.body.complete ? 'COMPLETED' : 'IN_PROGRESS',
    updatedBy:req.user._id, updatedByName:req.user.name };
  if (req.body.complete) Object.assign(update, { signedBy:req.user._id, signedByName:req.user.name, signedAt:new Date() });
  const doc = await Lir.findOneAndUpdate({ _id:current._id, turnaroundId:req.flight._id,
    annotationVersion:req.body.expectedVersion, status:{ $ne:'COMPLETED' } },
    { $set:update, $inc:{ annotationVersion:1 } }, { new:true, runValidators:true });
  if (!doc) return res.status(409).json({ error:'Another operator saved changes. Your local work is still open; refresh before editing again.' });
  await notify(req, doc, req.body.complete ? `LIR v${doc.revision} signed and completed by RAMP` : `LIR v${doc.revision} annotations saved by RAMP`);
  res.json(doc);
});
router.use((error,req,res,next) => {
  if (error.type === 'entity.too.large') return res.status(413).json({ error:'LIR upload is too large (5 MB document limit)' });
  if (error instanceof SyntaxError && error.status === 400) return res.status(400).json({ error:'Invalid JSON' });
  console.error('LIR request failed:',error.message);
  res.status(500).json({ error:'LIR could not be saved or loaded. Please refresh and try again.' });
});
module.exports = router;
