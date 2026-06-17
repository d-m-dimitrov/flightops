const express =
require("express");

const router =
express.Router();

const Assignment =
require("../models/Assignment");

const User =
require("../models/User");

const ChatMessage =
require("../models/ChatMessage");



router.get(
"/:turnaroundId",
async(req,res)=>{

    const assignments =
    await Assignment.find({

        turnaroundId:
        req.params.turnaroundId

    })
    .populate(
        "userId"
    );

    res.json(
        assignments
    );

});

router.post(
"/:turnaroundId",
async(req,res)=>{

    const turnaroundId =
    req.params.turnaroundId;

    const {

        assignments,
        updatedByName

    } = req.body;

    const existing =
    await Assignment.find({

        turnaroundId

    })
    .populate(
        "userId",
        "name"
    );

    const oldMap = {};

    existing.forEach(a=>{

        oldMap[a.role] = {

            userId:
            a.userId?._id?.toString(),

            name:
            a.userId?.name

        };

    });

    await Assignment.deleteMany({

        turnaroundId

    });

    for(const item of assignments){

        await Assignment.create({

            turnaroundId,

            role:item.role,

            userId:item.userId

        });

        const newUser =
        await User.findById(
            item.userId
        );

        const old =
        oldMap[item.role];

        if(!old){

            await ChatMessage.create({

                turnaroundId,

                messageType:
                "SYSTEM",

                message:

                `${updatedByName} assigned ${newUser.name} to ${item.role}`

            });

        }
        else if(

            old.userId !==
            item.userId

        ){

            await ChatMessage.create({

                turnaroundId,

                messageType:
                "SYSTEM",

                message:

                `${updatedByName} reassigned ${item.role} from ${old.name} to ${newUser.name}`

            });

        }

        delete oldMap[
            item.role
        ];

    }

    for(const role in oldMap){

        await ChatMessage.create({

            turnaroundId,

            messageType:
            "SYSTEM",

            message:

            `${updatedByName} removed ${role} assignment (${oldMap[role].name})`

        });

    }
    req.app
.get("io")
.to(
    turnaroundId
)
.emit(
    "flightUpdated"
);

    res.json({
        success:true
    });

});


module.exports =
router;