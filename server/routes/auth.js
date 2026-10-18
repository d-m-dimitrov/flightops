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