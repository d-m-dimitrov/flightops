const ChatMessage = require('../models/ChatMessage');
const ChatReadState = require('../models/ChatReadState');

function countUnread(messages, states, userId) {
  const read = new Map(states.filter(s => String(s.userId) === String(userId)).map(s => [String(s.turnaroundId), new Set(s.readMessageIds.map(String))]));
  const counts = new Map();
  for (const m of messages) {
    const id = String(m.turnaroundId);
    if (String(m.userId) !== String(userId) && !read.get(id)?.has(String(m._id))) {
      counts.set(id, (counts.get(id) || 0) + 1);
    }
  }
  return counts;
}
async function unreadCounts(flightIds, userId) {
  const [messages, states] = await Promise.all([
    ChatMessage.find({turnaroundId: {$in: flightIds}}).select('_id turnaroundId userId').lean(),
    ChatReadState.find({turnaroundId: {$in: flightIds}, userId}).lean()
  ]);
  return countUnread(messages, states, userId);
}
async function markRead(turnaroundId, userId, messageIds) {
  if (!Array.isArray(messageIds) || messageIds.length > 500 || messageIds.some(id => !/^[a-f\d]{24}$/i.test(id))) {
    throw Object.assign(new Error('Expected up to 500 message IDs'), {status: 400});
  }
  const ids = [...new Set(messageIds.map(id => id.toLowerCase()))];
  if (!ids.length) return;
  const messages = await ChatMessage.find({turnaroundId, _id: {$in: ids}}).select('_id').lean();
  if (messages.length !== ids.length) throw Object.assign(new Error('Message does not belong to this flight'), {status: 400});
  const filter = {turnaroundId, userId};
  const update = {$addToSet: {readMessageIds: {$each: ids}}};
  try { await ChatReadState.updateOne(filter, update, {upsert: true}); }
  catch (error) {
    if (error.code !== 11000) throw error;
    await ChatReadState.updateOne(filter, update);
  }
}
module.exports = {countUnread, unreadCounts, markRead};
