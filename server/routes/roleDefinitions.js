const express =
require("express");

const router =
express.Router();

const RoleDefinition =
require("../models/RoleDefinition");

router.get(
"/",
async(req,res)=>{

    const roles =
    await RoleDefinition.find({
        active:true
    });

    res.json(roles);

});

module.exports =
router;