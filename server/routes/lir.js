const express = require('express');
const mongoose = require('mongoose');
const Turnaround = require('../models/Turnaround');
const Lir = require('../models/Lir');
const Checklist=require('../models/LirChecklist');
const requireUser = require('../middleware/requireUser');
const validate = require('../services/lirValidation');
const canAnnotate = require('../services/lirAccess');
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
router.get('/:flightId/access', async (req,res) => {
  res.json({ user:{id:req.user._id,name:req.user.name}, permissions:{ ...req.lirPermissions, annotate:await canAnnotate(req.user,req.flight._id) } });
});
router.get('/:flightId', async (req,res) => {
  req.lirPermissions.annotate = await canAnnotate(req.user, req.flight._id);
  const revisions = await Lir.find({ turnaroundId:req.flight._id })
    .select('-annotations -signature').sort({ revision:-1 });
  const doc = revisions.length ? await Lir.findById(revisions[0]._id) : null;
  res.json({ flight:{ id:req.flight._id, display:req.flight.flightNumberDisplay || `${req.flight.arrivalFlight}/${req.flight.departureFlight}`, operatingDate:req.flight.operatingDate },
    permissions:req.lirPermissions, sequence:req.flight.lirSequence || 0, document:doc, revisions });
});
router.get('/:flightId/checklist',async(req,res)=>{
 const doc=await latest(req.flight._id);if(!doc)return res.status(404).json({error:'No LIR'});
 const saved=await Checklist.findOne({turnaroundId:req.flight._id,lirId:doc._id}).lean();
 const ramp=await canAnnotate(req.user,req.flight._id);
 const assigned=await require('../models/Assignment').find({turnaroundId:req.flight._id,role:'RAMP'}).select('userId').lean();
 const reason=ramp?'':!req.user.active?'Your account is inactive':req.user.department!=='RAMP'?'This account is not in the RAMP department':assigned.length!==1?'Departure RAMP assignment is missing or ambiguous':String(assigned[0].userId)!==String(req.user._id)?'Another agent is assigned to Departure RAMP':'RAMP confirmation is unavailable';
 res.json({checklist:saved,permissions:{publish:req.lirPermissions.upload,confirm:ramp,confirmReason:reason},revision:doc.revision});
});
router.put('/:flightId/checklist/draft',async(req,res)=>{
 if(!req.lirPermissions.upload)return res.status(403).json({error:'OPS only'});
 const doc=await latest(req.flight._id);if(!doc||doc.kind!=='text')return res.status(400).json({error:'Text LIR required'});
 const existing=await Checklist.findOne({turnaroundId:req.flight._id});
 if(existing?.published&&String(existing.lirId)===String(doc._id))return res.status(409).json({error:'Published checklist cannot be edited as a draft'});
 const source=await Lir.findById(doc._id).select('+original');
 const raw=source.original.toString('utf8');
 if(!raw.includes('LOADING INSTRUCTION/REPORT')||!raw.includes(' TK '))return res.status(400).json({error:'Unsupported LIR format'});
 const parsed=require('../services/tkLirParser').parse(raw);
 const input=req.body.rows;
 if(!Array.isArray(input)||input.length!==parsed.rows.length)return res.status(400).json({error:'All parsed positions must be reviewed'});
 const rows=parsed.rows.map((row,i)=>{
  const edit=input[i];
  if(!edit||edit.position!==row.position)throw new Error('Position order changed');
  const plannedUld=String(edit.plannedUld||'').trim().toUpperCase();
  if(plannedUld&&!/^[A-Z]{3}[A-Z0-9]{5,12}$/.test(plannedUld))throw new Error('Invalid ULD at '+row.position);
  const load=String(edit.load||'').trim().toUpperCase();
  if(load.length>120)throw new Error('Load text too long');
  return {...row,plannedUld,load:[{type:'REVIEWED',value:load}],needsReview:!edit.reviewed,reviewed:!!edit.reviewed};
 });
 const result=await Checklist.findOneAndUpdate({turnaroundId:req.flight._id,published:{$ne:true}},{$set:{lirId:doc._id,revision:doc.revision,published:false,rows,version:0}},{upsert:true,new:true,runValidators:true});
 res.json({checklist:result});
});
router.post('/:flightId/checklist/publish',async(req,res)=>{
 if(!req.lirPermissions.upload)return res.status(403).json({error:'OPS only'});
 const doc=await latest(req.flight._id);if(!doc)return res.status(404).json({error:'No LIR'});
 const checklist=await Checklist.findOne({turnaroundId:req.flight._id,lirId:doc._id,published:false});
 if(!checklist||!checklist.rows.length||checklist.rows.some(row=>row.needsReview||!row.reviewed))return res.status(422).json({error:'Save and review every position before publishing'});
 checklist.published=true;checklist.publishedAt=new Date();checklist.publishedBy=req.user.name;
 await checklist.save();
 req.app.get('io').to(String(req.flight._id)).emit('lirChecklistUpdated',{revision:doc.revision});
 res.json({checklist});
});
router.put('/:flightId/checklist/:position',async(req,res)=>{
 if(!await canAnnotate(req.user,req.flight._id))return res.status(403).json({error:'Assigned RAMP only'});
 const doc=await latest(req.flight._id);if(!doc||doc.status==='COMPLETED')return res.status(409).json({error:'LIR completed or unavailable'});
 const position=String(req.params.position).toUpperCase();
 const actualPosition=String(req.body.actualPosition||'').trim().toUpperCase();
 const actualUld=String(req.body.actualUld||'').trim().toUpperCase();
 const bags=req.body.bags;
 if(!/^[0-9]{2}[LPR]?$/.test(position)||! /^[0-9]{2}[LPR]?$/.test(actualPosition)||! /^[A-Z]{3}[A-Z0-9]{5,12}$/.test(actualUld))return res.status(400).json({error:'Valid position and ULD number required'});
 if(bags!==null&&bags!==undefined&&(!Number.isInteger(bags)||bags<0||bags>999))return res.status(400).json({error:'Invalid bag count'});
 if(!Number.isInteger(req.body.expectedVersion))return res.status(400).json({error:'Refresh checklist before confirming'});
 const checklist=await Checklist.findOne({turnaroundId:req.flight._id,lirId:doc._id,published:true,version:req.body.expectedVersion,'rows.position':position});
 if(!checklist)return res.status(409).json({error:'Checklist changed; refresh'});
 const row=checklist.rows.find(r=>r.position===position);
 if(row.plannedUld&&row.plannedUld!==actualUld||position!==actualPosition){row.discrepancy=true;}else row.discrepancy=false;
 row.actualPosition=actualPosition;row.actualUld=actualUld;row.bags=bags??null;row.confirmedAt=new Date();row.confirmedBy=req.user.name;
 const result=await Checklist.findOneAndUpdate({_id:checklist._id,version:req.body.expectedVersion},{ $set:{rows:checklist.rows},$inc:{version:1}},{new:true,runValidators:true});
 if(!result)return res.status(409).json({error:'Another update occurred; refresh'});
 req.app.get('io').to(String(req.flight._id)).emit('lirChecklistUpdated',{revision:doc.revision});
 res.json({checklist:result});
});

