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
        role:{type:String,enum:['DISPATCH','ARRIVAL_DISPATCH','CHECKIN','GATE','ARRIVAL','ARRIVAL_RAMP','RAMP','SPUR'],required:true},
        validUntil:{type:String,default:null}
    },{_id:false})],default:[]},
    mandatoryTraining:{type:[new mongoose.Schema({
        code:{type:String,required:true},name:{type:String,required:true},
        completedOn:{type:String,default:null},validUntil:{type:String,default:null},
        evidence:{type:String,default:''},notes:{type:String,default:''}
    },{_id:false})],default:[]},
    lineTrainerQualifications:{type:[new mongoose.Schema({
        airline:{type:String,required:true},
        role:{type:String,required:true,enum:['DISPATCH','ARRIVAL_DISPATCH','CHECKIN','GATE','ARRIVAL','ARRIVAL_RAMP','RAMP','SPUR']},
        canTrain:{type:Boolean,default:false},canCheck:{type:Boolean,default:false},
        validUntil:{type:String,default:null}
    },{_id:false})],default:[]},
    trainingFlights:{type:[new mongoose.Schema({
        airline:{type:String,required:true},role:{type:String,required:true},
        flightNumber:{type:String,required:true},flightDate:{type:String,required:true},
        kind:{type:String,enum:['SHADOW','CHECK'],required:true},
        trainer:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true},
        outcome:{type:String,enum:['COMPLETED','PASS','FAIL'],required:true},
        notes:{type:String,default:''},recordedAt:{type:Date,default:Date.now}
    },{_id:true})],default:[]},
    trainingNotRequired:{type:[String],default:[]},
    trainingRevision:{type:Number,default:0},
    qualificationRevision:{type:Number,default:0},
    qualificationsUpdatedAt:Date,
    qualificationsUpdatedBy:{type:mongoose.Schema.Types.ObjectId,ref:'User'},

    lastLoginAt:Date,
    sessionVersion:{type:Number,default:0},
    passwordHash:String

},{
    timestamps:true
});

module.exports =
mongoose.model(
    "User",
    UserSchema
);