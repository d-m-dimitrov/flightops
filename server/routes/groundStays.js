const express=require('express');
const mongoose=require('mongoose');
const Turnaround=require('../models/Turnaround');
const FlightSchedule=require('../models/FlightSchedule');
const AircraftGroundStay=require('../models/AircraftGroundStay');
const requireUser=require('../middleware/requireUser');
const access=require('../services/departmentAccess');
const addSystemMessage=require('../services/systemMessage');
const time=require('../../client/js/operationalTime');
const router=express.Router();
router.use(requireUser);

function canManage(user){
 return access.superAdmin(user)||Boolean(user?.active&&user.department==='OPERATIONS'&&user.position==='OPERATIONS_DM');
}
function requireManager(req,res,next){
 if(canManage(req.user))return next();
 return res.status(403).json({error:'Only Operations Duty Manager or Admin can manage aircraft ground stays'});
}
function validDate(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
 try{return time.addDays(value,0)===value;}catch{return false;}
}
function flightNumber(value,airline){
 const number=String(value||'').trim().toUpperCase();
 if(!number)return '';
 if(!/^[A-Z0-9]{2,3}\d{1,4}[A-Z]{0,2}$/.test(number))throw Error('Use an airline flight number such as TK6672 or TK1972D');
 if(airline&&!number.startsWith(airline.toUpperCase()))throw Error('Recovery flight must use the same airline code');
 return number;
}
function toLocalDateTime(value,occurrence){
 if(!value)return null;
 return time.fromLocal(value,occurrence||'reject');
}
const self=(flight)=>flight?{id:flight._id,arrivalFlight:flight.arrivalFlight,departureFlight:flight.departureFlight,
 operatingDate:flight.operatingDate,status:flight.status,aircraft:flight.aircraft,departure:flight.departure}:null;
async function withFlights(stays){
 const ids=[...new Set(stays.flatMap(s=>[s.sourceTurnaroundId,s.recoveryTurnaroundId]).filter(Boolean).map(String))];
 const flights=await Turnaround.find({_id:{$in:ids}}).lean();
 const byId=new Map(flights.map(f=>[String(f._id),f]));
 return stays.map(stay=>({...stay,source:self(byId.get(String(stay.sourceTurnaroundId))),
  recovery:self(byId.get(String(stay.recoveryTurnaroundId)))}));
}
function notify(req,ids){
 const io=req.app.get('io');
 if(!io)return;
 for(const id of ids.filter(Boolean))io.to(String(id)).emit('flightUpdated');
 io.emit('groundStayUpdated');
}
async function systemNotice(req,id,message){
 try{await addSystemMessage(req,id,message);}catch(error){console.error('Ground stay notification failed:',error.message);}
}

// OPEN AOG history remains visible on every calendar day while the aircraft is grounded.
router.get('/',async(req,res)=>{
 const date=req.query.date;
 if(date&&!validDate(date))return res.status(400).json({error:'Date must be YYYY-MM-DD'});
 let filter={};
 if(date){
  const start=time.fromLocal(date+'T00:00');
  const end=time.fromLocal(time.addDays(date,1)+'T00:00');
  filter={groundedAt:{$lt:end},$or:[{closedAt:null},{closedAt:{$gte:start}}]};
 }else filter={status:{$ne:'CLOSED'}};
 const stays=await AircraftGroundStay.find(filter).sort({groundedAt:-1}).limit(200).lean();
 res.json({stays:await withFlights(stays),permissions:{manage:canManage(req.user)}});
});
router.get('/flight/:flightId',async(req,res)=>{
 if(!mongoose.isObjectIdOrHexString(req.params.flightId))return res.status(400).json({error:'Invalid flight ID'});
 const stay=await AircraftGroundStay.findOne({$or:[{sourceTurnaroundId:req.params.flightId},{recoveryTurnaroundId:req.params.flightId}]}).lean();
 res.json({stay:stay?(await withFlights([stay]))[0]:null,permissions:{manage:canManage(req.user)}});
});

