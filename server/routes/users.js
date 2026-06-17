const bcrypt =
require("bcryptjs");

const express =
require("express");

const router =
express.Router();

const User =
require("../models/User");

router.get(
"/",
async(req,res)=>{

    const users =
    await User.find()
    .sort({
        name:1
    });

    res.json(users);

});


router.put(
"/:id",
async(req,res)=>{

const updateData = {

    name:req.body.name,

    phone:req.body.phone,

    email:req.body.email,

    department:req.body.department,

    position:req.body.position,

    skills:req.body.skills || [],

    active:req.body.active

};

    if(req.body.password){

        updateData.passwordHash =
        await bcrypt.hash(

            req.body.password,

            10

        );

    }

    const user =
    await User.findByIdAndUpdate(

        req.params.id,

        updateData,

        {
            returnDocument:"after"
        }

    );

    res.json(user);

});

router.get(
"/:id",
async(req,res)=>{

    const user =
    await User.findById(
        req.params.id
    );

    res.json(user);

}); 



router.post(
"/",
async(req,res)=>{

    let passwordHash = "";

    if(req.body.password){

        passwordHash =
        await bcrypt.hash(

            req.body.password,

            10

        );

    }

    const user =
await User.create({

    name:req.body.name,

    phone:req.body.phone,

    email:req.body.email,

    department:req.body.department,

    position:req.body.position,

    skills:req.body.skills || [],

    active:req.body.active,

    passwordHash

});

    res.json(user);

});

module.exports =
router;