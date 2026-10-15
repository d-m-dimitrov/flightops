const express=require('express');
const Shift=require('../models/StaffShift'),User=require('../models/User');
const access=require('../services/assignmentAccess'),shifts=require('../services/staffShifts');
const dates=require('../../client/js/operationalTime'),qualifications=require('../../client/js/airlineQualifications');
const router=express.Router();
router.use(require('../middleware/requireUser'));
router.use((req,res,next)=>{res.set('Cache-Control','no-store');if(!access(req.user).length)return res.status(403).json({error:'Roster access requires an allocation or duty manager role'});next();});
router.get('/',async(req,res)=>{
  const date=req.query.date;
  if(!qualifications.date(date))return res.status(400).json({error:'Select a valid date'});
  const rows=await Shift.find({date:{$gte:dates.addDays(date,-1),$lte:dates.addDays(date,1)}}).lean();
  res.json({date,shifts:rows});
});
router.post('/copy-preview',async(req,res)=>{
  const date=req.body?.date;
  if(!qualifications.date(date))return res.status(400).json({error:'Select a valid target date'});
  const previous=dates.addDays(date,-1);
  const [source,target,staff]=await Promise.all([
    Shift.find({date:previous,status:'WORKING'}).lean(),Shift.find({date}).lean(),User.find({active:true}).select('name department').lean()
  ]);
  const existing=new Set(target.map(s=>String(s.userId))),users=new Map(staff.map(u=>[String(u._id),u]));
  const items=[],skipped=[];
  for(const row of source){
    const user=users.get(String(row.userId));
    if(!user || !shifts.canManage(req.user,user))continue;
    if(existing.has(String(row.userId))){skipped.push({name:user.name,reason:'Target date already has a record'});continue;}
    try{
      const input=shifts.copyInput(row,date);shifts.validate(input);
      items.push({userId:user._id,name:user.name,input});
    }catch(error){skipped.push({name:user.name,reason:error.message});}
  }
  res.json({date,sourceDate:previous,items,skipped});
});
router.put('/:userId',async(req,res)=>{
  if(!/^[a-f\d]{24}$/i.test(req.params.userId))return res.status(400).json({error:'Invalid employee'});
  const user=await User.findById(req.params.userId).select('name department active');
  if(!user?.active)return res.status(404).json({error:'Active employee not found'});
  if(!shifts.canManage(req.user,user))return res.status(403).json({error:'You can manage shifts only for your department'});
  let value;
  try{value=shifts.validate(req.body);}catch(error){return res.status(400).json({error:error.message});}
  const revision=req.body.expectedRevision,key={userId:user._id,date:value.date};
  value={...value,updatedBy:req.user._id,updatedByName:req.user.name};
  try{
    const row=revision===0
      ? await Shift.findOneAndUpdate(key,{$setOnInsert:{...key,...value,revision:1,createdAt:new Date(),updatedAt:new Date()}},{upsert:true,new:false,runValidators:true,timestamps:false})
      : await Shift.findOneAndUpdate({...key,revision},{$set:value,$inc:{revision:1}},{new:true,runValidators:true});
    if((revision===0 && row) || (revision>0 && !row))return res.status(409).json({error:'Shift changed. Reopen it before saving.'});
    res.json({success:true,revision:revision+1});
  }catch(error){if(error.code===11000)return res.status(409).json({error:'Shift was added by another user. Reopen it.'});throw error;}
});
module.exports=router;
