const test=require('node:test');
const assert=require('node:assert/strict');
const mongoose=require('mongoose');
const time=require('../client/js/operationalTime');
const flightDay=require('../server/services/flightDay');
const view=require('../server/services/turnaroundView');
const Turnaround=require('../server/models/Turnaround');
const AircraftGroundStay=require('../server/models/AircraftGroundStay');

test('AOG retains original arrival and separately cancels original departure',()=>{
 const original=new Turnaround({
  operatingDate:'2026-11-26',airline:'TK',arrivalFlight:'TK1971',departureFlight:'TK1972',
  arrival:{sta:'13:20',staAt:time.fromLocal('2026-11-26T13:20'),onBlocks:time.fromLocal('2026-11-26T13:25')},
  departure:{std:'15:00',stdAt:time.fromLocal('2026-11-26T15:00')},
  aircraft:{aircraftType:'B77W',registration:'TC-LJG'}
 });
 original.status='GROUNDED';original.departureStatus='CANCELLED';
 assert.equal(original.arrivalFlight,'TK1971');
 assert.equal(original.departureFlight,'TK1972');
 assert.equal(original.arrival.onBlocks.toISOString(),time.fromLocal('2026-11-26T13:25').toISOString());
 assert.equal(original.departureStatus,'CANCELLED');
 assert.equal(original.status,'GROUNDED');
});

test('departure-only recovery appears only on its own date and has no ghost arrival',async()=>{
 const nextDay=time.fromLocal('2026-11-27T15:00');
 const recovery=new Turnaround({
  operatingDate:'2026-11-27',airline:'TK',arrivalFlight:'',departureFlight:'TK6672',
  isRecovery:true,recoveryOf:new mongoose.Types.ObjectId(),status:'SCHEDULED',
  departure:{std:'15:00',stdAt:nextDay,flightType:'PASSENGER'},
  aircraft:{registration:'TC-LJG',aircraftType:'B77W'}
 });
 const date=flightDay.context(recovery,'2026-11-27');
 assert.equal(date.arrivalToday,false);
 assert.equal(date.departureToday,true);
 assert.equal(flightDay.includes(recovery,'2026-11-26'),false);
 assert.equal(flightDay.includes(recovery,'2026-11-27'),true);
 const rendered=await view(recovery);
 assert.equal(rendered.operationalTimeError,undefined);
 assert.equal(rendered.departure.stdAt.toISOString(),nextDay.toISOString());
});

test('recovery number and STD can remain TBC while departure day remains visible',()=>{
 const pending=new Turnaround({
  operatingDate:'2026-11-28',isRecovery:true,arrivalFlight:'',departureFlight:'',
  departure:{std:'',stdAt:null},status:'RECOVERY_TBC'
 });
 assert.equal(flightDay.context(pending,'2026-11-28').departureToday,true);
 assert.equal(flightDay.context(pending,'2026-11-28').arrivalToday,false);
 assert.equal(flightDay.context(pending,'2026-11-29').departureToday,false);
});

test('Ground Stay records the physical aircraft and links both flight records',()=>{
 const original=new mongoose.Types.ObjectId();
 const stay=new AircraftGroundStay({
  sourceTurnaroundId:original,registration:'tc-ljg',airline:'tk',
  groundedAt:time.fromLocal('2026-11-26T13:25'),reason:'TECHNICAL',
  arrivalFlight:'TK1971',originalDepartureFlight:'TK1972',
  originalOperatingDate:'2026-11-26'
 });
 assert.equal(stay.registration,'TC-LJG');
 assert.equal(stay.airline,'TK');
 assert.equal(stay.status,'GROUNDED');
 assert.equal(String(stay.sourceTurnaroundId),String(original));
 assert.equal(stay.validateSync(),undefined);
});
