const express=require('express');
const Assignment=require('../models/Assignment'),Flight=require('../models/Turnaround'),Handover=require('../models/Handover'),Lir=require('../models/Lir');
const router=express.Router();router.use(require('../middleware/requireUser'));
router.get('/',async(req,res)=>{
  const date=req.query.date;
  if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date+'T12:00:00Z'))||new Date(date+'T12:00:00Z').toISOString().slice(0,10)!==date)return res.status(400).json({error:'Select a valid operating date'});
  const mine=await Assignment.find({userId:req.user._id}).lean();
  const flights=await Flight.find({_id:{$in:mine.map(a=>a.turnaroundId)},operatingDate:date,deleted:{$ne:true}}).select('flightNumberDisplay arrivalFlight departureFlight operatingDate status aircraft arrival departure handoverSequence').lean();
  const ids=flights.map(f=>f._id);
  const [assignments,handovers,lirs]=await Promise.all([
    Assignment.find({turnaroundId:{$in:ids}}).select('turnaroundId role userId acceptedAt').lean(),
    Handover.find({turnaroundId:{$in:ids}}).select('turnaroundId revision assignmentId receipts').sort({revision:-1}).lean(),
    Lir.find({turnaroundId:{$in:ids}}).select('turnaroundId revision status receipts').sort({revision:-1}).lean()
  ]);
  const canLir=require('../services/lirValidation').permissions(req.user).view;
  res.set('Cache-Control','no-store').json({user:{id:req.user._id,name:req.user.name},flights:flights.map(f=>{
    const key=String(f._id),own=mine.filter(a=>String(a.turnaroundId)===key),team=assignments.filter(a=>String(a.turnaroundId)===key);
    const ramp=team.filter(a=>a.role==='RAMP'),gate=team.filter(a=>a.role==='GATE');
    const handover=handovers.find(h=>String(h.turnaroundId)===key),lir=lirs.find(l=>String(l.turnaroundId)===key);
    return {...f,assignments:own,canLir,handover:handover?{revision:handover.revision,assignmentId:handover.assignmentId,received:gate.length===1&&(handover.receipts||[]).some(r=>String(r.assignmentId)===String(gate[0]._id))}:null,
      lir:canLir&&lir?{revision:lir.revision,status:lir.status,received:ramp.length===1&&(lir.receipts||[]).some(r=>String(r.assignmentId)===String(ramp[0]._id))}:null};
  })});
});module.exports=router;
