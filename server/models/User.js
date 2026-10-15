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

    airlineQualifications:{type:[new mongoose.Schema({
        airline:{type:String,required:true},
        role:{type:String,enum:['DISPATCH','ARRIVAL_DISPATCH','CHECKIN','GATE','ARRIVAL','RAMP','SPUR'],required:true},
        validUntil:{type:String,default:null}
    },{_id:false})],default:[]},
    qualificationRevision:{type:Number,default:0},
    qualificationsUpdatedAt:Date,
    qualificationsUpdatedBy:{type:mongoose.Schema.Types.ObjectId,ref:'User'},

    passwordHash:String

},{
    timestamps:true
});

module.exports =
mongoose.model(
    "User",
    UserSchema
);