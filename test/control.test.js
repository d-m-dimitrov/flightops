const test=require('node:test'),assert=require('node:assert/strict');
const model=require('../client/js/controlModel');
const access=require('../server/services/assignmentAccess');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),{createRequire}=require('node:module');
function load(file,mocks){const filename=path.join(__dirname,'..',file),module={exports:{}},real=createRequire(filename);vm.runInNewContext(fs.readFileSync(filename,'utf8'),{module,require:n=>n in mocks?mocks[n]:real(n),console},{filename});return module.exports;}
function flight(overrides={}) {return {_id:'f1',status:'SCHEDULED',arrival:{staAt:'2026-10-15T09:00:00Z'},departure:{stdAt:'2026-10-15T11:00:00Z'},assignments:[],gateItems:{total:0,received:0,loaded:0},...overrides};}
test('Control permissions use active database role and department; controllers and allocators retain their scope',()=>{
 assert.deepEqual(access({active:true,department:'OPERATIONS',position:'TRAFFIC_COORDINATOR'}),['DISPATCH','ARRIVAL_DISPATCH']);
 assert.deepEqual(access({active:true,department:'RAMP',position:'RAMP_ALLOCATOR'}),['RAMP']);
 assert.equal(access({active:true,department:'OPERATIONS',position:'OPERATIONS_DM'}).length,7);
 assert.equal(access({active:true,department:'RAMP',position:'OPERATIONS_DM'}).length,0);
 assert.equal(access({active:false,role:'ADMIN'}).length,0);
});
test('Control actions reflect current assignment receipts, pending gate items and closed flights',()=>{
 const f=flight({assignments:[{role:'CHECKIN',userId:{_id:'u1',active:true},acceptedAt:new Date()}],handover:{current:false,received:true},lir:{revision:2,received:false,status:'COMPLETED'},gateItems:{total:3,received:2,loaded:1}});
 const tasks=model.actions(f);
 assert.ok(tasks.includes('Check-in handover pending'));
 assert.ok(tasks.includes('RAMP: acknowledge LIR v2'));
 assert.ok(tasks.includes('1 gate items awaiting RAMP'));
 assert.ok(tasks.includes('1 gate items awaiting loading'));
 assert.equal(model.gaps(f).length,5);
 assert.deepEqual(model.actions({...f,status:'DEPARTED'}),[]);
 assert.deepEqual(model.gaps({...f,status:'CANCELLED'}),[]);
 assert.equal(model.late(f,Date.parse('2026-10-15T12:00:00Z')),true);
 assert.equal(model.late({...f,status:'DEPARTED'},Date.parse('2026-10-15T12:00:00Z')),false);
});
test('Workload flags estimated overlaps across flights, not multiple roles on the same flight',()=>{
 const user={_id:'u1',name:'Alex'},assignment=role=>({role,userId:user});
 const f=flight({assignments:[assignment('DISPATCH'),assignment('GATE')]});
 assert.equal(model.workload([f])[0].conflicts.length,0);
 const second=flight({_id:'f2',assignments:[assignment('DISPATCH')],departure:{stdAt:'2026-10-15T12:00:00Z'}});
 assert.equal(model.workload([f,second])[0].conflicts.length,2);
 assert.equal(model.workload([f,{...second,status:'CANCELLED'}])[0].conflicts.length,0);
});
test('Control HTTP protects access, rejects invalid dates, and returns latest document receipts for current assignees',async()=>{
 const express=require('express');
 const query=rows=>({lean:async()=>rows,select(){return this;},sort(){return this;},populate(){return this;}});
 const f=flight();
 const router=load('server/routes/control.js',{
  '../middleware/requireUser':(req,res,next)=>{if(!req.headers.authorization)return res.status(401).json({error:'Sign in'});req.user={active:true,department:'OPERATIONS',position:req.headers.authorization==='manager'?'OPERATIONS_DM':'DISPATCHER',name:'Manager'};next();},
  '../models/Turnaround':{find:q=>{assert.equal(q.operatingDate,'2026-10-15');return query([f]);}},
  '../models/Assignment':{find:()=>query([{_id:'ramp2',turnaroundId:'f1',role:'RAMP',userId:{_id:'u1',name:'Ramp'}},{_id:'gate2',turnaroundId:'f1',role:'GATE',userId:{_id:'u2'}}])},
  '../models/User':{find:()=>query([])},
  '../models/Handover':{find:()=>query([{turnaroundId:'f1',revision:2,assignmentId:'old-checkin',receipts:[{assignmentId:'gate1'}]}])},
  '../models/Lir':{find:()=>query([{turnaroundId:'f1',revision:3,status:'UPLOADED',receipts:[{assignmentId:'ramp1'}]}])},
  '../models/GateItems':{find:()=>query([{turnaroundId:'f1',items:[{status:'CANCELLED'},{status:'LOADED'},{status:'SUBMITTED'}]}])},
  '../services/turnaroundView':async value=>value
 });
 const app=express();app.use('/api/control',router);const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 const url=`http://127.0.0.1:${server.address().port}/api/control`;
 try{
  assert.equal((await fetch(url)).status,401);
  assert.equal((await fetch(url,{headers:{Authorization:'agent'}})).status,403);
  assert.equal((await fetch(url+'?date=2026-02-30',{headers:{Authorization:'manager'}})).status,400);
  const response=await fetch(url+'?date=2026-10-15',{headers:{Authorization:'manager'}}),body=await response.json();
  assert.equal(response.status,200);assert.equal(body.roles.length,7);
  assert.equal(body.flights[0].lir.received,false);assert.equal(body.flights[0].handover.current,false);assert.equal(body.flights[0].handover.received,false);
  assert.deepEqual(body.flights[0].gateItems,{total:2,received:1,loaded:1});
 }finally{await new Promise(r=>server.close(r));}
});
test('Allocation rejects stale Control snapshots without deleting or creating assignments',async()=>{
 const flightId='a'.repeat(24),userId='b'.repeat(24);let mutations=0;
 const router=load('server/routes/assignments.js',{
  '../models/Turnaround':{findOne:async()=>({airline:'SQ',operatingDate:'2026-10-15'})},
  '../models/Assignment':{find:()=>({populate:async()=>[{_id:'new-assignment',role:'RAMP',userId:{_id:userId}}]}),deleteMany:async()=>mutations++,create:async()=>mutations++},
  '../models/User':{findById:async()=>({_id:userId,active:true,skills:['RAMP'],department:'RAMP',airlineQualifications:[{airline:'SQ',role:'RAMP',validUntil:null}]})}
 });
 const handler=router.stack.find(l=>l.route?.methods.post).route.stack[0].handle;
 const response={statusCode:200,status(n){this.statusCode=n;return this;},json(body){this.body=body;return this;}};
 await handler({params:{turnaroundId:flightId},user:{active:true,department:'RAMP',position:'RAMP_ALLOCATOR'},body:{assignments:[{role:'RAMP',userId}],expectedAssignments:['old-assignment:RAMP:'+userId]}},response);
 assert.equal(response.statusCode,409);assert.equal(mutations,0);
});
