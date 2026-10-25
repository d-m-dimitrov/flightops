const mongoose = require('mongoose');
const AirlineDirectorySchema = new mongoose.Schema({
 iata:{type:String,required:true,uppercase:true,trim:true},
 icao:{type:String,uppercase:true,trim:true,default:''},
 name:{type:String,required:true,trim:true},
 callsign:String,awbPrefix:String,logoUrl:String,
 station:{type:String,default:'LHR',uppercase:true},
 representatives:[{name:String,position:String,phone:String,email:String,notes:String}],
 services:{type:mongoose.Schema.Types.Mixed,default:{}},
 instructions:{arrival:String,departure:String,aircraft:String,general:String},
 updatedBy:{type:mongoose.Schema.Types.ObjectId,ref:'User'}
},{timestamps:true});
AirlineDirectorySchema.index({iata:1,station:1},{unique:true});
module.exports=mongoose.model('AirlineDirectory',AirlineDirectorySchema);
