const express=require('express');
const mongoose=require('mongoose');
const Assignment=require('../models/Assignment');
const Turnaround=require('../models/Turnaround');
const Lir=require('../models/Lir');
const router=express.Router();
router.use(require('../middleware/requireUser'));
router.use((req,res,next)=>{res.set('Cache-Control','no-store');next();});
router.param('flightId',async(req,res,next,id)=>{
  if(!mongoose.isObjectIdOrHexString(id))return res.status(400).json({error:'Invalid flight'});
  if(!await Turnaround.exists({_id:id,deleted:{$ne:true}}))return res.status(404).json({error:'Flight not found'});
  next();
});
async function notice(req,message,event){
  try{await require('../services/systemMessage')(req,req.params.flightId,message);}catch(error){console.error('Acknowledgement notice failed:',error.message);}
  req.app.get('io').to(req.params.flightId).emit(event);
}
router.post('/:flightId/assignments/:assignmentId/accept',async(req,res)=>{
  const {flightId,assignmentId}=req.params;
  if(!mongoose.isObjectIdOrHexString(assignmentId))return res.status(400).json({error:'Invalid assignment'});
  const filter={_id:assignmentId,turnaroundId:flightId,userId:req.user._id};
  const assignment=await Assignment.findOneAndUpdate({...filter,acceptedAt:null},{$set:{acceptedAt:new Date(),acceptedByName:req.user.name}},{new:true});
  if(assignment){await notice(req,`${req.user.name} accepted ${assignment.role} assignment`,'assignmentAccepted');return res.json(assignment);}
  const existing=await Assignment.findOne(filter);
  if(!existing)return res.status(403).json({error:'This assignment no longer belongs to you. Refresh the flight.'});
  res.json(existing); // Repeated click keeps original acceptance time.
});
async function context(req){
  const assignments=await Assignment.find({turnaroundId:req.params.flightId,role:'RAMP'}).populate('userId','name').limit(2);
  const assigned=assignments.length===1?assignments[0]:null;
  return {assigned,canReceive:Boolean(assigned?.userId && req.user.department==='RAMP' && String(assigned.userId._id)===String(req.user._id))};
}
router.use('/:flightId/lir/:documentId',async(req,res,next)=>{
  if(!require('../services/lirValidation').permissions(req.user).view)return res.status(403).json({error:'LIR access denied'});
  if(!mongoose.isObjectIdOrHexString(req.params.documentId))return res.status(400).json({error:'Invalid LIR'});
  req.lir=await Lir.findOne({_id:req.params.documentId,turnaroundId:req.params.flightId});
  if(!req.lir)return res.status(404).json({error:'LIR not found'});
  next();
});
router.get('/:flightId/lir/:documentId',async(req,res)=>{
  const {assigned,canReceive}=await context(req);
  const latest=await Lir.findOne({turnaroundId:req.params.flightId}).sort({revision:-1}).select('_id');
  res.json({assignmentId:assigned?._id || null,agentName:assigned?.userId?.name || null,
    canReceive:canReceive && String(latest?._id)===String(req.lir._id),
    receipt:(req.lir.receipts || []).find(r=>String(r.assignmentId)===String(assigned?._id)) || null,
    history:req.lir.receipts || []});
});
router.post('/:flightId/lir/:documentId',async(req,res)=>{
  const {assigned,canReceive}=await context(req);
  if(!canReceive || String(assigned._id)!==req.body?.assignmentId)return res.status(403).json({error:'Only the currently assigned RAMP agent can confirm receipt. Refresh the LIR.'});
  const latest=await Lir.findOne({turnaroundId:req.params.flightId}).sort({revision:-1}).select('_id');
  if(String(latest?._id)!==String(req.lir._id))return res.status(409).json({error:'A newer LIR is available. Open and read the latest version.'});
  const receipt={assignmentId:assigned._id,userId:req.user._id,name:req.user.name,receivedAt:new Date()};
  const doc=await Lir.findOneAndUpdate({_id:req.lir._id,receipts:{$not:{$elemMatch:{assignmentId:assigned._id}}}},{$push:{receipts:receipt}},{new:true,timestamps:false});
  if(doc)await notice(req,`${req.user.name} confirmed LIR v${req.lir.revision} received / read`,'lirReceiptUpdated');
  res.json({success:true});
});
module.exports=router;
