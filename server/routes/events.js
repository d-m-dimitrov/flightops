const express = require("express");

const router = express.Router();

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

router.put("/:id", async(req,res)=>{

    const event =
    await Event.findByIdAndUpdate(

        req.params.id,

        {
           eventTime:
req.body.eventTime,

notes:
req.body.notes
        },

        {
            new:true
        }

    );

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