const flightDay = require('../services/flightDay');
const departmentAccess = require('../services/departmentAccess');
const express = require('express');
const Flight = require('../models/Turnaround');
const Assignment = require('../models/Assignment');
const User = require('../models/User');
const Handover = require('../models/Handover');
const Lir = require('../models/Lir');
const GateItems = require('../models/GateItems');
const assignmentRoles = require('../services/assignmentAccess');
const view = require('../services/turnaroundView');
const router = express.Router();
router.use(require('../middleware/requireUser'));
router.get('/', async (req, res) => {
  const roles = assignmentRoles(req.user);
  if (!roles.length) return res.status(403).json({error:'Operations Control requires an allocation or duty manager role'});
  const date = req.query.date;
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date+'T12:00:00Z')) || new Date(date+'T12:00:00Z').toISOString().slice(0,10) !== date) {
    return res.status(400).json({error:'Select a valid operating date'});
  }
  const flights = await Flight.find(flightDay.query(date)).lean();
  const ids = flights.map(f => f._id), filter = {turnaroundId:{$in:ids}};
  const [assignments, staff, handovers, lirs, gateItems] = await Promise.all([
    Assignment.find(filter).populate('userId','name active department role skills airlineQualifications').lean(),
    User.find({active:true,...departmentAccess.staffFilter(req.user)}).select('name active role department position skills airlineQualifications').sort({name:1}).lean(),
    Handover.find(filter).select('turnaroundId revision assignmentId receipts').sort({revision:-1}).lean(),
    Lir.find(filter).select('turnaroundId revision status receipts').sort({revision:-1}).lean(),
    GateItems.find(filter).select('turnaroundId items.status').lean()
  ]);
  const output = [];
  for (const flight of flights) {
    const item = await view(flight), key = String(flight._id);
    if (!flightDay.includes(item,date)) continue;
    const day=flightDay.context(item,date);
    const team = assignments.filter(a => String(a.turnaroundId) === key);
    const latest = rows => rows.find(row => String(row.turnaroundId) === key);
    const received = (doc, role) => {
      const agents = team.filter(a => a.role === role);
      return agents.length === 1 && (doc.receipts || []).some(r => String(r.assignmentId) === String(agents[0]._id));
    };
    const handover = latest(handovers), lir = latest(lirs), manifest = latest(gateItems);
    const activeItems = (manifest?.items || []).filter(i => i.status !== 'CANCELLED');
    output.push({
      ...day, _id:item._id, airline:item.airline, arrivalFlight:item.arrivalFlight, departureFlight:item.departureFlight,
      operatingDate:item.operatingDate, status:item.status, aircraft:item.aircraft, arrival:item.arrival, departure:item.departure,
      operationalTimeError:item.operationalTimeError,
      assignmentRoles:departmentAccess.roles(req.user).filter(role=>flightDay.roleOnDay(item,role,date)),
      canLir:departmentAccess.superAdmin(req.user)||['OPERATIONS','RAMP'].includes(req.user.department),
      assignments:team.filter(a=>flightDay.roleOnDay(item,a.role,date)&&departmentAccess.roles(req.user).includes(a.role)&&(!a.userId||departmentAccess.canViewStaff(req.user,a.userId))).map(a => ({...a,qualificationWarning:require('../../client/js/airlineQualifications').reason(a.userId,item.airline,a.role,require('../../client/js/airlineQualifications').flightDate(item,a.role))})),
      handover:handover ? {revision:handover.revision, received:received(handover,'GATE'),
        current:team.some(a => a.role === 'CHECKIN' && String(a._id) === String(handover.assignmentId))} : null,
      lir:lir ? {revision:lir.revision, status:lir.status, received:received(lir,'RAMP')} : null,
      gateItems:{total:activeItems.length, received:activeItems.filter(i => ['RECEIVED','LOADED'].includes(i.status)).length,
        loaded:activeItems.filter(i => i.status === 'LOADED').length}
    });
  }
  res.set('Cache-Control','no-store').json({user:{name:req.user.name,position:req.user.position},roles,staff:staff.map(u=>({...u,canManageShift:require('../services/staffShifts').canManage(req.user,u)})),flights:output});
});
module.exports = router;