// Original arrival remains intact; only its *departure* is cancelled.
router.post('/',requireManager,async(req,res)=>{
 const id=req.body.sourceFlightId;
 if(!mongoose.isObjectIdOrHexString(id))return res.status(400).json({error:'Select a valid original arriving flight'});
 const source=await Turnaround.findOne({_id:id,deleted:{$ne:true}});
 if(!source)return res.status(404).json({error:'Flight not found'});
 if(source.isRecovery)return res.status(400).json({error:'A recovery flight cannot be the original arrival'});
 if(source.groundStayId||await AircraftGroundStay.exists({sourceTurnaroundId:id}))
  return res.status(409).json({error:'This arrival already has a Ground Stay'});
 if(['DEPARTED','PUSHBACK'].includes(source.status)||source.departure?.airborne||source.departure?.atd)
  return res.status(409).json({error:'Departure has already started or completed'});
 const registration=String(source.aircraft?.registration||'').trim().toUpperCase();
 if(!/^[A-Z0-9-]{3,12}$/.test(registration))return res.status(400).json({error:'Enter a valid aircraft registration in Flight Details first'});
 const reason=String(req.body.reason||'').toUpperCase();
 if(!['TECHNICAL','OPERATIONAL','WEATHER','CREW','OTHER'].includes(reason))return res.status(400).json({error:'Choose a ground-stay reason'});
 const notes=String(req.body.notes||'').trim();
 if(notes.length>600)return res.status(400).json({error:'Notes are too long'});
 const already=await AircraftGroundStay.exists({registration,status:{$in:['GROUNDED','RECOVERY_PLANNED']}});
 if(already)return res.status(409).json({error:'An open ground stay already exists for registration '+registration});
 const now=new Date();
 let groundedAt=source.arrival?.onBlocks||source.arrival?.ata||now;
 if(new Date(groundedAt)>now)groundedAt=now;
 let stay;
 try{
  stay=await AircraftGroundStay.create({sourceTurnaroundId:source._id,airline:source.airline,
   registration,aircraftType:source.aircraft?.aircraftType||'',stand:source.aircraft?.stand||'',
   arrivalFlight:source.arrivalFlight||'',originalDepartureFlight:source.departureFlight||'',
   originalOperatingDate:source.operatingDate,reason,notes,groundedAt,
   history:[{action:'GROUND_AIRCRAFT',by:req.user.name,byId:req.user._id,details:reason+(notes?' · '+notes:'')}]});
 }catch(error){if(error.code===11000)return res.status(409).json({error:'A Ground Stay already exists for this arrival'});throw error;}
 const updated=await Turnaround.findOneAndUpdate({_id:source._id,groundStayId:null,
  'departure.airborne':null,'departure.atd':null,status:{$nin:['DEPARTED','PUSHBACK']}},
  {$set:{groundStayId:stay._id,departureStatus:'CANCELLED',status:'GROUNDED'}},{new:true});
 if(!updated){await AircraftGroundStay.deleteOne({_id:stay._id});return res.status(409).json({error:'Flight changed; refresh and try again'});}
 await systemNotice(req,source._id,'AIRCRAFT GROUNDED · '+registration+' · '+reason+'. Original departure '+(source.departureFlight||'')+' cancelled; arrival retained.');
 notify(req,[source._id]);res.status(201).json({stay:(await withFlights([stay.toObject()]))[0]});
});

