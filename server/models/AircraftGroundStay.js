const mongoose=require('mongoose');

// AOG lifecycle belongs to a physical aircraft and its original arriving turnaround.
// It does not modify FlightSchedule or link subsequent regular services.
const history=new mongoose.Schema({
 action:{type:String,required:true},by:String,byId:mongoose.Schema.Types.ObjectId,
 at:{type:Date,default:Date.now},details:String
},{_id:false});
const schema=new mongoose.Schema({
 sourceTurnaroundId:{type:mongoose.Schema.Types.ObjectId,ref:'Turnaround',required:true,unique:true},
 recoveryTurnaroundId:{type:mongoose.Schema.Types.ObjectId,ref:'Turnaround',default:null},
 airline:{type:String,required:true,trim:true,uppercase:true},
 registration:{type:String,required:true,trim:true,uppercase:true,index:true},
 aircraftType:String,stand:String,
 arrivalFlight:String,originalDepartureFlight:String,
 originalOperatingDate:String,
 reason:{type:String,enum:['TECHNICAL','OPERATIONAL','WEATHER','CREW','OTHER'],required:true},
 notes:{type:String,maxlength:600,default:''},
 status:{type:String,enum:['GROUNDED','RECOVERY_PLANNED','CLOSED'],default:'GROUNDED',index:true},
 groundedAt:{type:Date,required:true},
 expectedReleaseAt:{type:Date,default:null},
 closedAt:{type:Date,default:null},
 history:[history]
},{timestamps:true});
schema.index({status:1,groundedAt:1});
module.exports=mongoose.model('AircraftGroundStay',schema);
