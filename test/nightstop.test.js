const test=require('node:test'),assert=require('node:assert/strict');
const time=require('../client/js/operationalTime'),day=require('../server/services/flightDay'),q=require('../client/js/airlineQualifications'),control=require('../client/js/controlModel');
function flight(date,sta='22:00',std='06:00',offset=1){const t=time.scheduleTimes(date,sta,std,offset);return {_id:'same-turnaround',airline:'SQ',operatingDate:date,departureDayOffset:offset,arrival:{sta,staAt:t.staAt},departure:{std,stdAt:t.stdAt},assignments:[],gateItems:{total:0,received:0,loaded:0}};}
test('nightstop is one turnaround visible on both London movement dates, not adjacent days',()=>{
 const f=flight('2026-10-17');
 assert.equal(day.includes(f,'2026-10-17'),true);assert.equal(day.includes(f,'2026-10-18'),true);assert.equal(day.includes(f,'2026-10-19'),false);
 assert.equal(day.roleOnDay(f,'ARRIVAL_DISPATCH','2026-10-17'),true);assert.equal(day.roleOnDay(f,'DISPATCH','2026-10-17'),false);
 assert.equal(day.roleOnDay(f,'GATE','2026-10-18'),true);assert.equal(day.roleOnDay(f,'ARRIVAL','2026-10-18'),false);
 assert.equal(day.context(f,'2026-10-18').dayLabel,'Nightstop · Arrival 2026-10-17');
 const legacy={...f,departureDayOffset:undefined,arrival:{sta:'22:00'},departure:{std:'06:00'}};
 assert.equal(day.includes(legacy,'2026-10-18'),true);
 const long=flight('2026-12-31','22:00','06:00',2);
 assert.equal(day.includes(long,'2027-01-02'),true);assert.equal(day.includes(long,'2027-01-01'),false);
});
test('day query follows BST midnight, 23/25-hour DST dates and excludes deleted rows',()=>{
 for(const [date,hours] of [['2026-03-29',23],['2026-10-25',25],['2026-10-17',24]]){
  const query=day.query(date),range=query.$or[0]['arrival.staAt'];
  assert.equal((range.$lt-range.$gte)/3600000,hours);assert.equal(query.deleted.$ne,true);
 }
 const f=flight('2026-10-17','00:15','02:00',0);
 assert.equal(f.arrival.staAt.toISOString(),'2026-10-16T23:15:00.000Z');
 assert.equal(day.includes(f,'2026-10-17'),true);assert.equal(day.includes(f,'2026-10-16'),false);
 assert.throws(()=>day.query('2026-02-30'));
});
test('arrival-day Control excludes departure reminders and uses arrival countdown',()=>{
 const f=flight('2026-10-17'),arrival={...f,...day.context(f,'2026-10-17'),assignmentRoles:['ARRIVAL_DISPATCH']};
 assert.deepEqual(control.actions(arrival),[]);assert.deepEqual(control.gaps(arrival),['ARRIVAL_DISPATCH']);
 assert.equal(control.target(arrival),f.arrival.staAt);
 assert.equal(control.windowFor(arrival,'DISPATCH')[1],+f.departure.stdAt+30*60000);
 const departure={...f,...day.context(f,'2026-10-18')};assert.ok(control.actions(departure).includes('LIR not uploaded'));
});
test('departure training must still be valid after midnight; arrival uses arrival date',()=>{
 const f=flight('2026-10-17'),user={active:true,skills:['DISPATCH','ARRIVAL_DISPATCH'],airlineQualifications:['DISPATCH','ARRIVAL_DISPATCH'].map(role=>({airline:'SQ',role,validUntil:'2026-10-17'}))};
 assert.equal(q.reason(user,'SQ','ARRIVAL_DISPATCH',q.flightDate(f,'ARRIVAL_DISPATCH')),null);
 assert.match(q.reason(user,'SQ','DISPATCH',q.flightDate(f,'DISPATCH')),/expired/);
});
test('flight list endpoint returns same ID on both days and filters unrelated legacy candidates',async()=>{
 const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),{createRequire}=require('node:module');
 const filename=path.join(__dirname,'../server/routes/flights.js'),real=createRequire(filename),module={exports:{}};
 const f=flight('2026-10-17'),old=flight('2026-10-14');let reads=0;
 const mocks={
  '../models/Turnaround':{find:filter=>{assert.equal(filter.deleted.$ne,true);assert.ok(filter.$or.some(x=>x['departure.stdAt']));return {sort:async()=>[f,old]};}},
  '../services/turnaroundView':async x=>({...x}),
  '../services/readinessCalculator':async()=>({percentage:0}),
  '../services/chatReadState':{unreadCounts:async()=>new Map([[f._id,2]])}
 };
 vm.runInNewContext(fs.readFileSync(filename,'utf8'),{module,require:n=>n in mocks?mocks[n]:real(n),console},{filename});
 const handler=module.exports.stack.find(l=>l.route?.path==='/'&&l.route.methods.get).route.stack.at(-1).handle;
 for(const date of ['2026-10-17','2026-10-18']){
  const res={json(body){this.body=body;},status(){return this;}};
  await handler({query:{date},user:{_id:'reader'}},res);
  assert.equal(res.body.length,1);assert.equal(res.body[0]._id,f._id);assert.equal(res.body[0].unreadNotifications,2);
 }
});
