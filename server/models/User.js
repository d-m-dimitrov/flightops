const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({

    name:String,

    phone:String,

    email:String,

    active:{
        type:Boolean,
        default:true
    },

    role:{
        type:String,
        default:"OPERATIONS"
    },

    department:String,

    position:String,

    skills:[String],

    passwordHash:String

},{
    timestamps:true
});

module.exports =
mongoose.model(
    "User",
    UserSchema
);