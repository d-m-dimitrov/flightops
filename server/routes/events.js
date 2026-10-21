const time = require("../../client/js/operationalTime");
const Turnaround = require("../models/Turnaround");
const express = require("express");

const router = express.Router();

// Event reads and writes must not be accessible anonymously.
router.use(require("../middleware/requireUser"));

const Event = require("../models/Event");

const processEvent =
require("../services/eventProcessor");

router.get("/:turnaroundId", async(req,res)=>{

    try{

        const events =
        await Event.find({

            turnaroundId:
            req.params.turnaroundId

        })
        .sort({
            eventTime:1
        })
        .populate(
    "createdBy",
    "name"
);

        res.json(events);

    }
    catch(err){

        res.status(500).json({
            error:err.message
        });

    }

});

router.get("/:turnaroundId/existing", async (req, res) => {

    const events = await Event.find({
        turnaroundId: req.params.turnaroundId
    });

    res.json(
        events.map(e => e.eventType)
    );

});

router.put("/:id", async (req, res) => {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ error:"Event not found" });
    let eventTime;
    try {
        eventTime = time.editedTime(req.body.eventTime, event.eventTime, req.body.timeDisambiguation);
        if (!eventTime) throw new Error("Event time is required");
        if (eventTime.getTime() > Date.now()) throw new Error("An actual event cannot be in the future");
    } catch (error) { return res.status(400).json({ error:error.message }); }
    const paths = {
        LANDED:"arrival.ata", ON_BLOCKS:"arrival.onBlocks", FIRST_PAX_OFF:"arrival.firstPaxOff",
        LAST_PAX_OFF:"arrival.lastPaxOff", FIRST_BAG:"arrival.firstBag", LAST_BAG:"arrival.lastBag",
        CHECKIN_OPEN:"departure.checkinOpen", CHECKIN_CLOSE:"departure.checkinClose",
        BOARDING_START:"departure.boardingStart", BOARDING_COMPLETE:"departure.boardingComplete",
        LOAD_COMPLETE:"departure.loadComplete", LOADING_COMPLETE:"departure.loadComplete",
        DOORS_CLOSED:"departure.doorsClosed", PUSHBACK:"departure.pushback", AIRBORNE:"departure.airborne"
    };
    // Event is the authoritative timestamp. Await both writes before notifying clients.
    event.eventTime = eventTime;
    event.notes = req.body.notes || "";
    await event.save();
    if (paths[event.eventType]) {
        const update = { [paths[event.eventType]]:eventTime };
        if (event.eventType === "AIRBORNE") update["departure.atd"] = eventTime;
        await Turnaround.updateOne({ _id:event.turnaroundId }, { $set:update }, { runValidators:true });
    }
    req.app.get("io").to(event.turnaroundId.toString()).emit("flightUpdated");
    res.json(event);
});
router.get(
"/:turnaroundId/:eventType",
async(req,res)=>{

    const event =
    await Event.findOne({

        turnaroundId:
        req.params.turnaroundId,

        eventType:
        req.params.eventType

    });

    res.json(event);

});

router.post("/", async (req, res) => {

    try {

        const existing =
await Event.findOne({

    turnaroundId:
    req.body.turnaroundId,

    eventType:
    req.body.eventType

});

if(existing){

    return res.status(400).json({

        error:
        "Event already exists"

    });

}
        const event = await Event.create({

            turnaroundId: req.body.turnaroundId,

            eventType: req.body.eventType,

            eventTime: new Date(),

            createdBy: req.body.createdBy,

            notes: req.body.notes || ""

        });

        const ChatMessage =
require("../models/ChatMessage");

const User =
require("../models/User");

console.log(
    "EVENT BODY:",
    req.body
);

const user =
await User.findById(
    req.body.createdBy
);

console.log(
    "CREATED BY:",
    req.body.createdBy
);

console.log(
    "USER FOUND:",
    user
);
const addSystemMessage =
require(
    "../services/systemMessage"
);

await addSystemMessage(

    req,

    req.body.turnaroundId,

    `${user.name}
     completed ${req.body.eventType}`,

    "EVENT"

);

        await processEvent(

    req.body.turnaroundId,

    req.body.eventType,

    event.eventTime

);


req.app
.get("io")
.to(
    req.body.turnaroundId
)
.emit(
    "flightUpdated"
);


        res.status(201).json(event);

    }
    catch(err){

        res.status(500).json({
            error: err.message
        });

    }

});

module.exports = router;