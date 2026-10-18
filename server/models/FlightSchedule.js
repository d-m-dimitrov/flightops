const mongoose = require("mongoose");

const FlightScheduleSchema =
new mongoose.Schema({

    airline: String,

    arrivalFlight: String,

    departureFlight: String,

    origin: String,

    destination: String,

    aircraftType: String,
    arrivalFlightType:{type:String,enum:['PASSENGER','CARGO','FERRY','OTHER'],default:'PASSENGER'},
    departureFlightType:{type:String,enum:['PASSENGER','CARGO','FERRY','OTHER'],default:'PASSENGER'},
    serviceType:{type:String,enum:['SCHEDULED','CHARTER','AD_HOC'],default:'SCHEDULED'},
    validFrom:{type:String,match:/^\d{4}-\d{2}-\d{2}$/},
    validTo:{type:String,match:/^\d{4}-\d{2}-\d{2}$/},

    sta: String,

    std: String,

    departureDayOffset: { type:Number, min:0, max:7, validate:Number.isInteger },
    timeDisambiguation: { type:String, enum:["reject","earlier","later"], default:"reject" },

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