const ALL = ['DISPATCH','ARRIVAL_DISPATCH','CHECKIN','GATE','ARRIVAL','RAMP','SPUR'];
module.exports = function assignmentRoles(user) {
  if (!user?.active) return [];
  if (user.role === 'ADMIN') return ALL;
  const positions = {
    OPERATIONS:{ OPERATIONS_DM:ALL, TRAFFIC_COORDINATOR:['DISPATCH','ARRIVAL_DISPATCH'] },
    PASSENGER_HANDLING:{ PAX_DM:ALL, CHECKIN_SUPERVISOR:['CHECKIN','GATE','ARRIVAL'] },
    RAMP:{ RAMP_DM:ALL, RAMP_ALLOCATOR:['RAMP'] },
    SPUR:{ SPUR_DM:ALL, SPUR_COORDINATOR:['SPUR'] }
  };
  return positions[user.department]?.[user.position] || [];
};
