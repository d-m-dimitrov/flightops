const express =
require("express");

const router =
express.Router();

const ChatMessage =
require("../models/ChatMessage");

const requireUser = require('../middleware/requireUser');
router.use(requireUser);
router.use('/:turnaroundId', async (req, res, next) => {
    if (!/^[a-f\d]{24}$/i.test(req.params.turnaroundId)) return res.status(400).json({error:'Invalid flight'});
    const flight = await require('../models/Turnaround').findOne({_id:req.params.turnaroundId, deleted:{$ne:true}});
    if (!flight) return res.status(404).json({error:'Flight not found'});
    next();
});

router.get(
"/:turnaroundId",
async(req,res)=>{

    const messages =
    await ChatMessage.find({

        turnaroundId:
        req.params.turnaroundId

    })

    .populate(
        "userId", "name"
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

    if (typeof req.body?.message !== 'string' || !req.body.message.trim() || req.body.message.length > 10000) {
        return res.status(400).json({error:'Enter a message (maximum 10000 characters)'});
    }
    const message =
    await ChatMessage.create({

        turnaroundId:
        req.params.turnaroundId,

        userId:
        req.user._id,

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
        "userId", "name"
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