const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  turnaroundId: { type: mongoose.Schema.Types.ObjectId, ref: 'Turnaround', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  readMessageIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'ChatMessage' }]
}, { timestamps: true });
schema.index({ turnaroundId: 1, userId: 1 }, { unique: true });
module.exports = mongoose.model('ChatReadState', schema);
