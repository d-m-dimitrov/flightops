const flightDay = require('../services/flightDay');
const departmentAccess = require('../services/departmentAccess');
const express = require('express');
const Flight = require('../models/Turnaround');
const Assignment = require('../models/Assignment');
const User = require('../models/User');
const Handover = require('../models/Handover');
const Lir = require('../models/Lir');
const GateItems = require('../models/GateItems');
const AircraftGroundStay = require('../models/AircraftGroundStay');
const AogShiftHandover = require('../models/AogShiftHandover');
const time = require('../../client/js/operationalTime');
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
  // Carry forward grounded aircraft across calendar days, independently of the
  // daily scheduled flight board. Date boundaries follow London DST.
  const dayStart=time.fromLocal(date+'T00:00');
  const nextDayStart=time.fromLocal(time.addDays(date,1)+'T00:00');
  const groundStays=await AircraftGroundStay.find({
    groundedAt:{$lt:nextDayStart},
    $or:[{closedAt:null},{closedAt:{$gte:dayStart}}]
  }).sort({groundedAt:1}).limit(200).lean();
  const aogIds=groundStays.map(stay=>stay._id);
  const flightRefs=[...new Set(groundStays.flatMap(stay=>[stay.sourceTurnaroundId,stay.recoveryTurnaroundId]).filter(Boolean).map(String))];
  const [aogHandovers,aogFlights]=await Promise.all([
    AogShiftHandover.find({groundStayId:{$in:aogIds}}).sort({revision:-1}).lean(),
    Flight.find({_id:{$in:flightRefs}}).select('arrivalFlight departureFlight operatingDate status aircraft departure departureStatus').lean()
  ]);
  const latestByStay=new Map(), aogFlightById=new Map(aogFlights.map(f=>[String(f._id),f]));
  for(const note of aogHandovers){
    const key=String(note.groundStayId);
    if(!latestByStay.has(key))latestByStay.set(key,note);
  }
  const aogCases=groundStays.map(stay=>{
    const source=aogFlightById.get(String(stay.sourceTurnaroundId));
    const recovery=aogFlightById.get(String(stay.recoveryTurnaroundId));
    const latestHandover=latestByStay.get(String(stay._id))||null;
    const recoveryDeparted=Boolean(recovery&&(recovery.status==='DEPARTED'||recovery.departure?.atd||recovery.departure?.airborne));
    return {
      _id:stay._id,sourceTurnaroundId:stay.sourceTurnaroundId,recoveryTurnaroundId:stay.recoveryTurnaroundId,
      registration:stay.registration,aircraftType:stay.aircraftType,stand:stay.stand,airline:stay.airline,
      arrivalFlight:stay.arrivalFlight,originalDepartureFlight:stay.originalDepartureFlight,
      originalOperatingDate:stay.originalOperatingDate,reason:stay.reason,notes:stay.notes,
      status:stay.status,displayStatus:recoveryDeparted?'RECOVERY_DEPARTED':stay.status,
      groundedAt:stay.groundedAt,expectedReleaseAt:stay.expectedReleaseAt,closedAt:stay.closedAt,
      source:source?{_id:source._id,arrivalFlight:source.arrivalFlight,departureFlight:source.departureFlight}:null,
      recovery:recovery?{_id:recovery._id,flightNumber:recovery.departureFlight,
        date:recovery.operatingDate,stdAt:recovery.departure?.stdAt,
        std:recovery.departure?.std,status:recovery.status}:null,
      handoverSequence:stay.handoverSequence||0,
      latestHandover:latestHandover?{
        _id:latestHandover._id,revision:latestHandover.revision,notes:latestHandover.notes,
        sentBy:latestHandover.sentBy,sentByName:latestHandover.sentByName,createdAt:latestHandover.createdAt,
        receipts:latestHandover.receipts
      }:null
    };
  });
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
      operatingDate:item.operatingDate, status:item.status, isRecovery:item.isRecovery, departureStatus:item.departureStatus,
      groundStayId:item.groundStayId,aircraft:item.aircraft, arrival:item.arrival, departure:item.departure,
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
  res.set('Cache-Control','no-store').json({user:{id:req.user._id,name:req.user.name,position:req.user.position},
  permissions:{aogHandover:departmentAccess.superAdmin(req.user)||
    (req.user.active&&req.user.department==='OPERATIONS'&&req.user.position==='OPERATIONS_DM')},
  roles,staff:staff.map(u=>({...u,canManageShift:require('../services/staffShifts').canManage(req.user,u)})),
  flights:output,aogCases});
});
module.exports = router;
