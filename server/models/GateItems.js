const mongoose=require('mongoose');
const item=new mongoose.Schema({type:{type:String,enum:['BAG','STROLLER','WHEELCHAIR'],required:true},tag:{type:String,required:true},status:{type:String,enum:['SUBMITTED','RECEIVED','LOADED','CANCELLED'],required:true},submittedAt:Date,submittedByName:String,receivedAt:Date,receivedByName:String,loadedAt:Date,loadedByName:String,cancelledAt:Date,cancelledByName:String});
const history=new mongoose.Schema({itemId:mongoose.Schema.Types.ObjectId,type:String,tag:String,action:String,userId:mongoose.Schema.Types.ObjectId,name:String,assignmentId:mongoose.Schema.Types.ObjectId,at:Date},{_id:false});
const schema=new mongoose.Schema({turnaroundId:{type:mongoose.Schema.Types.ObjectId,ref:'Turnaround',required:true,unique:true},version:{type:Number,default:0},items:{type:[item],default:[]},history:{type:[history],default:[]}},{timestamps:true});
module.exports=mongoose.model('GateItems',schema);
