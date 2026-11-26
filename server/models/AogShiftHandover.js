const mongoose=require('mongoose');
const receipt=new mongoose.Schema({
 userId:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true},
 name:{type:String,required:true},
 receivedAt:{type:Date,default:Date.now}
},{_id:false});
const schema=new mongoose.Schema({
 groundStayId:{type:mongoose.Schema.Types.ObjectId,ref:'AircraftGroundStay',required:true,index:true},
 revision:{type:Number,required:true,min:1},
 notes:{type:String,required:true,trim:true,maxlength:2000},
 sentBy:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true},
 sentByName:{type:String,required:true},
 receipts:{type:[receipt],default:[]}
},{timestamps:true});
schema.index({groundStayId:1,revision:1},{unique:true});
module.exports=mongoose.model('AogShiftHandover',schema);
