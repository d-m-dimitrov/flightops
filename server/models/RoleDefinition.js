const mongoose =
require("mongoose");

const RoleDefinitionSchema =
new mongoose.Schema({

    code:{
        type:String,
        required:true,
        unique:true
    },

    name:{
        type:String,
        required:true
    },

    active:{
        type:Boolean,
        default:true
    }

});

module.exports =
mongoose.model(
    "RoleDefinition",
    RoleDefinitionSchema
);