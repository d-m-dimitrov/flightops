const express =
require("express");

const router =
express.Router();

const ChatMessage =
require("../models/ChatMessage");

const User =
require("../models/User");

router.get(
"/:turnaroundId",
async(req,res)=>{

    const messages =
    await ChatMessage.find({

        turnaroundId:
        req.params.turnaroundId

    })

    .populate(
        "userId"
    )

    .sort({
        createdAt:1
    });

    res.json(
        messages
    );

});

router.post(
"/:turnaroundId",
async(req,res)=>{

    const message =
    await ChatMessage.create({

        turnaroundId:
        req.params.turnaroundId,

        userId:
        req.body.userId,

        message:
        req.body.message

    });

const Turnaround =
require("../models/Turnaround");

await Turnaround.findByIdAndUpdate(

    req.params.turnaroundId,

    {

        $inc:{
            unreadNotifications:1
        }
        

    }

);

    const populatedMessage =
    await ChatMessage.findById(
        message._id
    )
    .populate(
        "userId"
    );

    const io =
    req.app.get("io");

    io.to(
    req.params.turnaroundId
).emit(

    "newChatMessage",

    {

        turnaroundId:
        req.params.turnaroundId,

        author:
        populatedMessage.userId?.name ||
        "Unknown",

        message:
        populatedMessage.message

    }

);

    io.to(
        req.params.turnaroundId
    ).emit(
        "flightUpdated"
    );

    res.json(
        populatedMessage
    );

});

module.exports =
router;