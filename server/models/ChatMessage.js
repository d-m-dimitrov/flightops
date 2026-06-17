const mongoose =
require("mongoose");

const ChatMessageSchema =
new mongoose.Schema({

    turnaroundId:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"Turnaround"
    },

    userId:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"User"
    },

    message:{
        type:String,
        required:true
    },

    messageType:{
    type:String,
    default:"USER"
},
systemCode:String

},{
    timestamps:true
});

module.exports =
mongoose.model(
    "ChatMessage",
    ChatMessageSchema
);