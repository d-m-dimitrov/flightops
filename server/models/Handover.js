const mongoose=require('mongoose');
const schema=new mongoose.Schema({
  turnaroundId:{type:mongoose.Schema.Types.ObjectId,ref:'Turnaround',required:true},
  revision:{type:Number,required:true},
  assignmentId:{type:mongoose.Schema.Types.ObjectId,required:true},
  sentBy:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true},sentByName:String,
  checkedIn:{type:Number,required:true},infants:{type:Number,required:true},bags:{type:Number,required:true},notes:String,
  receipts:{type:[new mongoose.Schema({assignmentId:mongoose.Schema.Types.ObjectId,userId:mongoose.Schema.Types.ObjectId,name:String,receivedAt:Date},{_id:false})],default:[]}
},{timestamps:true});
schema.index({turnaroundId:1,revision:1},{unique:true});
module.exports=mongoose.model('Handover',schema);
