const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  turnaroundId:{ type:mongoose.Schema.Types.ObjectId, ref:'Turnaround', required:true },
  revision:{ type:Number, required:true },
  kind:{ type:String, enum:['text','pdf'], required:true },
  filename:{ type:String, required:true },
  byteLength:Number,
  original:{ type:Buffer, required:true, select:false },
  uploadedBy:{ type:mongoose.Schema.Types.ObjectId, ref:'User', required:true },
  uploadedByName:String,
  annotationVersion:{ type:Number, default:0 },
  annotations:{ type:[mongoose.Schema.Types.Mixed], default:[] },
  signature:{ type:[mongoose.Schema.Types.Mixed], default:[] },
  status:{ type:String, enum:['UPLOADED','IN_PROGRESS','COMPLETED'], default:'UPLOADED' },
  updatedBy:{ type:mongoose.Schema.Types.ObjectId, ref:'User' },
  updatedByName:String,
  signedBy:{ type:mongoose.Schema.Types.ObjectId, ref:'User' },
  signedByName:String,
  signedAt:Date
}, { timestamps:true });
schema.index({ turnaroundId:1, revision:1 }, { unique:true });
module.exports = mongoose.model('Lir', schema);
