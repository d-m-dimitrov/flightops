const express =
require("express");

const router =
express.Router();

const EventDefinition =
require("../models/EventDefinition");

router.get("/",
async(req,res)=>{

    const events =
    await EventDefinition.find({
        active:true
    });

    res.json(events);

});

module.exports = router;