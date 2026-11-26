'use strict';
// Read-only operational FIDS: staff assignments are sourced from the actual
// ARRIVAL_DISPATCH / DISPATCH roles; regular schedules are never modified.
const express=require('express');
const Turnaround=require('../models/Turnaround');
const Assignment=require('../models/Assignment');
const Lir=require('../models/Lir');
const LirChecklist=require('../models/LirChecklist');
const AircraftGroundStay=require('../models/AircraftGroundStay');
const flightDay=require('../services/flightDay');
const turnaroundView=require('../services/turnaroundView');
const access=require('../services/departmentAccess');
const time=require('../../client/js/operationalTime');
const router=express.Router();
router.use(require('../middleware/requireUser'));

function canView(user){
 return access.superAdmin(user)||Boolean(user?.active&&['OPERATIONS','RAMP'].includes(user.department));
}
function validDate(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
 try{return time.addDays(value,0)===value;}catch{return false;}
}
const isBulk=row=>row.uldType==='BULK'||row.position==='BULK'||['51','52','53'].includes(row.position)&&Array.isArray(row.bulkItems)&&row.bulkItems.length>0;
const checklistProgress=checklist=>{
 if(!checklist?.published)return checklist?'DRAFT':'NO CHECKLIST';
 const rows=checklist.rows||[];
 if(!rows.length)return 'PUBLISHED';
 const complete=rows.filter(row=>!!row.confirmedAt&&(!isBulk(row)||!(row.bulkItems||[]).some(item=>!item.confirmedAt)));
 return complete.length===rows.length?'LOADED':complete.length?'LOADING '+complete.length+'/'+rows.length:'PUBLISHED';
};
const members=(rows,role)=>{
 const names=[...new Set(rows.filter(a=>a.role===role&&a.userId?.active!==false&&a.userId?.name)
  .map(a=>a.userId.name.trim()).filter(Boolean))];
 return names;
};
router.get('/',async(req,res)=>{
 if(!canView(req.user))return res.status(403).json({error:'OPS FIDS is available to active Operations / Ramp staff and Admin'});
 const date=req.query.date||time.operatingDate();
 if(!validDate(date))return res.status(400).json({error:'Choose a valid London operating date'});
 const found=await Turnaround.find(flightDay.query(date))
  .select('airline arrivalFlight departureFlight aircraft arrival departure operatingDate status departureStatus isRecovery groundStayId flightNumberDisplay serviceType')
  .lean();
 const selected=[];
 for(const record of found){
  const f=await turnaroundView(record);
  const context=flightDay.context(f,date);
  if(context.arrivalToday||context.departureToday)selected.push({...f,...context});
 }
 const ids=selected.map(f=>f._id);
 const groundStart=time.fromLocal(date+'T00:00');
 const groundEnd=time.fromLocal(time.addDays(date,1)+'T00:00');
 const [assignments,lirs,checklists,stays]=await Promise.all([
  Assignment.find({turnaroundId:{$in:ids},role:{$in:['ARRIVAL_DISPATCH','DISPATCH','RAMP']}})
   .select('turnaroundId role userId').populate('userId','name active').lean(),
  Lir.find({turnaroundId:{$in:ids}}).select('turnaroundId revision status').sort({revision:-1}).lean(),
  LirChecklist.find({turnaroundId:{$in:ids}}).select('turnaroundId published rows').lean(),
  AircraftGroundStay.find({groundedAt:{$lt:groundEnd},$or:[{closedAt:null},{closedAt:{$gte:groundStart}}]})
   .select('registration aircraftType stand arrivalFlight originalDepartureFlight reason status groundedAt expectedReleaseAt closedAt originalOperatingDate recoveryTurnaroundId')
   .sort({groundedAt:-1}).limit(200).lean()
 ]);
 const byFlight=new Map();
 for(const row of assignments){
  const id=String(row.turnaroundId);
  if(!byFlight.has(id))byFlight.set(id,[]);
  byFlight.get(id).push(row);
 }
 const byChecklist=new Map(checklists.map(c=>[String(c.turnaroundId),c]));
 const byLir=new Map();
 for(const doc of lirs)if(!byLir.has(String(doc.turnaroundId)))byLir.set(String(doc.turnaroundId),doc);
 const rows=selected.map(f=>{
  const a=byFlight.get(String(f._id))||[];
  const last=byLir.get(String(f._id));
  return {
   id:f._id,airline:f.airline,arrivalFlight:f.arrivalFlight||'',departureFlight:f.departureFlight||'',
   aircraft:{aircraftType:f.aircraft?.aircraftType||'',registration:f.aircraft?.registration||'',stand:f.aircraft?.stand||''},
   arrival:{staAt:f.arrival?.staAt||null,eta:f.arrival?.eta||null,ata:f.arrival?.ata||null,onBlocks:f.arrival?.onBlocks||null},
   departure:{stdAt:f.departure?.stdAt||null,etd:f.departure?.etd||null,atd:f.departure?.atd||null,
    airborne:f.departure?.airborne||null},
   status:f.status||'SCHEDULED',departureStatus:f.departureStatus||'SCHEDULED',
   arrivalToday:!!f.arrivalToday,departureToday:!!f.departureToday,dayLabel:f.dayLabel||'',
   isRecovery:!!f.isRecovery,
   dispatchers:{arrival:members(a,'ARRIVAL_DISPATCH'),departure:members(a,'DISPATCH'),ramp:members(a,'RAMP')},
   lir:{status:last?.status||'NONE',loading:checklistProgress(byChecklist.get(String(f._id)))}
  };
 });
 rows.sort((a,b)=>{
  const at=x=>Date.parse(x.arrivalToday?(x.arrival.eta||x.arrival.staAt):(x.departure.etd||x.departure.stdAt));
  const x=at(a),y=at(b);
  return (Number.isFinite(x)?x:Infinity)-(Number.isFinite(y)?y:Infinity) ||
   String(a.arrivalFlight||a.departureFlight).localeCompare(String(b.arrivalFlight||b.departureFlight));
 });
 const recoveryRefs=[...new Set(stays.map(x=>x.recoveryTurnaroundId).filter(Boolean).map(String))];
 const recoveryFlights=recoveryRefs.length?await Turnaround.find({_id:{$in:recoveryRefs}})
  .select('departureFlight operatingDate departure status').lean():[];
 const recoveryById=new Map(recoveryFlights.map(f=>[String(f._id),f]));
 const aog=stays.map(g=>{
  const recovery=recoveryById.get(String(g.recoveryTurnaroundId));
  return {registration:g.registration,aircraftType:g.aircraftType||'',stand:g.stand||'',
   arrivalFlight:g.arrivalFlight||'',originalDepartureFlight:g.originalDepartureFlight||'',
   status:g.status,reason:g.reason,groundedAt:g.groundedAt,expectedReleaseAt:g.expectedReleaseAt,
   recoveryFlight:recovery?.departureFlight||'',recoveryDate:recovery?.operatingDate||'',
   recoveryStatus:recovery?.status||'',recoveryFlightId:recovery?._id||null};
 });
 res.set('Cache-Control','no-store').json({date,asOf:new Date().toISOString(),flights:rows,aog});
});
module.exports=router;
