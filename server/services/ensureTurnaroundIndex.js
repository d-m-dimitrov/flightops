module.exports = async function ensureTurnaroundIndex(Turnaround) {
  await Turnaround.collection.createIndex(
    { scheduleId:1, operatingDate:1 },
    { unique:true, name:"generated_schedule_date", partialFilterExpression:{ scheduleId:{ $type:"objectId" } } }
  );
};
