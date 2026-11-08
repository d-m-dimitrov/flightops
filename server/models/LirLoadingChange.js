const mongoose=require('mongoose');
const schema=new mongoose.Schema({
 turnaroundId:{type:mongoose.Schema.Types.ObjectId,required:true,index:true},
 lirId:{type:mongoose.Schema.Types.ObjectId,required:true},
 action:{type:String,enum:['SWAP','MOVE','REPLACE'],required:true},
 from:{type:String,required:true},to:String,replacementUld:String,sourceUld:String,destinationUld:String,
 reason:{type:String,required:true,maxlength:300},
 status:{type:String,enum:['REQUESTED','AUTHORISED','REJECTED','EXECUTED'],default:'REQUESTED'},
 requestedBy:String,requestedAt:{type:Date,default:Date.now},
 reviewedBy:String,reviewedAt:Date,executedBy:String,executedAt:Date
},{timestamps:true});
schema.index({turnaroundId:1,lirId:1,status:1});
module.exports=mongoose.model('LirLoadingChange',schema);
