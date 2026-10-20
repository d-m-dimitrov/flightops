const router=require('express').Router();
const Turnaround=require('../models/Turnaround');
router.use(require('../middleware/requireUser'));
router.get('/',async(req,res)=>{
 const u=req.user;
 if(u.role!=='ADMIN'&&!['OPERATIONS_DM','PAX_DM','RAMP_DM','SPUR_DM','TRAFFIC_COORDINATOR','RAMP_ALLOCATOR','SPUR_COORDINATOR','CHECKIN_SUPERVISOR'].includes(u.position))return res.sendStatus(403);
 const from=String(req.query.from||''),to=String(req.query.to||'');
 const valid=s=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s));
 if(!valid(from)||!valid(to)||from>to||(Date.parse(to)-Date.parse(from))>93*86400000)return res.status(400).json({error:'Select a valid period up to 93 days'});
 try{
 const airline=String(req.query.airline||'').toUpperCase(),aircraft=String(req.query.aircraft||'').toUpperCase();
 const flights=await Turnaround.find({deleted:{$ne:true},status:{$ne:'CANCELLED'},operatingDate:{$gte:from,$lte:to}}).lean();
 const rows=[];let total=0,delayed=0,lateInbound=0,unknown=0,atcConfirmed=0;
 for(const f of flights){
 if(airline&&f.airline!==airline)continue;
 if(aircraft&&f.aircraft?.aircraftType!==aircraft)continue;
 total++;
 const ms=v=>v?new Date(v).getTime():NaN;
 const sta=ms(f.arrival?.staAt),ata=ms(f.arrival?.ata),std=ms(f.departure?.stdAt),push=ms(f.departure?.pushback);
 if(!Number.isFinite(std)||!Number.isFinite(push)){unknown++;continue}
 const delay=Math.max(0,Math.round((push-std)/60000));
 if(delay<=15)continue;
 delayed++;
 const inbound=Number.isFinite(sta)&&Number.isFinite(ata)?Math.max(0,Math.round((ata-sta)/60000)):null;
 if(inbound!==null&&inbound>0)lateInbound++;
 const sgt=Number.isFinite(sta)?Math.round((std-sta)/60000):null;
 const mgt=Number.isFinite(f.mgt)?f.mgt:null;
 const buffer=sgt!==null&&mgt!==null?Math.max(0,sgt-mgt):null;
 const inherited=inbound!==null&&buffer!==null?Math.min(delay,Math.max(0,inbound-buffer)):null;
 rows.push({date:f.operatingDate,airline:f.airline||'',aircraft:f.aircraft?.aircraftType||'',arrivalFlight:f.arrivalFlight||'',departureFlight:f.departureFlight||'',delay,inboundDelay:inbound,sgt,mgt,estimatedInboundContribution:inherited,unattributed:inherited===null?null:Math.max(0,delay-inherited)});
 }
 rows.sort((a,b)=>b.delay-a.delay);
 res.json({from,to,total,delayed,lateInbound,unknown,atcConfirmed,rows:rows.slice(0,250),truncated:rows.length>250,definition:'Departure delay is measured from STD to PUSHBACK, not airborne ATD. Late inbound is ATA minus STA. Estimated inbound contribution is an indicative schedule-buffer calculation, not an attributed delay cause. Remaining delay is unattributed, NOT station delay. ATC delay cannot be confirmed without an explicit cause or clearance timestamp.'});
 }catch(e){console.error(e);res.status(500).json({error:'Delay analysis unavailable'})}
});
module.exports=router;