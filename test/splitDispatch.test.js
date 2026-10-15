const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),{createRequire}=require('node:module');
const qualifications=require('../client/js/airlineQualifications'),tasks=require('../client/js/flightTasks'),control=require('../client/js/controlModel');
function load(file,mocks){const filename=path.join(__dirname,'..',file),module={exports:{}},real=createRequire(filename);vm.runInNewContext(fs.readFileSync(filename,'utf8'),{module,require:n=>n in mocks?mocks[n]:real(n),console:{log(){},error(){}}},{filename});return module.exports;}
function response(){return {statusCode:200,status(n){this.statusCode=n;return this;},json(body){this.body=body;return this;}};}
test('arrival dispatcher is separate from passenger arrival and legacy dispatch training remains departure-only',()=>{
 const user={active:true,department:'OPERATIONS',skills:['DISPATCH','ARRIVAL_DISPATCH'],airlineQualifications:[{airline:'SQ',role:'DISPATCH',validUntil:null}]};
 assert.equal(qualifications.eligible(user,'SQ','DISPATCH','2026-10-15'),true);
 assert.equal(qualifications.eligible(user,'SQ','ARRIVAL_DISPATCH','2026-10-15'),false);
 user.airlineQualifications.push({airline:'SQ',role:'ARRIVAL_DISPATCH',validUntil:null});
 assert.equal(qualifications.eligible(user,'SQ','ARRIVAL_DISPATCH','2026-10-15'),true);
 assert.equal(qualifications.eligible(user,'SQ','ARRIVAL','2026-10-15'),false);
 const flight={assignments:[{role:'ARRIVAL_DISPATCH'}],arrival:{eta:'2026-10-15T09:00:00Z'},departure:{etd:'2026-10-15T13:00:00Z'}};
 assert.equal(tasks.target(flight).label,'ETA');
 assert.deepEqual(control.windowFor(flight,'ARRIVAL_DISPATCH'),[Date.parse('2026-10-15T08:30:00Z'),Date.parse('2026-10-15T09:30:00Z')]);
 assert.deepEqual(control.windowFor(flight,'DISPATCH'),[Date.parse('2026-10-15T10:30:00Z'),Date.parse('2026-10-15T13:30:00Z')]);
 flight.assignments.push({role:'DISPATCH'});assert.equal(tasks.target(flight).label,'ETD');
 assert.equal(tasks.actions(flight).filter(t=>t.startsWith('Accept')).length,2);
 assert.equal(qualifications.label('ARRIVAL'),'Arrival Agent');
});
test('Traffic Coordinator can allocate both dispatcher roles to one or different agents and preserve unchanged acceptance',async()=>{
 const flightId='a'.repeat(24),one='b'.repeat(24),two='c'.repeat(24),rows=[];
 const users={};for(const id of [one,two])users[id]={_id:id,name:id,active:true,department:'OPERATIONS',skills:['DISPATCH','ARRIVAL_DISPATCH'],airlineQualifications:[{airline:'SQ',role:'DISPATCH'},{airline:'SQ',role:'ARRIVAL_DISPATCH'}]};
 const router=load('server/routes/assignments.js',{
  '../models/Turnaround':{findOne:async()=>({airline:'SQ',operatingDate:'2026-10-15'})},
  '../models/User':{findById:async id=>users[id]},
  '../models/Assignment':{find:()=>({populate:async()=>rows.map(a=>({...a,userId:users[a.userId]}))}),deleteMany:async q=>{for(let i=rows.length-1;i>=0;i--)if(q.role.$in.includes(rows[i].role))rows.splice(i,1);},create:async a=>rows.push({...a,_id:String(rows.length+1)})},
  '../models/ChatMessage':{create:async()=>{}},'../services/lirLive':{clearFlight(){}}
 });
 const handler=router.stack.find(l=>l.route?.methods.post).route.stack[0].handle;
 const req={params:{turnaroundId:flightId},user:{active:true,department:'OPERATIONS',position:'TRAFFIC_COORDINATOR'},body:{assignments:[{role:'ARRIVAL_DISPATCH',userId:one},{role:'DISPATCH',userId:one}]},app:{get:()=>({to:()=>({emit(){}})})}};
 let res=response();await handler(req,res);assert.equal(res.statusCode,200);assert.equal(rows.length,2);
 rows.find(a=>a.role==='ARRIVAL_DISPATCH').acceptedAt='2026-10-15T08:00:00Z';
 req.body.assignments[1].userId=two;res=response();await handler(req,res);assert.equal(res.statusCode,200);
 assert.equal(rows.find(a=>a.role==='DISPATCH').userId,two);assert.equal(rows.find(a=>a.role==='ARRIVAL_DISPATCH').acceptedAt,'2026-10-15T08:00:00Z');
 users[two].airlineQualifications=users[two].airlineQualifications.filter(q=>q.role!=='ARRIVAL_DISPATCH');
 req.body.assignments[0].userId=two;res=response();await handler(req,res);assert.equal(res.statusCode,400);
 assert.equal(rows.find(a=>a.role==='ARRIVAL_DISPATCH').userId,one);
});
test('accepting arrival dispatch does not accept departure dispatch, even for the same agent',async()=>{
 const uid='a'.repeat(24),fid='b'.repeat(24),a='c'.repeat(24),d='d'.repeat(24);
 const rows=[{_id:a,turnaroundId:fid,role:'ARRIVAL_DISPATCH',userId:uid},{_id:d,turnaroundId:fid,role:'DISPATCH',userId:uid}];
 const match=q=>rows.find(r=>r._id===q._id&&r.userId===q.userId&&r.turnaroundId===q.turnaroundId);
 const router=load('server/routes/acknowledgements.js',{'../models/Assignment':{findOne:async q=>match(q),findOneAndUpdate:async(q,u)=>{const row=match(q);if(!row||row.acceptedAt)return null;Object.assign(row,u.$set);return row;}},'../services/systemMessage':async()=>{}});
 const handler=router.stack.find(l=>l.route?.path==='/:flightId/assignments/:assignmentId/accept').route.stack[0].handle;
 const req={params:{flightId:fid,assignmentId:a},user:{_id:uid,name:'Dispatcher'},app:{get:()=>({to:()=>({emit(){}})})}};
 let res=response();await handler(req,res);assert.equal(res.statusCode,200);assert.ok(rows[0].acceptedAt);assert.equal(rows[1].acceptedAt,undefined);
 req.params.assignmentId=d;res=response();await handler(req,res);assert.equal(res.statusCode,200);assert.ok(rows[1].acceptedAt);
});
test('startup seeds migrate arrival event roles and legacy labels once without altering other event roles',async()=>{
 const events=new Map([['LANDED',{_id:'land',code:'LANDED',roles:['DISPATCH','RAMP']}],['ON_BLOCKS',{_id:'blocks',code:'ON_BLOCKS',roles:['DISPATCH']}]]),roles=new Map([['DISPATCH',{_id:'dispatch',code:'DISPATCH',name:'Dispatcher'}],['ARRIVAL',{_id:'arrival',code:'ARRIVAL',name:'Arrival'}]]);
 let eventUpdates=0,roleUpdates=0;
 const seedEvents=load('server/seed/eventDefinitions.js',{'../models/EventDefinition':{findOne:async q=>events.get(q.code),create:async e=>events.set(e.code,{...e,_id:e.code}),updateOne:async(q,u)=>{eventUpdates++;Object.assign([...events.values()].find(e=>e._id===q._id),u.$set);}}});
 const seedRoles=load('server/seed/roleDefinitions.js',{'../models/RoleDefinition':{findOne:async q=>roles.get(q.code),create:async r=>roles.set(r.code,{...r,_id:r.code}),updateOne:async(q,u)=>{roleUpdates++;Object.assign([...roles.values()].find(r=>r._id===q._id),u.$set);}}});
 await seedEvents();await seedRoles();await seedEvents();await seedRoles();
 assert.equal(eventUpdates,2);assert.equal(roleUpdates,2);
 assert.deepEqual(Array.from(events.get('LANDED').roles),['ARRIVAL_DISPATCH','RAMP']);
 assert.deepEqual(Array.from(events.get('AIRBORNE').roles),['DISPATCH']);
 assert.deepEqual(Array.from(events.get('FIRST_PAX_OFF').roles),['ARRIVAL']);
 assert.equal(roles.get('DISPATCH').name,'Departure Dispatcher');assert.equal(roles.get('ARRIVAL_DISPATCH').name,'Arrival Dispatcher');assert.equal(roles.get('ARRIVAL').name,'Arrival Agent');
});
