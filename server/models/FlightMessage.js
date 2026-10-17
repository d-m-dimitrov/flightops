const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  turnaroundId:{type:mongoose.Schema.Types.ObjectId,ref:'Turnaround',required:true},
  type:{type:String,enum:['MVT','CPM','LDM','UCM'],required:true},
  direction:{type:String,enum:['ARRIVAL','DEPARTURE'],required:true},
  text:{type:String,required:true,maxlength:30000},
  createdBy:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true},
  createdByName:{type:String,required:true},
  requestId:{type:String,required:true}
},{timestamps:true});
schema.index({turnaroundId:1,_id:-1});
schema.index({turnaroundId:1,createdBy:1,requestId:1},{unique:true});
module.exports=mongoose.model('FlightMessage',schema);
