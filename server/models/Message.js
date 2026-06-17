const mongoose = require("mongoose");

const MessageSchema = new mongoose.Schema({

    turnaroundId: {

        type: mongoose.Schema.Types.ObjectId,

        ref: "Turnaround",

        required: true
    },

    message: {

        type: String,

        required: true
    },

    createdBy: {

        type: mongoose.Schema.Types.ObjectId,

        ref: "User"
    }

},
{
    timestamps: true
});

module.exports = mongoose.model(
    "Message",
    MessageSchema
);