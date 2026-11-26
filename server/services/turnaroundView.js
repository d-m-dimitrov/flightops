const time = require("../../client/js/operationalTime");
const resolveMgt = require("./getTurnaroundRule");
module.exports = async function turnaroundView(flight) {
  const item = flight.toObject ? flight.toObject() : { ...flight };
  try {
    // Recovery records are departure-only. Do not try to invent a previous arrival.
    if(item.isRecovery){
      if(item.mgt==null)item.mgt=0;
      return item;
    }
    if (!item.arrival?.staAt || !item.departure?.stdAt) {
      const times = time.scheduleTimes(item.operatingDate, item.arrival?.sta, item.departure?.std,
        item.departureDayOffset, item.timeDisambiguation);
      item.arrival = { ...item.arrival, staAt:times.staAt };
      item.departure = { ...item.departure, stdAt:times.stdAt };
      item.departureDayOffset = times.departureDayOffset;
    }
    if (item.mgt == null) Object.assign(item, await resolveMgt(item.airline, item.aircraft?.aircraftType));
  } catch (error) { item.operationalTimeError = error.message; }
  return item;
};
