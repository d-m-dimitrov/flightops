const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  airline: { type: String, required: true },
  aircraftType: { type: String, default: 'ALL' },
  operation: { type: String, enum: ['ARRIVAL', 'DEPARTURE', 'TURNAROUND'], required: true },
  department: { type: String, required: true },
  role: { type: String, default: 'ALL' },
  type: { type: String, enum: ['INFO', 'MANDATORY', 'CHECKLIST'], required: true },
  title: { type: String, required: true },
  body: { type: String, required: true },
  active: { type: Boolean, default: false },
  revision: { type: Number, default: 1 }
}, { timestamps: true });
module.exports = mongoose.model('HandlingInstruction', schema);
