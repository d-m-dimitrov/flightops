(function(root) {
  const roles = ['ARRIVAL','DISPATCH','CHECKIN','GATE','RAMP'];
  function closed(f) { return ['CANCELLED','DEPARTED','AIRBORNE'].includes(f.status) || Boolean(f.departure?.atd || f.departure?.airborne || f.departure?.pushback); }
  function target(f) { return f.departure?.etd || f.departure?.stdAt; }
  function late(f, now = Date.now()) {
    const std = Date.parse(f.departure?.stdAt), etd = Date.parse(f.departure?.etd);
    return !closed(f) && Number.isFinite(std) && ((Number.isFinite(etd) && etd > std) || now > std);
  }
  function gaps(f) { return closed(f) ? [] : roles.filter(role => !f.assignments.some(a => a.role === role && a.userId && a.userId.active !== false)); }
  function actions(f) {
    if (closed(f)) return [];
    const result = [];
    if (f.operationalTimeError) result.push('Check flight times');
    for (const a of f.assignments) {
      if (!a.userId || a.userId.active === false) result.push(`${a.role}: agent unavailable`);
      else if (!a.acceptedAt) result.push(`${a.role}: awaiting acceptance`);
    }
    if (f.assignments.some(a => a.role === 'CHECKIN') && (!f.handover || !f.handover.current)) result.push('Check-in handover pending');
    else if (f.handover && !f.handover.received) result.push(`Gate: acknowledge handover v${f.handover.revision}`);
    if (!f.lir) result.push('LIR not uploaded');
    else if (!f.lir.received) result.push(`RAMP: acknowledge LIR v${f.lir.revision}`);
    else if (f.lir.status !== 'COMPLETED') result.push('LIR completion pending');
    if (f.gateItems.received < f.gateItems.total) result.push(`${f.gateItems.total-f.gateItems.received} gate items awaiting RAMP`);
    if (f.gateItems.loaded < f.gateItems.received) result.push(`${f.gateItems.received-f.gateItems.loaded} gate items awaiting loading`);
    return result;
  }
  function windowFor(f, role) {
    const arrival = role === 'ARRIVAL';
    const at = Date.parse(arrival ? f.arrival?.eta || f.arrival?.staAt : target(f));
    return Number.isFinite(at) ? [at-(arrival?30:150)*60000, at+30*60000] : null;
  }
  function workload(flights) {
    const result = new Map();
    for (const f of flights.filter(f => !closed(f))) for (const a of f.assignments) {
      if (!a.userId?._id) continue;
      const id = String(a.userId._id);
      if (!result.has(id)) result.set(id,{user:a.userId, assignments:[], conflicts:[]});
      result.get(id).assignments.push({flight:f,role:a.role,window:windowFor(f,a.role)});
    }
    for (const entry of result.values()) for (let i=0;i<entry.assignments.length;i++) for (let j=i+1;j<entry.assignments.length;j++) {
      const a=entry.assignments[i], b=entry.assignments[j];
      if (String(a.flight._id) !== String(b.flight._id) && a.window && b.window && a.window[0]<b.window[1] && b.window[0]<a.window[1]) entry.conflicts.push([a,b]);
    }
    return [...result.values()];
  }
  const api={roles,closed,target,late,gaps,actions,windowFor,workload};
  if(typeof module==='object')module.exports=api;else root.ControlModel=api;
})(globalThis);
