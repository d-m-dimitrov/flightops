const time = require("../../client/js/operationalTime");
const Turnaround = require("../models/Turnaround");
const express = require("express");

const router = express.Router();

// Event reads and writes must not be accessible anonymously.
router.use(require("../middleware/requireUser"));

const Event = require("../models/Event");
const Assignment = require("../models/Assignment");
const mongoose = require("mongoose");
const access = require("../services/departmentAccess");

// Operational event changes are limited to staff allocated to that flight.
async function requireFlightAssignment(req,res,next) {
  const flightId = req.method === "POST" ? req.body?.turnaroundId : req.eventForEdit?.turnaroundId;
  if (!mongoose.isObjectIdOrHexString(flightId)) return res.status(400).json({error:"Invalid flight"});
  const flight = await Turnaround.findOne({_id:flightId,deleted:{$ne:true}});
  if (!flight) return res.status(404).json({error:"Flight not found"});
  if (access.superAdmin(req.user) || (req.user.department==="OPERATIONS" && req.user.position==="OPERATIONS_DM")) return next();
  const roles = access.roles(req.user);
  const assigned = await Assignment.exists({turnaroundId:flightId,userId:req.user._id,role:{$in:roles}});
  if (!assigned) return res.status(403).json({error:"You can record events only for flights assigned to you"});
  next();
}
async function loadEventForEdit(req,res,next) {
  if (!mongoose.isObjectIdOrHexString(req.params.id)) return res.status(400).json({error:"Invalid event"});
  req.eventForEdit=await Event.findById(req.params.id);
  if (!req.eventForEdit) return res.status(404).json({error:"Event not found"});
  next();
}

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

router.put("/:id", loadEventForEdit, requireFlightAssignment, async (req, res) => {
    const event = req.eventForEdit;
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

router.post("/", requireFlightAssignment, async (req, res) => {

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

            createdBy: req.user._id,

            notes: req.body.notes || ""

        });

        const ChatMessage =
require("../models/ChatMessage");

const user = req.user;
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