(function(root,factory){
  if(typeof module==='object')module.exports=factory(require('./operationalTime'),require('./controlModel'));
  else root.ShiftAvailability=factory(root.OperationalTime,root.ControlModel);
})(globalThis,function(time,control){
  const overlaps=(a,b)=>a[0]<b[1]&&b[0]<a[1];
  function interval(row){const a=Date.parse(row.start),b=Date.parse(row.end);return Number.isFinite(a)&&Number.isFinite(b)&&a<b?[a,b]:null;}
  function check(userId,flight,role,shifts,flights){
    const window=control.windowFor(flight,role),warnings=[];
    if(!window)return {available:false,warnings:['Flight time unavailable'],window:null};
    const mine=shifts.filter(s=>String(s.userId)===String(userId));
    const absence=mine.some(s=>s.status==='ABSENT'&&overlaps(window,[+time.fromLocal(s.date+'T00:00'),+time.fromLocal(time.addDays(s.date,1)+'T00:00')]));
    if(absence)warnings.push('Absent during task window');
    const working=mine.filter(s=>s.status==='WORKING'&&interval(s));
    const coverage=working.some(s=>{const w=interval(s);return w[0]<=window[0]&&w[1]>=window[1];});
    if(!coverage)warnings.push(working.some(s=>overlaps(interval(s),window))?'Task extends outside shift':'No covering shift recorded');
    if(working.some(s=>(s.breaks||[]).some(b=>interval(b)&&overlaps(interval(b),window))))warnings.push('Break overlaps task window');
    for(const other of flights){
      if(String(other._id)===String(flight._id)||control.closed(other))continue;
      if(other.assignments.some(a=>String(a.userId?._id||a.userId)===String(userId)&&control.windowFor(other,a.role)&&overlaps(window,control.windowFor(other,a.role))))warnings.push(`Conflicts with ${other.arrivalFlight||'—'} / ${other.departureFlight||'—'}`);
    }
    return {available:warnings.length===0,warnings,window};
  }
  return {check,interval,overlaps};
});
