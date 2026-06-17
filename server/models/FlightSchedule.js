const mongoose = require("mongoose");

const FlightScheduleSchema =
new mongoose.Schema({

    airline: String,

    arrivalFlight: String,

    departureFlight: String,

    origin: String,

    destination: String,

    aircraftType: String,

    sta: String,

    std: String,

    daysOfWeek: [Number],

    active: {
        type: Boolean,
        default: true
    }

},{
    timestamps:true
});

module.exports =
mongoose.model(
    "FlightSchedule",
    FlightScheduleSchema
);