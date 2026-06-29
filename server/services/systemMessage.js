const ChatMessage =
require("../models/ChatMessage");

module.exports = async function(

    req,

    turnaroundId,

    message,

    type = "SYSTEM"

){

    await ChatMessage.create({

        turnaroundId,

        messageType:type,

        message

    });

    const Turnaround =
require("../models/Turnaround");

await Turnaround.findByIdAndUpdate(

    turnaroundId,

    {

        $inc:{
            unreadNotifications:1
        }

    }

);
const test =
await Turnaround.findById(
    turnaroundId
);

console.log(
    "UNREAD:",
    test.unreadNotifications
);

    const io =
    req.app.get("io");

    io.to(
        turnaroundId.toString()
    ).emit(

        "newChatMessage",

        {

            turnaroundId,

            author:"System",

            message,

            type

        }

    );

};


