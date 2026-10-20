const router=require('express').Router();
const Turnaround=require('../models/Turnaround');
const time=require('../../client/js/operationalTime');
router.use(require('../middleware/requireUser'));
router.get('/',async(req,res)=>{
 const u=req.user;
 if(u.role!=='ADMIN'&&!['OPERATIONS_DM','PAX_DM','RAMP_DM','SPUR_DM','TRAFFIC_COORDINATOR','RAMP_ALLOCATOR','SPUR_COORDINATOR','CHECKIN_SUPERVISOR'].includes(u.position))return res.sendStatus(403);
 const from=String(req.query.from||''),to=String(req.query.to||'');
 const valid=d=>/^\d{4}-\d{2}-\d{2}$/.test(d)&&!Number.isNaN(Date.parse(d));
 if(!valid(from)||!valid(to)||from>to||Date.parse(to)-Date.parse(from)>93*86400000)return res.status(400).json({error:'Select a valid period up to 93 days'});
 try{
 const records=await Turnaround.find({deleted:{$ne:true},status:{$ne:'CANCELLED'},operatingDate:{$gte:from,$lte:to}}).lean();
 const airline=String(req.query.airline||'').toUpperCase(),aircraft=String(req.query.aircraft||'').toUpperCase();
 const groups=new Map();let total=0,complete=0,exceeded=0,missing=0;
 for(const f of records){
 if(airline&&f.airline!==airline)continue;
 if(aircraft&&f.aircraft?.aircraftType!==aircraft)continue;
 const key=f.airline||'UNKNOWN';
 if(!groups.has(key))groups.set(key,{airline:key,flights:0,completed:0,overMgt:0,missing:0,actualMinutes:0,scheduledMinutes:0,scheduledCount:0,actualCount:0});
 const g=groups.get(key);g.flights++;total++;
 const sta=f.arrival?.staAt?new Date(f.arrival.staAt).getTime():NaN,std=f.departure?.stdAt?new Date(f.departure.stdAt).getTime():NaN;
 if(Number.isFinite(sta)&&Number.isFinite(std)&&std>=sta){g.scheduledMinutes+=(std-sta)/60000;g.scheduledCount++}
 const on=f.arrival?.onBlocks?new Date(f.arrival.onBlocks).getTime():NaN;
 const off=f.departure?.pushback?new Date(f.departure.pushback).getTime():NaN;
 if(!Number.isFinite(on)||!Number.isFinite(off)||off<on){g.missing++;missing++;continue}
 const duration=(off-on)/60000;
 g.actualMinutes+=duration;g.actualCount++;g.completed++;complete++;
 if(Number.isFinite(f.mgt)&&duration>f.mgt){g.overMgt++;exceeded++}
 }
 res.json({from,to,total,complete,exceeded,missing,groups:[...groups.values()].map(g=>({...g,avgActual:g.actualCount?Math.round(g.actualMinutes/g.actualCount):null,avgScheduled:g.scheduledCount?Math.round(g.scheduledMinutes/g.scheduledCount):null})).sort((a,b)=>b.flights-a.flights),definition:'Actual ground time = on-blocks to pushback; MGT exceedance only evaluated where MGT exists. Missing times excluded from duration averages.'});
 }catch(e){console.error(e);res.status(500).json({error:'Performance data unavailable'})}
});
module.exports=router;