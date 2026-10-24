const express=require('express');
const router=express.Router();
const User=require('../models/User');
const access=require('../services/departmentAccess');
router.use(require('../middleware/requireUser'));
router.use((req,res,next)=>access.superAdmin(req.user)||access.dutyManager(req.user)?next():res.status(403).json({error:'Duty Manager access required'}));
const roles=['DISPATCH','ARRIVAL_DISPATCH','CHECKIN','GATE','ARRIVAL','ARRIVAL_RAMP','RAMP','SPUR'];
const date=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!isNaN(Date.parse(s));
const code=s=>typeof s==='string'&&/^[A-Z0-9_-]{2,24}$/.test(s);
const safe=s=>typeof s==='string'&&s.length<=500;
async function employee(req,res){
 const u=await User.findById(req.params.id);
 if(!u||!access.canManageStaff(req.user,u)){res.status(404).json({error:'Employee not found in your department'});return null;}
 return u;
}
router.get('/:id',async(req,res)=>{
 try{const u=await employee(req,res);if(!u)return;res.json({name:u.name,department:u.department,mandatoryTraining:u.mandatoryTraining||[],lineTrainerQualifications:u.lineTrainerQualifications||[],trainingFlights:u.trainingFlights||[],trainingRevision:u.trainingRevision||0});}
 catch(e){res.status(400).json({error:'Unable to load training'});}
});
router.put('/:id',async(req,res)=>{
 try{
 const u=await employee(req,res);if(!u)return;
 const {mandatoryTraining:m,lineTrainerQualifications:l,expectedRevision:v}=req.body;
 if(!Array.isArray(m)||m.length>100||!Array.isArray(l)||l.length>100||!Number.isInteger(v)||v<0)return res.status(400).json({error:'Invalid training update'});
 if(m.some(t=>!code(t.code)||!safe(t.name)||!t.name.trim()||(t.completedOn&&!date(t.completedOn))||(t.validUntil&&!date(t.validUntil))||!safe(t.evidence||'')||!safe(t.notes||'')))return res.status(400).json({error:'Invalid mandatory training'});
 if(l.some(t=>!code(t.airline)||t.airline.length>3||!roles.includes(t.role)||!access.roles({active:true,department:u.department}).includes(t.role)||typeof t.canTrain!=='boolean'||typeof t.canCheck!=='boolean'||(t.validUntil&&!date(t.validUntil))))return res.status(400).json({error:'Invalid Line Trainer qualification'});
 const filter={_id:u._id,trainingRevision:v};
 const result=await User.findOneAndUpdate(filter,{$set:{mandatoryTraining:m,lineTrainerQualifications:l},$inc:{trainingRevision:1}},{new:true,runValidators:true});
 if(!result)return res.status(409).json({error:'Training changed. Reload before saving'});
 res.json({trainingRevision:result.trainingRevision});
 }catch(e){res.status(400).json({error:'Unable to save training'});}
});
router.post('/:id/flights',async(req,res)=>{
 try{
 const u=await employee(req,res);if(!u)return;
 const {airline,role,flightNumber,flightDate,kind,trainer,outcome,notes,expectedRevision}=req.body;
 if(!code(airline)||airline.length>3||!roles.includes(role)||!safe(flightNumber)||!flightNumber.trim()||!date(flightDate)||!['SHADOW','CHECK'].includes(kind)||!['COMPLETED','PASS','FAIL'].includes(outcome)||!safe(notes||'')||!Number.isInteger(expectedRevision)||expectedRevision<0)return res.status(400).json({error:'Invalid flight record'});
 if((kind==='SHADOW'&&outcome!=='COMPLETED')||(kind==='CHECK'&&outcome==='COMPLETED'))return res.status(400).json({error:'Invalid result'});
 const mentor=await User.findById(trainer);
 if(!mentor||mentor.active===false||mentor.department!==u.department||String(mentor._id)===String(u._id))return res.status(400).json({error:'Invalid trainer'});
 const qualified=(mentor.airlineQualifications||[]).some(q=>q.airline===airline&&q.role===role&&(!q.validUntil||q.validUntil>=flightDate));
 const authorised=(mentor.lineTrainerQualifications||[]).some(q=>q.airline===airline&&q.role===role&&q[kind==='CHECK'?'canCheck':'canTrain']&&(!q.validUntil||q.validUntil>=flightDate));
 if(!qualified||!authorised)return res.status(403).json({error:'Trainer lacks valid airline qualification or Train/Check permission'});
 const result=await User.findOneAndUpdate({_id:u._id,trainingRevision:expectedRevision},{$push:{trainingFlights:{airline,role,flightNumber:flightNumber.trim(),flightDate,kind,trainer,outcome,notes:notes||''}},$inc:{trainingRevision:1}},{new:true,runValidators:true});
 if(!result)return res.status(409).json({error:'Training changed. Reload before saving'});
 res.json({trainingRevision:result.trainingRevision});
 }catch(e){res.status(400).json({error:'Unable to record flight'});}
});
module.exports=router;
