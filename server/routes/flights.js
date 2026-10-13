const time = require("../../client/js/operationalTime");
const resolveMgt = require("../services/getTurnaroundRule");
const turnaroundView = require("../services/turnaroundView");
const express =
require("express");

const router =
express.Router();

const Turnaround =
require("../models/Turnaround");

const ChatMessage =
require("../models/ChatMessage");

const calculateReadiness =
require(
    "../services/readinessCalculator"
);
const Event =
require("../models/Event");

const addSystemMessage =
require(
    "../services/systemMessage"
);

router.get(
"/:id/readiness",
async(req,res)=>{

    const readiness =
    await calculateReadiness(
        req.params.id
    );

    res.json(
        readiness
    );


});

router.get(
"/",
async(req,res)=>{

    const date =
    req.query.date ||

    time.operatingDate();

const flights =
await Turnaround.find({

    operatingDate:
    date,

    deleted:{
            $ne:true
        }

})

    .sort({

        "departure.std":1

    });

   const result = [];

for(const flight of flights){

    const item =
    await turnaroundView(flight);

const readiness =
await calculateReadiness(
    flight._id
);

item.readiness =
readiness.percentage;

    result.push(item);

}

result.sort((a, b) => {
    const first = Date.parse(a.departure?.stdAt), second = Date.parse(b.departure?.stdAt);
    return (Number.isFinite(first) ? first : Infinity) - (Number.isFinite(second) ? second : Infinity);
});
res.json(result);

});

router.post("/", async (req, res) => {
    let times, mgt;
    try {
        times = time.scheduleTimes(req.body.operatingDate, req.body.sta, req.body.std,
            req.body.departureDayOffset, req.body.timeDisambiguation);
        mgt = await resolveMgt(req.body.airline, req.body.aircraftType);
    } catch (error) { return res.status(400).json({ error:error.message }); }
    const flight = await Turnaround.create({
        operatingDate:req.body.operatingDate, airline:req.body.airline,
        arrivalFlight:req.body.arrivalFlight, departureFlight:req.body.departureFlight,
        departureDayOffset:times.departureDayOffset,
        timeDisambiguation:req.body.timeDisambiguation || "reject", ...mgt,
        arrival:{ sta:req.body.sta, staAt:times.staAt },
        departure:{ std:req.body.std, stdAt:times.stdAt },
        aircraft:{ aircraftType:req.body.aircraftType }, status:"ARRIVING", manual:true
    });
    res.json(flight);
});


router.post(
"/:id/update-status",
async(req,res)=>{
    console.log(
        "UPDATE STATUS CALLED"
    );
    try{

        const flight =
        await Turnaround.findById(
            req.params.id
        );

        const events =
        await Event.find({

            turnaroundId:
            flight._id

        });

        const completed =
        events.map(
            e => e.eventType
        );

        let status =
        "ARRIVING";

        if(completed.includes("ON_BLOCKS"))
            status = "TURNAROUND";

        if(completed.includes("CHECKIN_OPEN"))
            status = "CHECKIN";

        if(completed.includes("BOARDING_START"))
            status = "BOARDING";

        if(completed.includes("DOORS_CLOSED"))
            status = "READY";

        if(completed.includes("PUSHBACK"))
            status = "PUSHBACK";

        if(completed.includes("AIRBORNE"))
            status = "DEPARTED";

        flight.status =
        status;

        await flight.save();

        req.app
.get("io")
.to(
    flight._id.toString()
)
.emit(
    "flightUpdated"
);

        res.json({
            success:true,
            status
        });

    }
    catch(err){

        console.log(
            "UPDATE STATUS ERROR:"
        );

        console.log(err);

        res.status(500).json({
            error:err.message
        });

    }

});

router.post(
"/:id/cancel",
async(req,res)=>{

    const flight =
    await Turnaround.findById(
        req.params.id
    );

    flight.status =
    "CANCELLED";


    await flight.save();

req.app
.get("io")
.to(
    flight._id.toString()
)
.emit(
    "flightUpdated"
);

    res.json({
        success:true
    });

});

