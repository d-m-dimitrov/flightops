const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const requireUser = require('../middleware/requireUser');
const {superAdmin} = require('../services/departmentAccess');
const router = express.Router();
router.use(requireUser, (req,res,next) => superAdmin(req.user) ? next() : res.status(403).json({error:'Super Admin access required'}));
const safe = user => ({_id:user._id,name:user.name,email:user.email || '',department:user.department,position:user.position,role:user.role,active:user.active,hasLogin:Boolean(user.passwordHash && user.email)});
router.get('/',async(req,res,next)=>{try{res.json((await User.find({}).sort({name:1})).map(safe));}catch(e){next(e);}});
router.patch('/:id',async(req,res,next)=>{
 try{
  const target=await User.findById(req.params.id);
  if(!target)return res.status(404).json({error:'Employee not found'});
  if(target.role==='ADMIN')return res.status(403).json({error:'Super Admin account cannot be changed here'});
  const {email,password,active}=req.body || {};
  if(typeof active!=='boolean')return res.status(400).json({error:'Active status required'});
  if(typeof email!=='string')return res.status(400).json({error:'Email required'});
  const normalized=email.trim().toLowerCase();
  if(normalized && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized))return res.status(400).json({error:'Invalid email'});
  if(password!==undefined && password!=='' && (typeof password!=='string'||password.length<12))return res.status(400).json({error:'Password must be at least 12 characters'});
  if(active && (!normalized || !(password || target.passwordHash)))return res.status(400).json({error:'Active accounts need an email and password'});
  if(normalized && await User.exists({_id:{$ne:target._id},email:{$regex:'^'+normalized.replace(/[.*+?^\u0024{}()|[\]\\]/g,'\\$&')+'$', $options:'i'}}))return res.status(409).json({error:'Email already in use'});
  target.email=normalized || undefined;
  target.active=active;
  if(password)target.passwordHash=await bcrypt.hash(password,12);
  await target.save();
  res.json(safe(target));
 }catch(e){next(e);}
});
module.exports=router;
