const mongoose = require("mongoose");

const TurnaroundRuleSchema =
new mongoose.Schema({

    airline:{

        type:String,
        trim:true,
        uppercase:true,

        required:true

    },

    aircraftType:{

        type:String,
        trim:true,
        uppercase:true,

        required:true

    },

    minimumGroundTime:{
        min:1,
        validate:Number.isInteger,

        type:Number,

        required:true

    },

    boardingOpen:{

        type:Number,

        default:35

    },

    boardingClose:{

        type:Number,

        default:15

    },

    doorsClosed:{

        type:Number,

        default:10

    },

    pushbackReady:{

        type:Number,

        default:5

    }

});

module.exports =
mongoose.model(
    "TurnaroundRule",
    TurnaroundRuleSchema
);