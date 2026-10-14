const test=require('node:test'),assert=require('node:assert/strict');
const tasks=require('../client/js/flightTasks'),access=require('../server/services/handoverAccess');
test('actions distinguish Check-in send, Gate receive, RAMP LIR and closed flights',()=>{
 const f={_id:'f1',status:'SCHEDULED',assignments:[{_id:'a1',role:'CHECKIN',acceptedAt:new Date()}],departure:{stdAt:'2026-10-14T22:00:00Z'}};
 assert.deepEqual(tasks.actions(f),['Send Check-in → Gate handover']);
 f.handover={revision:2,assignmentId:'a1',received:false};assert.equal(tasks.actions(f).length,0);
 f.assignments=[{_id:'g1',role:'GATE'}];assert.deepEqual(tasks.actions(f),['Accept GATE assignment','Read / acknowledge handover v2']);
 f.assignments=[{_id:'r1',role:'RAMP',acceptedAt:new Date()}];f.lir={revision:3,status:'UPLOADED',received:false};assert.match(tasks.actions(f)[0],/LIR v3/);
 f.departure.pushback=new Date();assert.equal(tasks.actions(f).length,0);
});
test('action flights sort first; countdown selects arrival for Arrival and departure for Gate',()=>{
 const a={_id:'a',assignments:[{role:'GATE',acceptedAt:'yes'}],departure:{stdAt:'2026-10-14T10:00:00Z'}},b={_id:'b',assignments:[{role:'ARRIVAL'}],arrival:{staAt:'2026-10-14T12:00:00Z'}};
 assert.equal(tasks.sort([a,b])[0]._id,'b');assert.equal(tasks.target(b).label,'STA');assert.equal(tasks.target(a).label,'STD');
 b.arrival.eta='2026-10-14T13:00:00Z';assert.equal(tasks.target(b).label,'ETA');
});
test('handover authorization rejects other agents, admin bypass and duplicate assignments',()=>{
 const rows=[{_id:'a',role:'CHECKIN',userId:'u1'},{_id:'b',role:'GATE',userId:'u2'}];
 assert.equal(access.permissions(rows,{_id:'u1'}).send,true);assert.equal(access.permissions(rows,{_id:'u1'}).receive,false);
 assert.equal(access.permissions(rows,{_id:'u2'}).receive,true);assert.equal(access.permissions(rows,{_id:'other',role:'ADMIN'}).send,false);
 assert.equal(access.permissions(rows,{_id:'other'}).view,false);
 assert.equal(access.permissions([...rows,rows[0]],{_id:'u1'}).send,false);
 assert.throws(()=>access.validate({expectedSequence:0,checkedIn:-1,infants:0,bags:2,notes:''}));
 assert.throws(()=>access.validate({expectedSequence:0,checkedIn:10,infants:0,bags:2.5,notes:''}));
});
test('My flights API uses authenticated identity, validates dates and handles legacy LIR without receipts',async()=>{
 const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{createRequire}=require('node:module');
 const filename=path.join(__dirname,'../server/routes/myFlights.js'),module={exports:{}},real=createRequire(filename);let ownQuery,flightQuery;
 const mine=[{_id:'r1',turnaroundId:'f1',userId:'me',role:'RAMP'}];
 const chain=value=>({select:()=>chain(value),sort:()=>chain(value),lean:async()=>value});
 const mocks={'../models/Assignment':{find:q=>{if(q.userId){ownQuery=q;return chain(mine);}return chain(mine);}},'../models/Turnaround':{find:q=>{flightQuery=q;return chain([{_id:'f1',operatingDate:'2026-10-14'}]);}},'../models/Handover':{find:()=>chain([])},'../models/Lir':{find:()=>chain([{_id:'l1',turnaroundId:'f1',revision:1,status:'UPLOADED'}])}};
 vm.runInNewContext(fs.readFileSync(filename,'utf8'),{module,require:n=>n in mocks?mocks[n]:real(n)},{filename});
 const handler=module.exports.stack.find(l=>l.route).route.stack[0].handle;
 const res=()=>({code:200,set(){return this;},status(code){this.code=code;return this;},json(body){this.body=body;return this;}});
 let r=res();await handler({query:{date:'2026-99-99'},user:{_id:'me'}},r);assert.equal(r.code,400);assert.equal(ownQuery,undefined);
 r=res();await handler({query:{date:'2026-10-14',userId:'someone-else'},user:{_id:'me',department:'RAMP'}},r);
 assert.equal(ownQuery.userId,'me');assert.equal(flightQuery.operatingDate,'2026-10-14');assert.deepEqual(Array.from(flightQuery._id.$in),['f1']);assert.equal(r.body.flights[0].lir.received,false);
});
