const mongoose = require("mongoose");

const TurnaroundSchema = new mongoose.Schema({

    airline: String,

    arrivalFlight: String,

    departureFlight: String,

    flightDate: Date,
    
    flightNumberDisplay: String,

    origin: String,

    destination: String,
    manual:{
    type:Boolean,
    default:false
},

    readiness: {
        type: Number,
        default: 0
    },  

    operatingDate:{
    type:String,
    index: true
},

    scheduleId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "FlightSchedule"
    },

    status: {
        type: String,
        default: "SCHEDULED"
    },

aircraft: {

    aircraftType: String,

    registration: String,

    stand: String

},

    arrival: {

        sta: String,
        eta: Date,
        ata: Date,

        onBlocks: Date,

        firstPaxOff: Date,
        lastPaxOff: Date,

        firstBag: Date,
        lastBag: Date

    },

    departure: {

        std: String,

        etd: Date,

        atd: Date,

        checkinOpen: Date,

        checkinClose: Date,

        boardingStart: Date,

        boardingComplete: Date,
        
        loadComplete: Date,

        doorsClosed: Date,

        pushback: Date,

        airborne: Date

    },

passengers: {

    checkedIn:{
        type:Number,
        default:0
    },

    boarded:{
        type:Number,
        default:0
    },

    tob:{
        type:Number,
        default:0
    },

    infants:{
        type:Number,
        default:0
    }

},

specialHandling: {

    liIonMobilityAids:{
        type:Number,
        default:0
    },

    dryCellMobilityAids:{
        type:Number,
        default:0
    },

    avih:{
        type:Number,
        default:0
    },

    umnr:{
        type:Number,
        default:0
    },

    cbbg:{
        type:Number,
        default:0
    },

    weap:{
        type:Number,
        default:0
    },

    vvip:{
        type:Number,
        default:0
    }

},

specialHandlingDetails:{

    wclb:[{
        wh:Number,
        batteryWeight:Number,
        passengerName:String,
        seat:String
    }],

    wcbd:[{
        wh:Number,
        chairWeight:Number,
        bagTag:String,
        passengerName:String,
        seat:String
    }],

    avih:[{
        animalType:String,
        weight:Number,
        bagTag:String,
        passengerName:String,
        seat:String
    }],

    petc:[{
        animalType:String,
        weight:Number,
        passengerName:String,
        seat:String
    }],

    cbbg:[{
        weight:Number,
        seat:String
    }],

    weap:[{
        weaponType:String,
        weight:Number,
        bagTag:String,
        passengerName:String,
        seat:String
    }]

},

},
{
    timestamps: true
});

module.exports = mongoose.model(
    "Turnaround",
    TurnaroundSchema
);