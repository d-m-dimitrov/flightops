const mongoose = require("mongoose");

const EventDefinitionSchema = new mongoose.Schema({

    code: {
        type: String,
        required: true,
        unique: true
    },

    name: {
        type: String,
        required: true
    },

    group: {
        type: String,
        required: true
    },

    roles: [String],

    readinessPoints: {
        type: Number,
        default: 0
    },

    active: {
        type: Boolean,
        default: true
    }

},{
    timestamps:true
});

module.exports =
mongoose.model(
    "EventDefinition",
    EventDefinitionSchema
);