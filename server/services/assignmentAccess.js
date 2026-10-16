const ALL = ['DISPATCH','ARRIVAL_DISPATCH','CHECKIN','GATE','ARRIVAL','ARRIVAL_RAMP','RAMP','SPUR'];
module.exports = function assignmentRoles(user) {
  if (!user?.active) return [];
  if (user.role === 'ADMIN') return ALL;
  const positions = {
    OPERATIONS:{ OPERATIONS_DM:['DISPATCH','ARRIVAL_DISPATCH'], TRAFFIC_COORDINATOR:['DISPATCH','ARRIVAL_DISPATCH'] },
    PASSENGER_HANDLING:{ PAX_DM:['CHECKIN','GATE','ARRIVAL'], CHECKIN_SUPERVISOR:['CHECKIN','GATE','ARRIVAL'] },
    RAMP:{ RAMP_DM:['ARRIVAL_RAMP','RAMP'], RAMP_ALLOCATOR:['ARRIVAL_RAMP','RAMP'] },
    SPUR:{ SPUR_DM:['SPUR'], SPUR_COORDINATOR:['SPUR'] }
  };
  return positions[user.department]?.[user.position] || [];
};
