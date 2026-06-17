const mongoose = require("mongoose");

const EventSchema = new mongoose.Schema({

    turnaroundId: {

        type: mongoose.Schema.Types.ObjectId,

        ref: "Turnaround",

        required: true
    },

    eventType: {

        type: String,

        required: true
    },

    eventTime: {

        type: Date,

        required: true
    },

    value: {

        type: String,

        default: ""
    },

    notes: {

        type: String,

        default: ""
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
    "Event",
    EventSchema
);