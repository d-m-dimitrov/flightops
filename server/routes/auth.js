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

    if(!user){

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

        department:user.department,

        position:user.position,

        skills:user.skills || []

    },

    process.env.JWT_SECRET,

    {

        expiresIn:"7d"

    }

);

    res.json({

        token,

        user:{

    _id:user._id,

    name:user.name,

    email:user.email,

    department:user.department,

    position:user.position,

    skills:user.skills || []

}

    });

});


module.exports =
router;