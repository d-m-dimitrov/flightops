const express =
require("express");

const router =
express.Router();

const ChatMessage =
require("../models/ChatMessage");

router.get(
"/:turnaroundId",
async(req,res)=>{

    const messages =
    await ChatMessage.find({

        turnaroundId:
        req.params.turnaroundId

    })

    .populate("userId")

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

    req.app
.get("io")
.to(
    req.params.turnaroundId
)
.emit(
    "flightUpdated"
);

    res.json(
        message
    );

});

module.exports =
router;