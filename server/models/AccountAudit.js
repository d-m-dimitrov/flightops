const mongoose=require('mongoose');
const schema=new mongoose.Schema({
 actor:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true},
 target:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true},
 action:{type:String,enum:['ACCOUNT_UPDATED'],required:true},
 changes:{type:[String],default:[]}
},{timestamps:true});
schema.index({createdAt:-1});
module.exports=mongoose.model('AccountAudit',schema);
