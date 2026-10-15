const express=require('express'),mongoose=require('mongoose');
const Flight=require('../models/Turnaround'),Assignment=require('../models/Assignment'),GateItems=require('../models/GateItems');
const service=require('../services/gateItems'),{roleAssignment}=require('../services/handoverAccess');
const router=express.Router();router.use(require('../middleware/requireUser'));
router.param('flightId',async(req,res,next,id)=>{
 if(!mongoose.isObjectIdOrHexString(id))return res.status(400).json({error:'Invalid flight'});
 req.flight=await Flight.findOne({_id:id,deleted:{$ne:true}}).select('flightNumberDisplay arrivalFlight departureFlight operatingDate');
 if(!req.flight)return res.status(404).json({error:'Flight not found'});
 req.assignments=await Assignment.find({turnaroundId:id});req.permissions=service.permissions(req.assignments,req.user);
 if(!req.permissions.view)return res.status(403).json({error:'Gate items are available to the assigned team and Operations'});
 res.set('Cache-Control','no-store');next();
});
router.get('/:flightId',async(req,res)=>{
 const manifest=await GateItems.findOne({turnaroundId:req.params.flightId}).lean();
 res.json({flight:req.flight,permissions:req.permissions,gateAssignmentId:roleAssignment(req.assignments,'GATE',req.user)?._id||null,rampAssignmentId:roleAssignment(req.assignments,'RAMP',req.user)?._id||null,
 version:manifest?.version||0,items:manifest?.items||[],history:manifest?.history||[],summary:service.summary(manifest?.items)});
});
router.post('/:flightId',async(req,res)=>{
 const body=req.body||{},action=body.action;
 if(!['submit','receive','load','cancel'].includes(action))return res.status(400).json({error:'Invalid action'});
 const role=['submit','cancel'].includes(action)?'GATE':'RAMP';
 const assigned=roleAssignment(req.assignments,role,req.user);
 if(!assigned)return res.status(403).json({error:`Only the assigned ${role} agent may perform this action`});
 if(String(assigned._id)!==body.assignmentId)return res.status(409).json({error:'Assignment changed. Refresh first.'});
 if(!Number.isInteger(body.expectedVersion)||body.expectedVersion<0)return res.status(400).json({error:'Refresh before updating'});
 const previous=await GateItems.findOne({turnaroundId:req.params.flightId}).lean();
 if((previous?.version||0)!==body.expectedVersion)return res.status(409).json({error:'Gate items changed. Refresh and review before retrying.'});
 let items=previous?.items||[],affected=[];const at=new Date();
 try{
  if(action==='submit'){
   affected=service.batch(body.groups,items).map(i=>({...i,_id:new mongoose.Types.ObjectId(),status:'SUBMITTED',submittedAt:at,submittedByName:req.user.name}));items=[...items,...affected];
  }else{
   const item=items.find(i=>String(i._id)===body.itemId);if(!item)return res.status(404).json({error:'Item not found'});
   item.status=service.transition(item.status,action);
   const field={receive:'received',load:'loaded',cancel:'cancelled'}[action];item[field+'At']=at;item[field+'ByName']=req.user.name;affected=[item];
  }
 }catch(error){return res.status(action==='submit'?400:409).json({error:error.message});}
 const history=affected.map(i=>({itemId:i._id,type:i.type,tag:i.tag,action,userId:req.user._id,name:req.user.name,assignmentId:assigned._id,at}));
 try{
  const saved=await GateItems.findOneAndUpdate({turnaroundId:req.params.flightId,version:body.expectedVersion},{$set:{items,version:body.expectedVersion+1},$push:{history:{$each:history}}},{upsert:body.expectedVersion===0,new:true,runValidators:true});
  if(!saved)return res.status(409).json({error:'Gate items changed. Refresh before retrying.'});
 }catch(error){if(error.code===11000)return res.status(409).json({error:'Another update was saved. Refresh first.'});throw error;}
 try{await require('../services/systemMessage')(req,req.params.flightId,`Gate items: ${action} — ${affected.length} item(s)`);}catch(error){console.error('Gate items notice failed:',error.message);}
 req.app.get('io').to(req.params.flightId).emit('gateItemsUpdated');
 res.json({success:true});
});module.exports=router;
