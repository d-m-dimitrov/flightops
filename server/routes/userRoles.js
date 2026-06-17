const express =
require("express");

const router =
express.Router();

const UserRole =
require("../models/UserRole");

router.get(
"/:userId",
async(req,res)=>{

    const roles =
    await UserRole.find({

        userId:
        req.params.userId

    });

    res.json(roles);

});

router.post(
"/",
async(req,res)=>{

    await UserRole.deleteMany({

        userId:
        req.body.userId

    });

    for(const role of req.body.roles){

        await UserRole.create({

            userId:
            req.body.userId,

            role

        });

    }

    res.json({
        success:true
    });

});

module.exports =
router;