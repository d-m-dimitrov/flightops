const mongoose = require("mongoose");

const StaffAssignmentSchema = new mongoose.Schema({

    turnaroundId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Turnaround",
        required: true
    },

    role: {
        type: String,
        required: true
    },

    name: {
        type: String,
        required: true
    },

    phone: String,

    email: String,

    assignedBy: String

},{
    timestamps:true
});

module.exports =
mongoose.model(
    "StaffAssignment",
    StaffAssignmentSchema
);