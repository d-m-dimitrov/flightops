const mongoose =
require("mongoose");

const AssignmentSchema =
new mongoose.Schema({

    turnaroundId:{

        type:
        mongoose.Schema.Types.ObjectId,

        ref:"Turnaround"

    },

    role:String,

    userId:{

        type:
        mongoose.Schema.Types.ObjectId,

        ref:"User"

    }

},{
    timestamps:true
});

module.exports =
mongoose.model(
    "Assignment",
    AssignmentSchema
);