const mongoose=require('mongoose');
const item=new mongoose.Schema({
 userId:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true},
 date:{type:String,required:true},
 status:{type:String,enum:['EARLY','DAY','LATE','OFF'],required:true},
 startTime:{type:String,default:null},
 originalRevision:{type:Number,default:0},
 changed:{type:Boolean,default:false}
},{_id:false});
const schema=new mongoose.Schema({
 department:{type:String,required:true},month:{type:String,required:true},
 createdBy:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true},
 entries:{type:[item],default:[]},status:{type:String,enum:['DRAFT','PUBLISHED'],default:'DRAFT'},
 revision:{type:Number,default:1},publishedAt:Date,publishedBy:{type:mongoose.Schema.Types.ObjectId,ref:'User'}
},{timestamps:true});
schema.index({department:1,month:1},{unique:true});
module.exports=mongoose.model('RosterDraft',schema);
