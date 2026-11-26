const test=require('node:test');
const assert=require('node:assert/strict');
const express=require('express');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {createRequire}=require('node:module');
const time=require('../client/js/operationalTime');

function load(file,mocks){
 const filename=path.join(__dirname,'..',file),module={exports:{}},real=createRequire(filename);
 vm.runInNewContext(fs.readFileSync(filename,'utf8'),{module,require:n=>n in mocks?mocks[n]:real(n),console,Date},{filename});
 return module.exports;
}
const query=rows=>({select(){return this;},sort(){return this;},populate(){return this;},limit(){return this;},lean:async()=>rows});
test('OPS FIDS shows real Arrival and Departure dispatcher assignments separately and carries AOG',async()=>{
 const original={
  _id:'flight1',airline:'TK',arrivalFlight:'TK1971',departureFlight:'TK1972',
  operatingDate:'2026-11-26',status:'GROUNDED',departureStatus:'CANCELLED',
  aircraft:{aircraftType:'B77W',registration:'TC-LJG',stand:'B42'},
  arrival:{staAt:time.fromLocal('2026-11-26T12:00')},
  departure:{stdAt:time.fromLocal('2026-11-26T15:00')}
 };
 const recovery={
  _id:'recovery2',airline:'TK',arrivalFlight:'',departureFlight:'TK6672',
  operatingDate:'2026-11-26',status:'SCHEDULED',isRecovery:true,
  aircraft:{aircraftType:'B77W',registration:'TC-LJG',stand:'B42'},
  arrival:{},departure:{stdAt:time.fromLocal('2026-11-26T18:00')}
 };
 const assignments=[
  {turnaroundId:'flight1',role:'ARRIVAL_DISPATCH',userId:{name:'Alice Arrival',active:true}},
  {turnaroundId:'flight1',role:'DISPATCH',userId:{name:'Bob Departure',active:true}},
  {turnaroundId:'flight1',role:'RAMP',userId:{name:'Carol Ramp',active:true}},
  {turnaroundId:'recovery2',role:'DISPATCH',userId:{name:'Dave Recovery',active:true}}
 ];
 const stay={registration:'TC-LJG',aircraftType:'B77W',stand:'B42',reason:'TECHNICAL',
  originalOperatingDate:'2026-11-25',originalDepartureFlight:'TK1972',arrivalFlight:'TK1971',
  status:'RECOVERY_PLANNED',groundedAt:time.fromLocal('2026-11-25T12:00'),recoveryTurnaroundId:'recovery2'};
 const router=load('server/routes/opsFids.js',{
  '../middleware/requireUser':(req,res,next)=>{
   if(!req.headers.authorization)return res.status(401).json({error:'Sign in'});
   const mode=req.headers.authorization;
   req.user={active:true,department:mode==='pax'?'PASSENGER_HANDLING':mode==='ramp'?'RAMP':'OPERATIONS',
    position:mode==='manager'?'OPERATIONS_DM':'DISPATCHER',role:'USER'};
   next();
  },
  '../models/Turnaround':{find:filter=>query(filter._id?[recovery]:[original,recovery])},
  '../models/Assignment':{find:()=>query(assignments)},
  '../models/Lir':{find:()=>query([])},
  '../models/LirChecklist':{find:()=>query([])},
  '../models/AircraftGroundStay':{find:()=>query([stay])}
 });
 const app=express();app.use('/api/ops-fids',router);
 const server=app.listen(0,'127.0.0.1');await new Promise(done=>server.once('listening',done));
 const url='http://127.0.0.1:'+server.address().port+'/api/ops-fids?date=2026-11-26';
 try{
  assert.equal((await fetch(url)).status,401);
  assert.equal((await fetch(url,{headers:{Authorization:'pax'}})).status,403);
  assert.equal((await fetch(url.replace('2026-11-26','2026-02-30'),{headers:{Authorization:'manager'}})).status,400);
  const response=await fetch(url,{headers:{Authorization:'manager'}}),body=await response.json();
  assert.equal(response.status,200);assert.equal(body.flights.length,2);
  const f=body.flights.find(x=>x.id==='flight1');
  assert.deepEqual(f.dispatchers.arrival,['Alice Arrival']);
  assert.deepEqual(f.dispatchers.departure,['Bob Departure']);
  assert.deepEqual(f.dispatchers.ramp,['Carol Ramp']);
  assert.equal(f.departureStatus,'CANCELLED');
  const rec=body.flights.find(x=>x.id==='recovery2');
  assert.equal(rec.arrivalToday,false);
  assert.equal(rec.departureToday,true);
  assert.deepEqual(rec.dispatchers.arrival,[]);
  assert.deepEqual(rec.dispatchers.departure,['Dave Recovery']);
  assert.equal(body.aog.length,1);
  assert.equal(body.aog[0].recoveryFlight,'TK6672');
  assert.equal((await fetch(url,{headers:{Authorization:'ramp'}})).status,200);
 }finally{await new Promise(done=>server.close(done));}
});
