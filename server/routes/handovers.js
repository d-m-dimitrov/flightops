const express=require('express'),mongoose=require('mongoose');
const Flight=require('../models/Turnaround'),Assignment=require('../models/Assignment'),Handover=require('../models/Handover');
const access=require('../services/handoverAccess');
const router=express.Router();router.use(require('../middleware/requireUser'));
router.param('flightId',async(req,res,next,id)=>{
  if(!mongoose.isObjectIdOrHexString(id))return res.status(400).json({error:'Invalid flight'});
  req.flight=await Flight.findOne({_id:id,deleted:{$ne:true}});
  if(!req.flight)return res.status(404).json({error:'Flight not found'});
  req.assignments=await Assignment.find({turnaroundId:id});req.access=access.permissions(req.assignments,req.user);
  if(!req.access.view)return res.status(403).json({error:'Only the assigned team and Operations can view this handover'});
  res.set('Cache-Control','no-store');next();
});
async function notify(req,text){
  try{await require('../services/systemMessage')(req,req.params.flightId,text);}catch(error){console.error('Handover notice failed:',error.message);}
  req.app.get('io').to(req.params.flightId).emit('handoverUpdated');
}
router.get('/:flightId',async(req,res)=>{
  const versions=await Handover.find({turnaroundId:req.params.flightId}).sort({revision:-1});
  const gateRows=req.assignments.filter(a=>a.role==='GATE');const gate=gateRows.length===1?gateRows[0]:null;
  res.json({flight:{id:req.flight._id,display:req.flight.flightNumberDisplay||`${req.flight.arrivalFlight}/${req.flight.departureFlight}`,operatingDate:req.flight.operatingDate},
    permissions:req.access,sequence:req.flight.handoverSequence||0,gateAssignmentId:gate?._id||null,
    checkinAssignmentId:access.roleAssignment(req.assignments,'CHECKIN',req.user)?._id||null,versions,
    receipt:versions[0]?.receipts.find(r=>String(r.assignmentId)===String(gate?._id))||null});
});
router.post('/:flightId',async(req,res)=>{
  req.body=req.body||{};
  if(!req.access.send)return res.status(403).json({error:'Only the assigned Check-in agent can send a handover'});
  const assigned=access.roleAssignment(req.assignments,'CHECKIN',req.user);
  if(String(assigned._id)!==req.body.assignmentId)return res.status(409).json({error:'Assignment changed. Refresh before sending.'});
  let data;try{data=access.validate(req.body);}catch(error){return res.status(400).json({error:error.message});}
  const filter={_id:req.flight._id,deleted:{$ne:true}};
  if(req.body.expectedSequence===0)filter.$or=[{handoverSequence:0},{handoverSequence:{$exists:false}}];else filter.handoverSequence=req.body.expectedSequence;
  const flight=await Flight.findOneAndUpdate(filter,{$inc:{handoverSequence:1}},{new:true});
  if(!flight)return res.status(409).json({error:'Another handover was sent. Refresh and review it first.'});
  const handover=await Handover.create({...data,turnaroundId:flight._id,revision:flight.handoverSequence,assignmentId:assigned._id,sentBy:req.user._id,sentByName:req.user.name});
  await notify(req,`Check-in handover v${handover.revision} sent — awaiting Gate receipt`);res.status(201).json({success:true});
});
router.post('/:flightId/receive',async(req,res)=>{
  req.body=req.body||{};
  if(!req.access.receive)return res.status(403).json({error:'Only the assigned Gate agent can confirm this handover'});
  const assigned=access.roleAssignment(req.assignments,'GATE',req.user);
  if(String(assigned._id)!==req.body.assignmentId)return res.status(409).json({error:'Assignment changed. Refresh before confirming.'});
  const latest=await Handover.findOne({turnaroundId:req.flight._id}).sort({revision:-1});
  if(!latest||String(latest._id)!==req.body.handoverId)return res.status(409).json({error:'Handover changed. Open and read the latest version.'});
  const doc=await Handover.findOneAndUpdate({_id:latest._id,receipts:{$not:{$elemMatch:{assignmentId:assigned._id}}}},{$push:{receipts:{assignmentId:assigned._id,userId:req.user._id,name:req.user.name,receivedAt:new Date()}}},{new:true,timestamps:false});
  if(doc)await notify(req,`Gate confirmed receipt of Check-in handover v${latest.revision}`);
  res.json({success:true});
});
module.exports=router;
