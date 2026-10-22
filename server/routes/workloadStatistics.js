const router=require('express').Router();
const day=require('../services/flightDay');
const Turnaround=require('../models/Turnaround');
const Assignment=require('../models/Assignment');
const StaffShift=require('../models/StaffShift');
router.use(require('../middleware/requireUser'));
router.get('/',async(req,res)=>{
 const user=req.user;
 const permitted=user.role==='ADMIN'||['OPERATIONS_DM','PAX_DM','RAMP_DM','SPUR_DM','TRAFFIC_COORDINATOR','RAMP_ALLOCATOR','SPUR_COORDINATOR','CHECKIN_SUPERVISOR'].includes(user.position);
 if(!permitted)return res.sendStatus(403);
 const date=req.query.date;
 let filter;try{filter=day.query(date)}catch{return res.status(400).json({error:'Invalid date'})}
 try{
 const flights=(await Turnaround.find(filter).lean()).filter(f=>f.status!=='CANCELLED'&&day.includes(f,date));
 const ids=flights.map(f=>f._id);
 const [assignments,shifts]=await Promise.all([
 Assignment.find({turnaroundId:{$in:ids}}).populate('userId','name department').lean(),
 StaffShift.find({date}).populate('userId','name department').lean()
 ]);
 const lookup=new Map(flights.map(f=>[String(f._id),f]));
 const staff=new Map();
 function ensure(id,name,department){if(!staff.has(id))staff.set(id,{id,name,department,assignments:[],shift:null,overlaps:0});return staff.get(id)}
 for(const s of shifts){if(!s.userId)continue;const p=ensure(String(s.userId._id),s.userId.name,s.userId.department);p.shift={status:s.status,start:s.start,end:s.end}}
 for(const a of assignments){
 if(!a.userId)continue;
 const f=lookup.get(String(a.turnaroundId));if(!f||!day.roleOnDay(f,a.role,date))continue;
 const p=ensure(String(a.userId._id),a.userId.name,a.userId.department);
 const arrival=['ARRIVAL','ARRIVAL_DISPATCH','ARRIVAL_RAMP'].includes(a.role);
 const anchor=arrival?f.arrival?.staAt:f.departure?.stdAt;
 const t=anchor?new Date(anchor).getTime():NaN;
 const start=Number.isFinite(t)?new Date(t+(arrival?-30:-150)*60000):null;
 const end=Number.isFinite(t)?new Date(t+30*60000):null;
 p.assignments.push({turnaroundId:String(f._id),flight:arrival?f.arrivalFlight:f.departureFlight,airline:f.airline,role:a.role,start,end});
 }
 for(const p of staff.values()){
 const ordered=p.assignments.filter(a=>a.start&&a.end).sort((a,b)=>new Date(a.start)-new Date(b.start));
 for(let i=0;i<ordered.length;i++)for(let j=i+1;j<ordered.length;j++){
 if(new Date(ordered[j].start)>=new Date(ordered[i].end))break;
 // Arrival and departure duties on the same turnaround are one combined assignment, not a clash.
 if(ordered[i].turnaroundId===ordered[j].turnaroundId)continue;
 p.overlaps++;
 }
 }
 // Hourly operational coverage (London clock). Count distinct people, not roles.
 const londonHour=value=>Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',hour:'2-digit',hourCycle:'h23'}).format(value));
 const hourly=Array.from({length:24},(_,hour)=>({hour,working:0,assigned:0,required:0}));
 const dayStart=require('../../client/js/operationalTime').fromLocal(date+'T00:00').getTime();
 const nextDate=require('../../client/js/operationalTime').addDays(date,1);
 const dayEnd=require('../../client/js/operationalTime').fromLocal(nextDate+'T00:00').getTime();
 const slots=[];
 for(let t=dayStart;t<dayEnd;t+=15*60000)slots.push({start:t,end:Math.min(t+15*60000,dayEnd),hour:londonHour(new Date(t))});
 for(const slot of slots){
   const working=new Set(),busy=new Set(),demand=new Set();
   for(const p of staff.values()){
     const shift=p.shift;
     if(shift?.status==='WORKING'&&shift.start&&shift.end&&new Date(shift.start).getTime()<slot.end&&new Date(shift.end).getTime()>slot.start)working.add(p.id);
     for(const a of p.assignments){
       if(a.start&&a.end&&new Date(a.start).getTime()<slot.end&&new Date(a.end).getTime()>slot.start){
         busy.add(p.id);
         demand.add(a.turnaroundId+':'+a.role);
       }
     }
   }
   const h=hourly[slot.hour];
   h.working=Math.max(h.working,working.size);
   h.assigned=Math.max(h.assigned,busy.size);
   // Role slots are demand indicators, not a staffing minimum.
   h.required=Math.max(h.required,demand.size);
 }
 const combined=[...staff.values()].map(p=>({
   id:p.id,
   name:p.name,
   count:new Set(p.assignments.filter(a=>['ARRIVAL_DISPATCH','DISPATCH'].includes(a.role)).map(a=>a.turnaroundId)
     .filter(id=>p.assignments.some(a=>a.turnaroundId===id&&a.role==='ARRIVAL_DISPATCH')&&p.assignments.some(a=>a.turnaroundId===id&&a.role==='DISPATCH'))).size
 })).filter(p=>p.count>0);
 res.json({date,hourly,combined,staff:[...staff.values()].sort((a,b)=>b.assignments.length-a.assignments.length),method:'Estimated assignment windows: arrival STA -30/+30 min; departure STD -150/+30 min. Arrival and departure duties on the same turnaround are treated as combined dispatch, not overlap. Overlaps between different turnarounds are potential conflicts, not confirmed clashes.'});
 }catch(e){console.error(e);res.status(500).json({error:'Workload unavailable'})}
});
module.exports=router;