const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  userId:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true},
  date:{type:String,required:true},
  status:{type:String,enum:['WORKING','OFF','ABSENT'],required:true},
  start:Date,end:Date,
  breaks:{type:[new mongoose.Schema({start:Date,end:Date},{_id:false})],default:[]},
  revision:{type:Number,required:true},
  updatedBy:{type:mongoose.Schema.Types.ObjectId,ref:'User'},updatedByName:String
},{timestamps:true});
schema.index({userId:1,date:1},{unique:true});
module.exports = mongoose.model('StaffShift',schema);