router.put('/:id/details',requireManager,async(req,res)=>{
 if(!mongoose.isObjectIdOrHexString(req.params.id))return res.status(400).json({error:'Invalid Ground Stay'});
 const stay=await AircraftGroundStay.findOne({_id:req.params.id,status:{$ne:'CLOSED'}});
 if(!stay)return res.status(404).json({error:'Open Ground Stay not found'});
 const reason=req.body.reason===undefined?stay.reason:String(req.body.reason).toUpperCase();
 if(!['TECHNICAL','OPERATIONAL','WEATHER','CREW','OTHER'].includes(reason))return res.status(400).json({error:'Invalid reason'});
 const notes=req.body.notes===undefined?stay.notes:String(req.body.notes||'').trim();
 if(notes.length>600)return res.status(400).json({error:'Notes are too long'});
 let expectedReleaseAt;
 try{expectedReleaseAt=toLocalDateTime(req.body.expectedReleaseLocal,req.body.occurrence);}
 catch(error){return res.status(400).json({error:error.message});}
 if(expectedReleaseAt&&expectedReleaseAt<stay.groundedAt)return res.status(400).json({error:'Expected release cannot precede grounding'});
 stay.reason=reason;stay.notes=notes;stay.expectedReleaseAt=expectedReleaseAt;
 stay.history.push({action:'UPDATE_GROUND_STAY',by:req.user.name,byId:req.user._id,details:'Reason '+reason+'; ETA '+(expectedReleaseAt?.toISOString()||'TBC')});
 await stay.save();notify(req,[stay.sourceTurnaroundId,stay.recoveryTurnaroundId]);
 res.json({stay:(await withFlights([stay.toObject()]))[0]});
});

async function duplicateFlight(number,date,excludeId){
 if(!number)return null;
 const start=time.fromLocal(date+'T00:00'),end=time.fromLocal(time.addDays(date,1)+'T00:00');
 const criteria={departureFlight:number,deleted:{$ne:true},
  $or:[{'departure.stdAt':{$gte:start,$lt:end}},{operatingDate:date,'departure.stdAt':null}]};
 if(excludeId)criteria._id={$ne:excludeId};
 if(await Turnaround.exists(criteria))return true;
 // Protect recurring flights even when their next instance has not yet
 // been generated. An overnight scheduled departure can belong to yesterday.
 const schedules=await FlightSchedule.find({active:true,departureFlight:number}).lean();
 for(const schedule of schedules){
  const offset=schedule.departureDayOffset==null?Number(schedule.std<schedule.sta):schedule.departureDayOffset;
  const originDate=time.addDays(date,-offset);
  const weekday=new Date(originDate+'T12:00:00Z').getUTCDay()||7;
  if(!schedule.daysOfWeek?.includes(weekday))continue;
  if(schedule.validFrom&&originDate<schedule.validFrom)continue;
  if(schedule.validTo&&originDate>schedule.validTo)continue;
  return true;
 }
 return false;
}
// Create a departure-only ad-hoc turnaround; NEVER alter tomorrow's recurring schedule.
router.put('/:id/recovery',requireManager,async(req,res)=>{
 if(!mongoose.isObjectIdOrHexString(req.params.id))return res.status(400).json({error:'Invalid Ground Stay'});
 const stay=await AircraftGroundStay.findById(req.params.id);
 if(!stay||stay.status==='CLOSED')return res.status(409).json({error:'Open Ground Stay required'});
 const date=String(req.body.departureDate||'');
 if(!validDate(date))return res.status(400).json({error:'Choose a valid recovery departure date'});
 const groundedDay=time.localInput(stay.groundedAt).slice(0,10);
 if(date<groundedDay)return res.status(400).json({error:'Recovery cannot be before the aircraft was grounded'});
 let number,stdAt;
 try{
  number=flightNumber(req.body.flightNumber,stay.airline);
  const std=String(req.body.std||'').trim();
  if(std&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(std))throw Error('STD must be HH:mm');
  stdAt=std?toLocalDateTime(date+'T'+std,req.body.occurrence):null;
  if(stdAt&&stdAt<=stay.groundedAt)throw Error('Recovery STD must be after grounding');
 }catch(error){return res.status(400).json({error:error.message});}
 const kind=String(req.body.flightType||'PASSENGER').toUpperCase();
 if(!['PASSENGER','CARGO','FERRY','OTHER'].includes(kind))return res.status(400).json({error:'Invalid flight type'});
 const existing=stay.recoveryTurnaroundId
  ?await Turnaround.findOne({_id:stay.recoveryTurnaroundId,deleted:{$ne:true}}):null;
 if(stay.recoveryTurnaroundId&&!existing)return res.status(409).json({error:'Linked recovery flight is missing; contact administrator'});
 if(existing&&(existing.departure?.atd||existing.departure?.airborne||existing.status==='DEPARTED'))
  return res.status(409).json({error:'A departed recovery flight cannot be edited'});
 if(await duplicateFlight(number,date,existing?._id))return res.status(409).json({error:'Flight '+number+' already exists for '+date+'. Use the actual recovery number, not the regular service.'});
 const payload={
  operatingDate:date,flightDate:time.fromLocal(date+'T00:00'),
  airline:stay.airline,departureFlight:number,flightNumberDisplay:number||'Recovery flight · number TBC',
  destination:String(req.body.destination||existing?.destination||'').trim().toUpperCase()||undefined,
  status:number&&stdAt?'SCHEDULED':'RECOVERY_TBC',
  'departure.std':req.body.std||'', 'departure.stdAt':stdAt,'departure.flightType':kind
 };
 let recovery;
 if(existing){
  recovery=await Turnaround.findByIdAndUpdate(existing._id,{$set:payload},{new:true,runValidators:true});
 }else{
  recovery=await Turnaround.create({
   operatingDate:date,flightDate:time.fromLocal(date+'T00:00'),
   airline:stay.airline,arrivalFlight:'',departureFlight:number,
   flightNumberDisplay:payload.flightNumberDisplay,
   origin:'LHR',destination:payload.destination||'',
   manual:true,isRecovery:true,recoveryOf:stay.sourceTurnaroundId,groundStayId:stay._id,
   serviceType:'AD_HOC',status:payload.status,
   aircraft:{aircraftType:stay.aircraftType,registration:stay.registration,stand:stay.stand},
   arrival:{},
   departure:{std:req.body.std||'',stdAt,flightType:kind}
  });
 }
 if(!stay.recoveryTurnaroundId)stay.recoveryTurnaroundId=recovery._id;
 stay.status='RECOVERY_PLANNED';
 stay.history.push({action:existing?'UPDATE_RECOVERY':'CREATE_RECOVERY',
  by:req.user.name,byId:req.user._id,
  details:(number||'TBC')+' · '+date+' '+(req.body.std||'STD TBC')+' · '+kind});
 await stay.save();
 await systemNotice(req,stay.sourceTurnaroundId,'RECOVERY '+(number||'TBC')+' planned for '+date+' '+(req.body.std||'STD TBC')+' · '+stay.registration);
 notify(req,[stay.sourceTurnaroundId,recovery._id]);
 res.json({stay:(await withFlights([stay.toObject()]))[0],recovery});
});

