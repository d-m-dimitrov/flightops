const Assignment = require('../models/Assignment');
// A department, skill or administrator role alone never grants annotation access.
module.exports = async function canAnnotate(user, turnaroundId) {
  if (!user?.active || user.department !== 'RAMP' || !user._id) return false;
  return Boolean(await Assignment.exists({ turnaroundId, role:'RAMP', userId:user._id }));
};
