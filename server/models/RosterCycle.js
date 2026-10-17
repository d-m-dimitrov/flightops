const mongoose=require('mongoose');
const schema=new mongoose.Schema({
 userId:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true,unique:true},
 pattern:{type:String,enum:['EE_L L_OO'.replace(' ','') ,'LLLL_OO'],required:true},
 startDate:{type:String,required:true},
 updatedBy:{type:mongoose.Schema.Types.ObjectId,ref:'User'}
},{timestamps:true});
module.exports=mongoose.model('RosterCycle',schema);
