const express=require('express'),mongoose=require('mongoose');
const Flight=require('../models/Turnaround'),Assignment=require('../models/Assignment'),Message=require('../models/FlightMessage');
const rules=require('../services/flightMessages');
const router=express.Router();
router.use(require('../middleware/requireUser'));
router.use('/:flightId',async(req,res,next)=>{
  res.set('Cache-Control','no-store');
  if(!mongoose.isObjectIdOrHexString(req.params.flightId))return res.status(400).json({error:'Invalid flight'});
  const flight=await Flight.findOne({_id:req.params.flightId,deleted:{$ne:true}}).select('arrivalFlight departureFlight operatingDate');
  if(!flight)return res.status(404).json({error:'Flight not found'});
  const canAdd=rules.canAdd(req.user);
  if(!canAdd&&!await Assignment.exists({turnaroundId:flight._id,userId:req.user._id}))return res.status(403).json({error:'Messages are available to OPS and the assigned flight team'});
  req.messageFlight=flight;req.canAddMessage=canAdd;next();
});
router.get('/:flightId',async(req,res)=>{
  const {type,direction,before}=req.query;
  if((type!==undefined&&!rules.types.includes(type))||(direction!==undefined&&!rules.directions.includes(direction))||(before!==undefined&&!mongoose.isObjectIdOrHexString(before)))return res.status(400).json({error:'Invalid message filter'});
  const filter={turnaroundId:req.params.flightId};
  if(type)filter.type=type;if(direction)filter.direction=direction;if(before)filter._id={$lt:before};
  const rows=await Message.find(filter).select('-requestId -__v').sort({_id:-1}).limit(51).lean();
  const more=rows.length>50,items=rows.slice(0,50);
  res.json({flight:req.messageFlight,canAdd:req.canAddMessage,messages:items,nextCursor:more?String(items.at(-1)._id):null});
});
router.post('/:flightId',async(req,res)=>{
  if(!req.canAddMessage)return res.status(403).json({error:'Only OPS can add messages'});
  let input;try{input=rules.validate(req.body);}catch(error){return res.status(400).json({error:error.message});}
  const key={turnaroundId:req.params.flightId,createdBy:req.user._id,requestId:input.requestId};
  let message,created=false;
  try{message=await Message.create({...input,...key,createdByName:req.user.name});created=true;}
  catch(error){if(error.code!==11000)throw error;message=await Message.findOne(key);if(!message)throw error;
    if(['type','direction','text'].some(field=>message[field]!==input[field]))return res.status(409).json({error:'This submission ID was already used. Reload before adding a different message.'});
  }
  // Only an invalidation signal enters the legacy flight room; text is fetched through authorization above.
  if(created)req.app.get('io').to(String(req.params.flightId)).emit('flightMessagesUpdated');
  res.status(created?201:200).json({id:message._id});
});
module.exports=router;
