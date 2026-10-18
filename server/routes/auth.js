const express =
require("express");

const bcrypt =
require("bcryptjs");

const jwt =
require("jsonwebtoken");

const User =
require("../models/User");

const router =
express.Router();
const requireUser = require("../middleware/requireUser");
const StaffShift = require("../models/StaffShift");


router.post(
"/login",
async(req,res)=>{

    const {
        email,
        password
    } = req.body;

    const user =
    await User.findOne({

        email

    });

    if(!user || !user.active){

        return res.status(401)
        .json({
            error:"Invalid login"
        });

    }

    const valid =
    await bcrypt.compare(

        password,

        user.passwordHash

    );

    if(!valid){

        return res.status(401)
        .json({
            error:"Invalid login"
        });

    }

    const token =
jwt.sign(

    {

        id:user._id,
        sessionVersion:user.sessionVersion || 0,

        department:user.department,

        position:user.position,

        skills:user.skills || []

    },

    process.env.JWT_SECRET,

    {

        expiresIn:"7d"

    }

);

    await User.updateOne({_id:user._id},{$set:{lastLoginAt:new Date()}});

    res.json({

        token,

        user:{

    _id:user._id,

    name:user.name,
    role:user.role,
    active:user.active,

    email:user.email,

    department:user.department,

    position:user.position,

    skills:user.skills || []

}

    });

});

router.get('/me',requireUser,async(req,res,next)=>{
 try{
  res.set('Cache-Control','no-store');
  const user=await User.findById(req.user._id).select('name email phone department position role skills airlineQualifications lastLoginAt').lean();
  if(!user)return res.status(404).json({error:'Profile not found'});
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const date=new Date(today+'T12:00:00Z');
  const until=new Date(date);until.setUTCDate(until.getUTCDate()+13);
  const end=until.toISOString().slice(0,10);
  const shifts=await StaffShift.find({userId:req.user._id,date:{$gte:today,$lte:end}}).select('date status start end breaks').sort({date:1}).lean();
  res.json({profile:user,shifts,from:today,to:end});
 }catch(error){next(error);}
});

router.post('/change-password',requireUser,async(req,res,next)=>{
 try{
  const {currentPassword,newPassword,confirmPassword}=req.body || {};
  if(typeof currentPassword!=='string'||typeof newPassword!=='string'||typeof confirmPassword!=='string')return res.status(400).json({error:'All password fields are required'});
  if(newPassword.length<12||newPassword.length>128)return res.status(400).json({error:'New password must be 12–128 characters'});
  if(newPassword!==confirmPassword)return res.status(400).json({error:'New passwords do not match'});
  const account=await User.findById(req.user._id);
  if(!account||!account.active)return res.status(403).json({error:'Account unavailable'});
  if(!account.passwordHash||!await bcrypt.compare(currentPassword,account.passwordHash))return res.status(400).json({error:'Current password is incorrect'});
  if(await bcrypt.compare(newPassword,account.passwordHash))return res.status(400).json({error:'Choose a different password'});
  const passwordHash=await bcrypt.hash(newPassword,12);
  await User.updateOne({_id:account._id,sessionVersion:account.sessionVersion||0},{$set:{passwordHash},$inc:{sessionVersion:1}});
  return res.json({message:'Password changed. Please sign in again'});
 }catch(error){next(error);}
});

module.exports =
router;