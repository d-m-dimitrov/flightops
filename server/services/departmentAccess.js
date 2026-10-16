const departments = {
  OPERATIONS:['DISPATCH','ARRIVAL_DISPATCH'],
  PASSENGER_HANDLING:['CHECKIN','GATE','ARRIVAL'],
  RAMP:['RAMP'], SPUR:['SPUR']
};
const managers = {OPERATIONS:'OPERATIONS_DM',PASSENGER_HANDLING:'PAX_DM',RAMP:'RAMP_DM',SPUR:'SPUR_DM'};
const superAdmin = user => Boolean(user?.active && user.role === 'ADMIN');
const dutyManager = user => Boolean(user?.active && managers[user.department] === user.position);
function staffFilter(user) {return superAdmin(user) ? {} : {department:user?.department || '__none__',role:{$ne:'ADMIN'}};}
function canViewStaff(actor,target) {return superAdmin(actor) || Boolean(actor?.active && target && target.role !== 'ADMIN' && actor.department === target.department && departments[actor.department]);}
function canManageStaff(actor,target) {return superAdmin(actor) || dutyManager(actor) && canViewStaff(actor,target);}
function roles(user) {return superAdmin(user) ? Object.values(departments).flat() : departments[user?.department] || [];}
module.exports = {departments,managers,superAdmin,dutyManager,staffFilter,canViewStaff,canManageStaff,roles};
