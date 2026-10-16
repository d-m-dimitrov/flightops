const flightDay=require('../services/flightDay');
const view=require('../services/turnaroundView');
const express=require('express');
const Assignment=require('../models/Assignment'),Flight=require('../models/Turnaround'),Handover=require('../models/Handover'),Lir=require('../models/Lir');
const GateItems=require('../models/GateItems');
const router=express.Router();router.use(require('../middleware/requireUser'));
router.get('/',async(req,res)=>{
  const date=req.query.date;
  if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date+'T12:00:00Z'))||new Date(date+'T12:00:00Z').toISOString().slice(0,10)!==date)return res.status(400).json({error:'Select a valid operating date'});
  const mine=await Assignment.find({userId:req.user._id}).lean();
  const candidates=await Flight.find({_id:{$in:mine.map(a=>a.turnaroundId)},...flightDay.query(date)}).select('airline flightNumberDisplay arrivalFlight departureFlight operatingDate status aircraft arrival departure departureDayOffset timeDisambiguation mgt handoverSequence').lean();
  const flights=[];
  for(const row of candidates){const f=await view(row);if(flightDay.includes(f,date)&&mine.some(a=>String(a.turnaroundId)===String(f._id)&&flightDay.roleOnDay(f,a.role,date)))flights.push({...f,...flightDay.context(f,date)});}
  const ids=flights.map(f=>f._id);
  const [assignments,handovers,lirs,gateItems]=await Promise.all([
    Assignment.find({turnaroundId:{$in:ids}}).select('turnaroundId role userId acceptedAt').lean(),
    Handover.find({turnaroundId:{$in:ids}}).select('turnaroundId revision assignmentId receipts').sort({revision:-1}).lean(),
    Lir.find({turnaroundId:{$in:ids}}).select('turnaroundId revision status receipts').sort({revision:-1}).lean(),
    GateItems.find({turnaroundId:{$in:ids}}).select('turnaroundId items.status').lean()
  ]);
  const canLir=require('../services/lirValidation').permissions(req.user).view;
  res.set('Cache-Control','no-store').json({user:{id:req.user._id,name:req.user.name},flights:flights.map(f=>{
    const key=String(f._id),own=mine.filter(a=>String(a.turnaroundId)===key&&flightDay.roleOnDay(f,a.role,date)),team=assignments.filter(a=>String(a.turnaroundId)===key);
    const ramp=team.filter(a=>a.role==='RAMP'),gate=team.filter(a=>a.role==='GATE');
    const handover=handovers.find(h=>String(h.turnaroundId)===key),lir=lirs.find(l=>String(l.turnaroundId)===key);
    const manifest=gateItems.find(g=>String(g.turnaroundId)===key),active=manifest?.items.filter(i=>i.status!=='CANCELLED')||[];
    return {...f,assignments:own,canLir,gateItems:manifest?{total:active.length,received:active.filter(i=>['RECEIVED','LOADED'].includes(i.status)).length,loaded:active.filter(i=>i.status==='LOADED').length}:null,handover:handover?{revision:handover.revision,assignmentId:handover.assignmentId,received:gate.length===1&&(handover.receipts||[]).some(r=>String(r.assignmentId)===String(gate[0]._id))}:null,
      lir:canLir&&lir?{revision:lir.revision,status:lir.status,received:ramp.length===1&&(lir.receipts||[]).some(r=>String(r.assignmentId)===String(ramp[0]._id))}:null};
  })});
});module.exports=router;
