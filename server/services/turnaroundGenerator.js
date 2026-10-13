const FlightSchedule = require("../models/FlightSchedule");
const Turnaround = require("../models/Turnaround");
const resolveMgt = require("./getTurnaroundRule");
const time = require("../../client/js/operationalTime");
let running = false;

async function generateTurnarounds(now = new Date()) {
  if (running) return;
  running = true;
  try {
    const operatingDate = time.operatingDate(now);
    const weekday = new Date(operatingDate + "T12:00:00Z").getUTCDay() || 7;
    const schedules = await FlightSchedule.find({ active:true });
    for (const schedule of schedules) {
      if (!schedule.daysOfWeek?.includes(weekday)) continue;
      try {
        const key = { scheduleId:schedule._id, operatingDate };
        // A deleted generated flight is a tombstone, not permission to recreate it.
        if (await Turnaround.exists(key)) continue;
        const times = time.scheduleTimes(operatingDate, schedule.sta, schedule.std,
          schedule.departureDayOffset, schedule.timeDisambiguation);
        const mgt = await resolveMgt(schedule.airline, schedule.aircraftType);
        await Turnaround.updateOne(key, { $setOnInsert: {
          ...key, ...mgt, departureDayOffset:times.departureDayOffset,
          timeDisambiguation:schedule.timeDisambiguation || "reject",
          airline:schedule.airline, arrivalFlight:schedule.arrivalFlight,
          departureFlight:schedule.departureFlight,
          arrival:{ sta:schedule.sta, staAt:times.staAt },
          departure:{ std:schedule.std, stdAt:times.stdAt },
          flightNumberDisplay:`${schedule.arrivalFlight}/${schedule.departureFlight}`,
          flightDate:time.fromLocal(operatingDate + "T00:00"),
          origin:schedule.origin, destination:schedule.destination,
          status:"SCHEDULED", readiness:0,
          aircraft:{ aircraftType:schedule.aircraftType, registration:"", stand:"" }
        } }, { upsert:true, runValidators:true });
      } catch (error) {
        if (error.code !== 11000) console.error(`Schedule ${schedule._id}: ${error.message}`);
      }
    }
  } finally { running = false; }
}
module.exports = generateTurnarounds;
