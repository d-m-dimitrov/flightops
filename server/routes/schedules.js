function validateSchedule(req, res, next) {
    const { sta, std, departureDayOffset:offset, timeDisambiguation:occurrence } = req.body;
    const validTime = value => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
    if (!validTime(sta) || !validTime(std) ||
        (offset != null && (!Number.isInteger(offset) || offset < 0 || offset > 7)) ||
        (occurrence != null && !["reject","earlier","later"].includes(occurrence)) ||
        (offset === 0 && std <= sta)) {
        return res.status(400).json({ error:"Check STA/STD and departure day (London local time)" });
    }
    const types = ['PASSENGER','CARGO','FERRY','OTHER'];
    const services = ['SCHEDULED','CHARTER','AD_HOC'];
    const {arrivalFlightType,departureFlightType,serviceType,validFrom,validTo} = req.body;
    const dateOk = v => v == null || v === '' || (/^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v+'T00:00:00Z')) && new Date(v+'T00:00:00Z').toISOString().slice(0,10) === v);
    if ((arrivalFlightType != null && !types.includes(arrivalFlightType)) ||
        (departureFlightType != null && !types.includes(departureFlightType)) ||
        (serviceType != null && !services.includes(serviceType)) || !dateOk(validFrom) || !dateOk(validTo) ||
        (validFrom && validTo && validFrom > validTo)) return res.status(400).json({error:'Check flight types, service type and validity dates'});
    next();
}
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
validateSchedule,
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
validateSchedule,
async(req,res)=>{

    const schedule =
    await FlightSchedule.findByIdAndUpdate(

        req.params.id,

        req.body,

        {
            returnDocument:"after",
            runValidators:true
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
            returnDocument:"after",
            runValidators:true
        }

    );

    res.json(
        schedule
    );

});


module.exports = router;