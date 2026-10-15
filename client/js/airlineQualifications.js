(function(root) {
  const roles = ['DISPATCH','ARRIVAL_DISPATCH','CHECKIN','GATE','ARRIVAL','RAMP','SPUR'];
  function airline(value) { return typeof value === 'string' ? value.trim().toUpperCase() : ''; }
  function date(value) {
    return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value+'T12:00:00Z')) && new Date(value+'T12:00:00Z').toISOString().slice(0,10) === value;
  }
  function normalize(rows) {
    if (!Array.isArray(rows) || rows.length > 500) throw Error('Enter up to 500 airline qualifications');
    const seen = new Set();
    return rows.map(row => {
      const code = airline(row?.airline), role = row?.role, validUntil = row?.validUntil == null || row?.validUntil === '' ? null : row.validUntil;
      if (!/^[A-Z0-9]{2,3}$/.test(code)) throw Error('Use the airline code from the flight schedule (2–3 letters/digits)');
      if (!roles.includes(role)) throw Error('Select a valid qualification role');
      if (validUntil !== null && !date(validUntil)) throw Error('Select a valid expiry date or leave it blank for no expiry');
      const key = `${code}:${role}`;
      if (seen.has(key)) throw Error(`Duplicate qualification: ${code} ${role}`);
      seen.add(key);
      return {airline:code, role, validUntil};
    });
  }
  function reason(user, code, role, operatingDate) {
    if (!user?.active) return 'Agent is inactive or unavailable';
    if (!roles.includes(role) || !user.skills?.includes(role)) return `Missing ${role} skill`;
    if (role === 'RAMP' && user.department !== 'RAMP') return 'RAMP department required';
    code = airline(code);
    if (!/^[A-Z0-9]{2,3}$/.test(code) || !date(operatingDate)) return 'Check flight airline and operating date';
    const training = (user.airlineQualifications || []).filter(q => airline(q.airline) === code && q.role === role);
    if (!training.length) return `No ${code} ${role} training recorded`;
    if (training.length !== 1) return `Duplicate ${code} ${role} training — review staff record`;
    const expiry = training[0].validUntil;
    if (expiry != null && expiry !== '' && !date(expiry)) return 'Invalid qualification expiry date';
    if (expiry && expiry < operatingDate) return `${code} ${role} training expired on ${expiry}`;
    return null;
  }
  const labels={DISPATCH:'Departure Dispatcher',ARRIVAL_DISPATCH:'Arrival Dispatcher',ARRIVAL:'Arrival Agent',CHECKIN:'Check-in',GATE:'Gate',RAMP:'RAMP',SPUR:'SPUR'};
  const api={label:role=>labels[role]||role,roles,airline,date,normalize,reason,eligible:(...args)=>reason(...args)===null};
  if(typeof module==='object')module.exports=api;else root.AirlineQualifications=api;
})(globalThis);