// Manual closure only if no linked recovery; a recovery is closed automatically on DEPARTED.
router.post('/:id/close',requireManager,async(req,res)=>{
 if(!mongoose.isObjectIdOrHexString(req.params.id))return res.status(400).json({error:'Invalid Ground Stay'});
 const stay=await AircraftGroundStay.findOne({_id:req.params.id,status:{$ne:'CLOSED'}});
 if(!stay)return res.status(404).json({error:'Open Ground Stay not found'});
 if(stay.recoveryTurnaroundId)return res.status(409).json({error:'Linked recovery must reach DEPARTED to close Ground Stay'});
 const notes=String(req.body.reason||'').trim();
 if(notes.length<8||notes.length>300)return res.status(400).json({error:'Provide a closure reason (8–300 characters)'});
 stay.status='CLOSED';stay.closedAt=new Date();
 stay.history.push({action:'CLOSE_WITHOUT_RECOVERY',by:req.user.name,byId:req.user._id,details:notes});
 await stay.save();
 await Turnaround.updateOne({_id:stay.sourceTurnaroundId,groundStayId:stay._id},{$set:{status:'AOG_CLOSED'}});
 notify(req,[stay.sourceTurnaroundId]);
 res.json({stay:(await withFlights([stay.toObject()]))[0]});
});
module.exports=router;
