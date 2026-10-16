const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),{createRequire}=require('node:module');
const qualifications=require('../client/js/airlineQualifications'),tasks=require('../client/js/flightTasks'),control=require('../client/js/controlModel');
function load(file,mocks){const filename=path.join(__dirname,'..',file),module={exports:{}},real=createRequire(filename);vm.runInNewContext(fs.readFileSync(filename,'utf8'),{module,require:n=>n in mocks?mocks[n]:real(n),console:{log(){},error(){}}},{filename});return module.exports;}
function response(){return {statusCode:200,status(n){this.statusCode=n;return this;},json(body){this.body=body;return this;}};}
test('RAMP Allocator can allocate both RAMP roles to one or different agents and preserve unchanged acceptance',async()=>{
 const flightId='a'.repeat(24),one='b'.repeat(24),two='c'.repeat(24),rows=[];
 const users={};for(const id of [one,two])users[id]={_id:id,name:id,active:true,department:'RAMP',skills:['RAMP','ARRIVAL_RAMP'],airlineQualifications:[{airline:'SQ',role:'RAMP'},{airline:'SQ',role:'ARRIVAL_RAMP'}]};
 const router=load('server/routes/assignments.js',{
  '../models/Turnaround':{findOne:async()=>({airline:'SQ',operatingDate:'2026-10-15'})},
  '../models/User':{findById:async id=>users[id]},
  '../models/Assignment':{find:()=>({populate:async()=>rows.map(a=>({...a,userId:users[a.userId]}))}),deleteMany:async q=>{for(let i=rows.length-1;i>=0;i--)if(q.role.$in.includes(rows[i].role))rows.splice(i,1);},create:async a=>rows.push({...a,_id:String(rows.length+1)})},
  '../models/ChatMessage':{create:async()=>{}},'../services/lirLive':{clearFlight(){}}
 });
 const handler=router.stack.find(l=>l.route?.methods.post).route.stack[0].handle;
 const req={params:{turnaroundId:flightId},user:{active:true,department:'RAMP',position:'RAMP_ALLOCATOR'},body:{assignments:[{role:'ARRIVAL_RAMP',userId:one},{role:'RAMP',userId:one}]},app:{get:()=>({to:()=>({emit(){}})})}};
 let res=response();await handler(req,res);assert.equal(res.statusCode,200);assert.equal(rows.length,2);
 rows.find(a=>a.role==='ARRIVAL_RAMP').acceptedAt='2026-10-15T08:00:00Z';
 req.body.assignments[1].userId=two;res=response();await handler(req,res);assert.equal(res.statusCode,200);
 assert.equal(rows.find(a=>a.role==='RAMP').userId,two);assert.equal(rows.find(a=>a.role==='ARRIVAL_RAMP').acceptedAt,'2026-10-15T08:00:00Z');
 users[two].airlineQualifications=users[two].airlineQualifications.filter(q=>q.role!=='ARRIVAL_RAMP');
 req.body.assignments[0].userId=two;res=response();await handler(req,res);assert.equal(res.statusCode,400);
 assert.equal(rows.find(a=>a.role==='ARRIVAL_RAMP').userId,one);
});
test('accepting arrival RAMP does not accept departure RAMP, even for the same agent',async()=>{
 const uid='a'.repeat(24),fid='b'.repeat(24),a='c'.repeat(24),d='d'.repeat(24);
 const rows=[{_id:a,turnaroundId:fid,role:'ARRIVAL_RAMP',userId:uid},{_id:d,turnaroundId:fid,role:'RAMP',userId:uid}];
 const match=q=>rows.find(r=>r._id===q._id&&r.userId===q.userId&&r.turnaroundId===q.turnaroundId);
 const router=load('server/routes/acknowledgements.js',{'../models/Assignment':{findOne:async q=>match(q),findOneAndUpdate:async(q,u)=>{const row=match(q);if(!row||row.acceptedAt)return null;Object.assign(row,u.$set);return row;}},'../services/systemMessage':async()=>{}});
 const handler=router.stack.find(l=>l.route?.path==='/:flightId/assignments/:assignmentId/accept').route.stack[0].handle;
 const req={params:{flightId:fid,assignmentId:a},user:{_id:uid,name:'Dispatcher'},app:{get:()=>({to:()=>({emit(){}})})}};
 let res=response();await handler(req,res);assert.equal(res.statusCode,200);assert.ok(rows[0].acceptedAt);assert.equal(rows[1].acceptedAt,undefined);
 req.params.assignmentId=d;res=response();await handler(req,res);assert.equal(res.statusCode,200);assert.ok(rows[1].acceptedAt);
});
test('Arrival RAMP uses arrival day and window, needs separate training, and cannot handle departure documents',async()=>{
 const day=require('../server/services/flightDay'),gate=require('../server/services/gateItems');
 const f={operatingDate:'2026-10-17',departureDayOffset:1,arrival:{staAt:'2026-10-17T21:00:00Z'},departure:{stdAt:'2026-10-18T05:00:00Z'},assignments:[{role:'ARRIVAL_RAMP'}]};
 assert.equal(day.roleOnDay(f,'ARRIVAL_RAMP','2026-10-17'),true);
 assert.equal(day.roleOnDay(f,'ARRIVAL_RAMP','2026-10-18'),false);
 assert.equal(tasks.target(f).label,'STA');assert.equal(control.windowFor(f,'ARRIVAL_RAMP')[0],Date.parse(f.arrival.staAt)-30*60000);
 const user={_id:'arrival',active:true,department:'RAMP',skills:['RAMP','ARRIVAL_RAMP'],airlineQualifications:[{airline:'SQ',role:'RAMP'}]};
 assert.match(qualifications.reason(user,'SQ','ARRIVAL_RAMP','2026-10-17'),/No SQ/);
 user.airlineQualifications.push({airline:'SQ',role:'ARRIVAL_RAMP',validUntil:'2026-10-17'});
 assert.equal(qualifications.reason(user,'SQ','ARRIVAL_RAMP',qualifications.flightDate(f,'ARRIVAL_RAMP')),null);
 assert.equal(qualifications.label('RAMP'),'Departure RAMP');
 const assignments=[{role:'ARRIVAL_RAMP',userId:'arrival'},{role:'RAMP',userId:'departure'}];
 assert.equal(gate.permissions(assignments,user).handle,false);
 assert.equal(gate.permissions(assignments,{...user,_id:'departure'}).handle,true);
 const can=load('server/services/lirAccess.js',{'../models/Assignment':{find:q=>({select(){return this;},limit(){return this;},lean:async()=>assignments.filter(a=>a.role===q.role)})}});
 assert.equal(await can(user,'flight'),false);assert.equal(await can({...user,_id:'departure'},'flight'),true);
});
test('arrival unloading events migrate once; departure events and custom labels stay intact',async()=>{
 const events=new Map(['LAST_BAG','UNLOADING_COMPLETE','LOADING_COMPLETE','PUSHBACK'].map(code=>[code,{_id:code,code,roles:['RAMP','CUSTOM']}]));let updates=0;
 const seed=load('server/seed/eventDefinitions.js',{'../models/EventDefinition':{findOne:async q=>events.get(q.code),create:async e=>events.set(e.code,{...e,_id:e.code}),updateOne:async(q,u)=>{updates++;Object.assign(events.get(q._id),u.$set);}}});
 await seed();await seed();assert.equal(updates,2);
 for(const code of ['LAST_BAG','UNLOADING_COMPLETE'])assert.deepEqual(Array.from(events.get(code).roles),['ARRIVAL_RAMP','CUSTOM']);
 for(const code of ['LOADING_COMPLETE','PUSHBACK'])assert.deepEqual(Array.from(events.get(code).roles),['RAMP','CUSTOM']);
 const roles=new Map([['RAMP',{_id:'RAMP',name:'Ramp'}]]);
 const seedRoles=load('server/seed/roleDefinitions.js',{'../models/RoleDefinition':{findOne:async q=>roles.get(q.code),create:async r=>roles.set(r.code,r),updateOne:async(q,u)=>Object.assign(roles.get(q._id),u.$set)}});
 await seedRoles();await seedRoles();assert.equal(roles.get('RAMP').name,'Departure RAMP');assert.equal(roles.get('ARRIVAL_RAMP').name,'Arrival RAMP');
 roles.get('RAMP').name='Custom name';await seedRoles();assert.equal(roles.get('RAMP').name,'Custom name');
});
