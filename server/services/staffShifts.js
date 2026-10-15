const time = require('../../client/js/operationalTime');
const qualifications = require('../../client/js/airlineQualifications');
const roles = require('./assignmentAccess');
function canManage(actor, target) {
  const allowed = roles(actor);
  return allowed.length > 0 && (actor.role === 'ADMIN' || actor.position?.endsWith('_DM') || actor.department === target.department);
}
function validate(body) {
  if (!qualifications.date(body?.date)) throw Error('Select a valid roster date');
  if (!['WORKING','OFF','ABSENT'].includes(body.status)) throw Error('Select Working, Off or Absent');
  if (!Number.isInteger(body.expectedRevision) || body.expectedRevision < 0) throw Error('Reload the shift before saving');
  const result = {date:body.date,status:body.status,start:null,end:null,breaks:[]};
  if (body.status !== 'WORKING') return result;
  const occurrence = body.timeDisambiguation || 'reject';
  result.start = time.fromLocal(body.start,occurrence);
  result.end = time.fromLocal(body.end,occurrence);
  if (time.operatingDate(result.start) !== body.date) throw Error('The shift must start on its roster date');
  if (result.end <= result.start || result.end-result.start > 24*3600000) throw Error('Shift must be longer than zero and no more than 24 hours');
  if (!Array.isArray(body.breaks) || body.breaks.length > 8) throw Error('Enter up to 8 breaks');
  result.breaks = body.breaks.map(b => ({start:time.fromLocal(b.start,occurrence),end:time.fromLocal(b.end,occurrence)})).sort((a,b)=>a.start-b.start);
  for (let i=0;i<result.breaks.length;i++) {
    const b=result.breaks[i];
    if (b.start < result.start || b.end > result.end || b.end <= b.start) throw Error('Each break must be inside the shift with end after start');
    if (i && b.start < result.breaks[i-1].end) throw Error('Breaks cannot overlap');
  }
  return result;
}
function copyInput(shift, date) {
  const move = value => {
    const local = time.localInput(value);
    const days = Math.round((Date.parse(local.slice(0,10)+'T12:00:00Z')-Date.parse(shift.date+'T12:00:00Z'))/86400000);
    return `${time.addDays(date,days)}T${local.slice(11,16)}`;
  };
  return {date,status:'WORKING',start:move(shift.start),end:move(shift.end),breaks:(shift.breaks||[]).map(b=>({start:move(b.start),end:move(b.end)})),expectedRevision:0,timeDisambiguation:'reject'};
}
module.exports = {canManage,validate,copyInput};
