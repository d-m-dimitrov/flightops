const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {createRequire}=require('node:module');
function load(file,mocks){const filename=path.join(__dirname,'..',file),module={exports:{}},real=createRequire(filename);vm.runInNewContext(fs.readFileSync(filename,'utf8'),{module,require:n=>n in mocks?mocks[n]:real(n),console},{filename});return module.exports;}
function response(){return {statusCode:200,status(n){this.statusCode=n;return this;},json(body){this.body=body;return this;}};}
test('only current RAMP assignment grants LIR edits, with no admin or skill bypass',async()=>{
 let assigned='u1';
 const can=load('server/services/lirAccess.js',{'../models/Assignment':{exists:async q=>q.turnaroundId==='f1'&&q.role==='RAMP'&&q.userId===assigned}});
 const user={_id:'u1',department:'RAMP',active:true};
 assert.equal(await can(user,'f1'),true);
 assert.equal(await can(user,'f2'),false);
 assert.equal(await can({...user,_id:'u2',role:'ADMIN'},'f1'),false);
 assert.equal(await can({...user,department:'OPERATIONS',role:'ADMIN'},'f1'),false);
 assert.equal(await can({...user,active:false},'f1'),false);
 assigned='u2';assert.equal(await can(user,'f1'),false);assert.equal(await can({...user,_id:'u2'},'f1'),true);
 assigned=null;assert.equal(await can(user,'f1'),false);
});
test('ordinary RAMP agent cannot self-assign through the API; allocator preserves other departments',async()=>{
 const flightId='a'.repeat(24),userId='b'.repeat(24),deletions=[],created=[];
 const router=load('server/routes/assignments.js',{'../models/Assignment':{find:()=>({populate:async()=>[]}),deleteMany:async q=>deletions.push(q),create:async a=>created.push(a)},'../models/User':{findById:async()=>({_id:userId,name:'Assigned Ramp',active:true,department:'RAMP',skills:['RAMP']})},'../models/ChatMessage':{create:async()=>{}},'../services/lirLive':{clearFlight(){}}});
 const save=router.stack.find(l=>l.route?.methods.post).route.stack[0].handle;
 const req={params:{turnaroundId:flightId},body:{assignments:[{role:'RAMP',userId}],updatedByName:'Spoofed'},user:{active:true,department:'RAMP',position:'RAMP_SUPERVISOR',name:'Allocator'},app:{get:()=>({to:()=>({emit(){}})})}};
 let res=response();await save(req,res);assert.equal(res.statusCode,403);assert.equal(created.length,0);
 req.user.position='RAMP_ALLOCATOR';res=response();await save(req,res);assert.equal(res.statusCode,200);assert.deepEqual(Array.from(deletions[0].role.$in),['RAMP']);assert.equal(created.length,1);
 req.body.assignments=[{role:'DISPATCH',userId}];res=response();await save(req,res);assert.equal(res.statusCode,400);assert.equal(created.length,1);
});
