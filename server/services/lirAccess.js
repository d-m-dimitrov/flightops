const Assignment = require('../models/Assignment');
// Fail closed on ambiguous legacy assignments: the dashboard may display only one.
module.exports = async function canAnnotate(user, turnaroundId) {
  if (!user?.active || user.department !== 'RAMP' || !user._id) return false;
  const assignments = await Assignment.find({ turnaroundId, role:'RAMP' }).select('userId').limit(2).lean();
  return assignments.length === 1 && String(assignments[0].userId) === String(user._id);
};
