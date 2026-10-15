const test=require('node:test'),assert=require('node:assert/strict');
const Q=require('../client/js/airlineQualifications');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),{createRequire}=require('node:module');
function load(file,mocks){const filename=path.join(__dirname,'..',file),module={exports:{}},real=createRequire(filename);vm.runInNewContext(fs.readFileSync(filename,'utf8'),{module,require:n=>n in mocks?mocks[n]:real(n),console},{filename});return module.exports;}
function response(){return {statusCode:200,status(n){this.statusCode=n;return this;},json(body){this.body=body;return this;}};}
const trained={active:true,department:'RAMP',skills:['RAMP','GATE'],airlineQualifications:[{airline:'SQ',role:'RAMP',validUntil:'2026-10-15'}]};
test('qualification needs exact airline and role, basic skill and active agent; expiry includes flight operating date',()=>{
 assert.equal(Q.eligible(trained,' sq ','RAMP','2026-10-15'),true);
 assert.equal(Q.eligible(trained,'SQ','RAMP','2026-10-16'),false);
 assert.equal(Q.eligible(trained,'CX','RAMP','2026-10-15'),false);
 assert.equal(Q.eligible(trained,'SQ','GATE','2026-10-15'),false);
 assert.equal(Q.eligible({...trained,skills:[]},'SQ','RAMP','2026-10-15'),false);
 assert.equal(Q.eligible({...trained,active:false},'SQ','RAMP','2026-10-15'),false);
 assert.equal(Q.eligible({...trained,airlineQualifications:[]},'SQ','RAMP','2026-10-15'),false);
 assert.equal(Q.eligible({...trained,department:'OPERATIONS'},'SQ','RAMP','2026-10-15'),false);
 assert.equal(Q.eligible(trained,'SQ','RAMP','2026-02-30'),false);
 assert.equal(Q.eligible({...trained,airlineQualifications:[{airline:'SQ',role:'RAMP',validUntil:null}]},'SQ','RAMP','2027-12-31'),true);
});
test('qualification input normalizes airline codes and rejects duplicates, impossible dates and malformed unlimited expiry',()=>{
 assert.deepEqual(Q.normalize([{airline:' sq ',role:'GATE',validUntil:''}]),[{airline:'SQ',role:'GATE',validUntil:null}]);
 assert.throws(()=>Q.normalize([{airline:'SQ',role:'GATE'},{airline:'sq',role:'GATE'}]),/Duplicate/);
 assert.throws(()=>Q.normalize([{airline:'SQ',role:'GATE',validUntil:'2026-02-30'}]),/expiry/);
 assert.throws(()=>Q.normalize([{airline:'SQ',role:'GATE',validUntil:false}]),/expiry/);
 assert.throws(()=>Q.normalize([{airline:'*',role:'GATE'}]),/airline/);
 assert.throws(()=>Q.normalize([{airline:'SQ',role:'ADMIN'}]),/role/);
});
test('assignment API blocks unqualified candidates for managers and admins before any mutation; no client bypass',async()=>{
 const flightId='a'.repeat(24),userId='b'.repeat(24);let target={...trained,name:'Ramp Agent'},flight={airline:'SQ',operatingDate:'2026-10-16'},mutations=0;
 const router=load('server/routes/assignments.js',{
  '../models/Turnaround':{findOne:async()=>flight},
  '../models/Assignment':{find:()=>({populate:async()=>[]}),deleteMany:async()=>mutations++,create:async()=>mutations++},
  '../models/User':{findById:async()=>target},'../models/ChatMessage':{create:async()=>{}},'../services/lirLive':{clearFlight(){}}
 });
 const handler=router.stack.find(l=>l.route?.methods.post).route.stack[0].handle;
 const req={params:{turnaroundId:flightId},user:{active:true,role:'ADMIN',name:'Admin'},body:{assignments:[{role:'RAMP',userId}],override:true,airline:'CX',operatingDate:'2026-10-15'},app:{get:()=>({to:()=>({emit(){}})})}};
 let res=response();await handler(req,res);assert.equal(res.statusCode,400);assert.match(res.body.error,/expired/);assert.equal(mutations,0);
 req.user={active:true,department:'OPERATIONS',position:'OPERATIONS_DM',name:'Manager'};
 target={...target,airlineQualifications:[]};res=response();await handler(req,res);assert.equal(res.statusCode,400);assert.equal(mutations,0);
 target={...target,airlineQualifications:[{airline:'SQ',role:'RAMP',validUntil:'2026-10-16'}]};
 res=response();await handler(req,res);assert.equal(res.statusCode,200);assert.equal(mutations,2);
 flight=null;res=response();await handler(req,res);assert.equal(res.statusCode,404);assert.equal(mutations,2);
});
test('staff updates validate qualifications, preserve omitted data and reject stale qualification revision',async()=>{
 let updateCall,save=true;
 const router=load('server/routes/users.js',{
  '../models/User':{findOneAndUpdate:async(filter,update)=>{updateCall={filter,update};return save?{toObject:()=>({name:'Agent',passwordHash:'private'})}:null;}}
 });
 const handler=router.stack.find(l=>l.route?.methods.put).route.stack[0].handle;
 const req={params:{id:'a'.repeat(24)},user:{_id:'b'.repeat(24)},body:{name:'Agent',skills:['GATE'],airlineQualifications:[{airline:'sq',role:'GATE',validUntil:'2027-01-01'}],expectedQualificationRevision:2}};
 let res=response();await handler(req,res);assert.equal(res.statusCode,200);assert.equal(updateCall.filter.qualificationRevision,2);assert.equal(updateCall.update.$inc.qualificationRevision,1);assert.equal(updateCall.update.$set.airlineQualifications[0].airline,'SQ');assert.equal(res.body.passwordHash,undefined);
 save=false;res=response();await handler(req,res);assert.equal(res.statusCode,409);
 save=true;delete req.body.airlineQualifications;res=response();await handler(req,res);assert.equal(updateCall.update.$set.airlineQualifications,undefined);assert.equal(updateCall.update.$inc,undefined);
 req.body.airlineQualifications=[{airline:'SQ',role:'GATE',validUntil:'invalid'}];updateCall=null;res=response();await handler(req,res);assert.equal(res.statusCode,400);assert.equal(updateCall,null);
});

test('ordinary agents and allocators cannot grant themselves airline training through the staff API',async()=>{
 const express=require('express');let writes=0;
 const router=load('server/routes/users.js',{
  '../middleware/requireUser':(req,res,next)=>{req.user={active:true,department:'RAMP',position:req.headers['x-position']||'RAMP_SUPERVISOR',role:'OPERATIONS'};next();},
  '../models/User':{findOneAndUpdate:async()=>{writes++;return null;},create:async()=>{writes++;return null;}}
 });
 const app=express();app.use(express.json());app.use('/api/users',router);const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 try{
  for(const position of ['RAMP_SUPERVISOR','RAMP_ALLOCATOR']){
   const response=await fetch(`http://127.0.0.1:${server.address().port}/api/users/${'a'.repeat(24)}`,{method:'PUT',headers:{'Content-Type':'application/json','x-position':position},body:JSON.stringify({airlineQualifications:[{airline:'SQ',role:'RAMP'}],expectedQualificationRevision:0})});
   assert.equal(response.status,403);
  }
  assert.equal(writes,0);
 }finally{await new Promise(r=>server.close(r));}
});
