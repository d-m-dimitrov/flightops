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


module.exports =
router;