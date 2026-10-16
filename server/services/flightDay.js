const time = require('../../client/js/operationalTime');
// UTC bounds are converted from London midnights: DST days are not always 24 hours.
function query(date) {
  const start=time.fromLocal(date+'T00:00'), end=time.fromLocal(time.addDays(date,1)+'T00:00');
  return {deleted:{$ne:true},$or:[
    {'arrival.staAt':{$gte:start,$lt:end}}, {'departure.stdAt':{$gte:start,$lt:end}},
    {operatingDate:{$gte:time.addDays(date,-7),$lte:date},$or:[{'arrival.staAt':null},{'departure.stdAt':null}]}
  ]};
}
function context(f,date) {
  try { return time.dayContext(f,date); }
  catch { return {arrivalToday:f.operatingDate===date,departureToday:f.operatingDate===date,dayLabel:''}; }
}
function includes(f,date){const c=context(f,date);return c.arrivalToday||c.departureToday;}
function roleOnDay(f,role,date){const c=context(f,date);return ['ARRIVAL','ARRIVAL_DISPATCH','ARRIVAL_RAMP'].includes(role)?c.arrivalToday:c.departureToday;}
module.exports={query,context,includes,roleOnDay};