const LoadingChange=require('../models/LirLoadingChange');
const validUld=value=>/^[A-Z]{3}[A-Z0-9]{5,12}$/.test(value);
router.get('/:flightId/checklist/changes',async(req,res)=>{
 const doc=await latest(req.flight._id);
 if(!doc)return res.json({changes:[],latestRevision:null,otherRevisionCount:0});
 const changes=await LoadingChange.find({turnaroundId:req.flight._id,lirId:doc._id}).sort({requestedAt:-1}).limit(100).lean();
 const otherRevisionCount=await LoadingChange.countDocuments({turnaroundId:req.flight._id,lirId:{$ne:doc._id}});
 res.json({changes,latestRevision:doc.revision,otherRevisionCount});
});
router.post('/:flightId/checklist/changes',async(req,res)=>{
 if(!await canAnnotate(req.user,req.flight._id))return res.status(403).json({error:'Assigned Departure RAMP only'});
 const doc=await latest(req.flight._id);
 if(!doc||doc.status==='COMPLETED')return res.status(409).json({error:'LIR is completed or unavailable'});
 const c=await Checklist.findOne({turnaroundId:req.flight._id,lirId:doc._id,published:true});
 if(!c)return res.status(409).json({error:'Published checklist required'});
 const action=String(req.body.action||'').toUpperCase(),from=String(req.body.from||'').toUpperCase(),to=String(req.body.to||'').toUpperCase();
 const replacementUld=String(req.body.replacementUld||'').trim().toUpperCase();
 const reason=String(req.body.reason||'').trim().slice(0,300);
 const source=c.rows.find(r=>r.position===from),target=c.rows.find(r=>r.position===to);
 if(!['SWAP','MOVE','REPLACE'].includes(action)||!source||!reason)return res.status(400).json({error:'Action, source and reason required'});
 if(action!=='REPLACE'&&(!target||to===from))return res.status(400).json({error:'Select a different existing destination position'});
 if(action==='REPLACE'&&!validUld(replacementUld))return res.status(400).json({error:'Valid replacement ULD required'});
 if(!source.actualUld&&!source.plannedUld)return res.status(422).json({error:'Source has no ULD'});
 if(action==='SWAP'&&!target.actualUld&&!target.plannedUld)return res.status(422).json({error:'Swap requires two ULDs'});
 if(action==='MOVE'&&(target.actualUld||target.plannedUld||target.confirmedAt))return res.status(422).json({error:'Destination is occupied; use Swap'});
 const affected=action==='REPLACE'?[from]:[from,to];
 const pending=await LoadingChange.exists({turnaroundId:req.flight._id,lirId:doc._id,status:{$in:['REQUESTED','AUTHORISED']},$or:[{from:{$in:affected}},{to:{$in:affected}}]});
 if(pending)return res.status(409).json({error:'A loading change is already open for one of these positions'});
 const change=await LoadingChange.create({turnaroundId:req.flight._id,lirId:doc._id,action,from,to:action==='REPLACE'?undefined:to,replacementUld:action==='REPLACE'?replacementUld:undefined,reason,requestedBy:req.user.name});
 try { await addSystemMessage(req,req.flight._id,`⚠ LOADING CHANGE REQUESTED — ${action} ${from}${to?' → '+to:''}${replacementUld?' / '+replacementUld:''} — ${reason} — requested by ${req.user.name}. OPS: review in eLIR Loading Checklist.`); } catch(error){console.error('Loading change notification failed:',error.message);}
 req.app.get('io').to(String(req.flight._id)).emit('lirChecklistUpdated',{revision:doc.revision});
 res.status(201).json({change});
});
router.post('/:flightId/checklist/changes/:changeId/review',async(req,res)=>{
 if(!req.lirPermissions.upload)return res.status(403).json({error:'OPS only'});
 const doc=await latest(req.flight._id);
 if(!doc||doc.status==='COMPLETED')return res.status(409).json({error:'LIR completed or unavailable'});
 const decision=String(req.body.decision||'').toUpperCase();
 if(!['AUTHORISED','REJECTED'].includes(decision))return res.status(400).json({error:'Invalid decision'});
 const change=await LoadingChange.findOneAndUpdate({_id:req.params.changeId,turnaroundId:req.flight._id,lirId:doc._id,status:'REQUESTED'},{$set:{status:decision,reviewedBy:req.user.name,reviewedAt:new Date()}},{new:true});
 if(!change)return res.status(409).json({error:'Change no longer pending; refresh'});
 req.app.get('io').to(String(req.flight._id)).emit('lirChecklistUpdated',{revision:doc.revision});
 res.json({change});
});
router.post('/:flightId/checklist/changes/:changeId/execute',async(req,res)=>{
 if(!await canAnnotate(req.user,req.flight._id))return res.status(403).json({error:'Assigned Departure RAMP only'});
 const doc=await latest(req.flight._id);
 if(!doc||doc.status==='COMPLETED')return res.status(409).json({error:'LIR completed or unavailable'});
 const change=await LoadingChange.findOne({_id:req.params.changeId,turnaroundId:req.flight._id,lirId:doc._id,status:'AUTHORISED'});
 if(!change)return res.status(409).json({error:'Change is not authorised or is already executed'});
 const c=await Checklist.findOne({turnaroundId:req.flight._id,lirId:doc._id,published:true});
 if(!c||c.version!==req.body.expectedVersion)return res.status(409).json({error:'Checklist changed; refresh before executing'});
 const from=c.rows.find(r=>r.position===change.from),to=c.rows.find(r=>r.position===change.to);
 if(!from||(change.action!=='REPLACE'&&!to))return res.status(409).json({error:'Positions no longer available'});
 const sourceUld=from.actualUld||from.plannedUld||'',destUld=to&&(to.actualUld||to.plannedUld||'');
 if(!sourceUld)return res.status(409).json({error:'Source ULD missing'});
 if(change.action==='SWAP'&&!destUld)return res.status(409).json({error:'Swap destination ULD missing'});
 if(change.action==='MOVE'&&destUld)return res.status(409).json({error:'Move destination occupied'});
 if(change.action==='REPLACE'){from.actualUld=change.replacementUld;from.actualPosition=from.position;}
 if(change.action==='SWAP'){from.actualUld=destUld;to.actualUld=sourceUld;from.actualPosition=from.position;to.actualPosition=to.position;}
 if(change.action==='MOVE'){from.actualUld='';from.actualPosition=from.position;to.actualUld=sourceUld;to.actualPosition=to.position;}
 for(const row of [from,...(to?[to]:[])]){row.confirmedAt=undefined;row.confirmedBy=undefined;row.discrepancy=true;row.bags=undefined;}
 const result=await Checklist.findOneAndUpdate({_id:c._id,version:c.version},{$set:{rows:c.rows},$inc:{version:1}},{new:true,runValidators:true});
 if(!result)return res.status(409).json({error:'Another operator changed the checklist; refresh'});
 await LoadingChange.updateOne({_id:change._id,status:'AUTHORISED'},{$set:{status:'EXECUTED',executedBy:req.user.name,executedAt:new Date()}});
 req.app.get('io').to(String(req.flight._id)).emit('lirChecklistUpdated',{revision:doc.revision});
 res.json({checklist:result});
});
router.get('/:flightId/loading-preview', async (req,res) => {
 const doc=await latest(req.flight._id);
 if(!doc)return res.status(404).json({error:'No LIR uploaded'});
 if(doc.kind!=='text')return res.json({supported:false,reason:'PDF parsing is not available yet; original LIR and annotations remain available.'});
 const source=await Lir.findById(doc._id).select('+original');
 const raw=source.original.toString('utf8');
 if(!raw.includes('LOADING INSTRUCTION/REPORT') || !raw.includes(' TK '))return res.json({supported:false,reason:'Only TK text LIR is supported in this first preview.'});
 const parsed=require('../services/tkLirParser').parse(raw);
 res.json({supported:true,revision:doc.revision,...parsed});
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
  if (!await canAnnotate(req.user, req.flight._id)) return res.status(403).json({ error:'Only the RAMP agent assigned to this flight can annotate or sign its LIR' });
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