router.post(
"/:id/delete",
async(req,res)=>{

    const flight =
    await Turnaround.findById(
        req.params.id
    );

    if(!flight){

        return res
        .status(404)
        .json({
            error:"Flight not found"
        });

    }

    flight.deleted =
    true;

    await flight.save();

    await ChatMessage.create({

        turnaroundId:
        flight._id,

        messageType:
        "SYSTEM",

        message:

        `${req.body.updatedByName}
        deleted flight`

    });

    res.json({
        success:true
    });

});


router.put(
"/:id/passengers",
async(req,res)=>{

    const flight =
    await Turnaround.findById(
        req.params.id
    );

    flight.passengers =
    req.body;

    await flight.save();
await addSystemMessage(

    req,

    flight._id,

    `${req.body.updatedByName}
     updated passenger figures`

);

req.app
.get("io")
.to(
    flight._id.toString()
)
.emit(
    "flightUpdated"
);


    res.json(
        flight
    );

});

router.get("/:id/operational", async (req, res) => {
    const flight = await Turnaround.findById(req.params.id);
    if (!flight || flight.deleted) return res.status(404).json({ error:"Flight not found" });
    const [events, readiness] = await Promise.all([
        Event.find({ turnaroundId:flight._id }).sort({ eventTime:1 }).populate("createdBy", "name"),
        calculateReadiness(flight._id)
    ]);
    const result = await turnaroundView(flight);
    result.readiness = readiness.percentage;
    result.readinessDetails = readiness;
    res.json({ flight:result, events });
});

router.get("/:id",
async(req,res)=>{

    const flight =
    await Turnaround.findById(
        req.params.id
    );

    const readiness =
    await calculateReadiness(
        req.params.id
    );

    const result =
    await turnaroundView(flight);

   result.readiness =
readiness.percentage;

result.readinessDetails =
readiness;

    res.json(result);

});


router.put(
"/:id/special-handling",
async(req,res)=>{

    const flight =
    await Turnaround.findById(
        req.params.id
    );

    flight.specialHandling =
    req.body;

    await flight.save();

await addSystemMessage(

    req,

    flight._id,

    `${req.body.updatedByName}
     updated special handling`

);
req.app
.get("io")
.to(
    flight._id.toString()
)
.emit(
    "flightUpdated"
);

    res.json(
        flight
    );

});

router.put(
"/:id/details",
async(req,res)=>{

    const flight =
    await Turnaround.findById(
        req.params.id
    );

    if (!flight) return res.status(404).json({ error:"Flight not found" });
    let eta, ata, etd, mgt;
    try {
        eta = time.editedTime(req.body.eta, flight.arrival.eta, req.body.timeDisambiguation);
        ata = time.editedTime(req.body.ata, flight.arrival.ata, req.body.timeDisambiguation);
        etd = time.editedTime(req.body.etd, flight.departure.etd, req.body.timeDisambiguation);
        if (req.body.aircraftType !== flight.aircraft.aircraftType) {
            mgt = await resolveMgt(flight.airline, req.body.aircraftType);
        }
    } catch (error) { return res.status(400).json({ error:error.message }); }
    flight.aircraft.aircraftType = req.body.aircraftType;
    flight.aircraft.registration = req.body.registration;
    flight.aircraft.stand = req.body.stand;
    flight.arrival.eta = eta;
    flight.arrival.ata = ata;
    flight.departure.etd = etd;
    if (mgt) Object.assign(flight, mgt);

    await flight.save();

await addSystemMessage(

    req,

    flight._id,

    `${req.body.updatedByName}
     updated flight details`

);
req.app
.get("io")
.to(
    flight._id.toString()
)
.emit(
    "flightUpdated"
);

    res.json(
        flight
    );

});

router.put(
"/:id/special-handling-details",
async(req,res)=>{

    const flight =
    await Turnaround.findById(
        req.params.id
    );

    flight.specialHandlingDetails =
    req.body.details;

    await flight.save();

await addSystemMessage(

    req,

    flight._id,

    `${req.body.updatedByName}
     updated special handling`

);

    req.app
.get("io")
.to(
    flight._id.toString()
)
.emit(
    "flightUpdated"
);


    res.json(
        flight
    );

});

router.post(
"/:id/mark-read",
async(req,res)=>{

    await Turnaround.findByIdAndUpdate(

        req.params.id,

        {

            unreadNotifications:0

        }

    );

    res.json({
        success:true
    });
    console.log(
    "MARK READ:",
    req.params.id
);

});


module.exports = router;