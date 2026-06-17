const ChatMessage =
require("../models/ChatMessage");

async function addSystemMessage(

    turnaroundId,
    message,
    systemCode

){

    await ChatMessage.create({

        turnaroundId,

        message,

        systemCode,

        messageType:"SYSTEM"

    });

}

module.exports = {

    addSystemMessage

};