const express = require("express");

const router = express.Router();

const FlightSchedule =
require("../models/FlightSchedule");

router.get(
"/",
async(req,res)=>{

    const schedules =
    await FlightSchedule.find()
    .sort({
        airline:1,
        arrivalFlight:1
    });

    res.json(
        schedules
    );

});

router.get(
"/:id",
async(req,res)=>{

    const schedule =
    await FlightSchedule.findById(
        req.params.id
    );

    res.json(
        schedule
    );

});

router.post(
"/",
async(req,res)=>{

    const schedule =
    await FlightSchedule.create(
        req.body
    );

    res.json(
        schedule
    );

});


router.put(
"/:id",
async(req,res)=>{

    const schedule =
    await FlightSchedule.findByIdAndUpdate(

        req.params.id,

        req.body,

        {
            returnDocument:"after"
        }

    );

    res.json(
        schedule
    );

});


router.put(
"/:id/deactivate",
async(req,res)=>{

    const schedule =
    await FlightSchedule.findByIdAndUpdate(

        req.params.id,

        {
            active:false
        },

        {
            returnDocument:"after"
        }

    );

    res.json(
        schedule
    );

});


module.exports = router;