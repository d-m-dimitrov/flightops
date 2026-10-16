const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),{createRequire}=require('node:module');
const access=require('../server/services/departmentAccess'),assignmentRoles=require('../server/services/assignmentAccess');
function load(file,mocks){const filename=path.join(__dirname,'..',file),module={exports:{}},real=createRequire(filename);vm.runInNewContext(fs.readFileSync(filename,'utf8'),{module,require:n=>n in mocks?mocks[n]:real(n),console},{filename});return module.exports;}
test('each duty manager gets only their department roles; Super Admin covers all eight',()=>{
 for(const [department,position]of Object.entries(access.managers)){
  const user={active:true,department,position};assert.deepEqual(assignmentRoles(user),access.departments[department]);
  for(const other of Object.keys(access.departments))assert.equal(access.canManageStaff(user,{department:other}),department===other);
  assert.equal(access.canManageStaff(user,{department,role:'ADMIN'}),false);
 }
 assert.equal(assignmentRoles({active:true,role:'ADMIN'}).length,8);
 assert.equal(access.canManageStaff({active:true,role:'ADMIN'},{department:'RAMP'}),true);
});
test('staff HTTP hides other departments and admin records and blocks cross-department edits, moves and role escalation',async()=>{
 const express=require('express'),ramp='a'.repeat(24),ops='b'.repeat(24),root='c'.repeat(24);let writes=0;
 const users=[{_id:ramp,department:'RAMP',role:'OPERATIONS',name:'Ramp'},{_id:ops,department:'OPERATIONS',role:'OPERATIONS',name:'Ops'},{_id:root,department:'RAMP',role:'ADMIN',name:'Root'}];
 const match=(row,q)=>Object.entries(q).every(([k,v])=>typeof v==='object'?row[k]!==v.$ne:row[k]===v);
 const router=load('server/routes/users.js',{
  '../middleware/requireUser':(req,res,next)=>{req.user={_id:ramp,active:true,department:'RAMP',position:'RAMP_DM',role:req.headers.authorization==='root'?'ADMIN':'OPERATIONS'};next();},
  '../models/User':{find:q=>({select:()=>({sort:async()=>users.filter(u=>match(u,q))})}),findById:async id=>users.find(u=>u._id===id),findOneAndUpdate:async(q,u)=>{const row=users.find(user=>match(user,q));if(!row)return null;writes++;return {toObject:()=>({...row,...u.$set})};},create:async u=>{writes++;return {toObject:()=>u};}}
 });
 const app=express();app.use(express.json());app.use('/users',router);const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
 const call=(url='',method='GET',body,token='dm')=>fetch(`http://127.0.0.1:${server.address().port}/users${url}`,{method,headers:{Authorization:token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
 const body={name:'Ramp',department:'RAMP',position:'RAMP_SUPERVISOR',skills:['RAMP'],active:true};
 try{
  assert.deepEqual((await(await call()).json()).map(u=>u._id),[ramp]);
  assert.equal((await call('/'+ops)).status,404);assert.equal((await call('/'+root)).status,404);
  assert.equal((await call('/'+ops,'PUT',body)).status,404);
  assert.equal((await call('/'+root,'PUT',{...body,password:'replacement password'})).status,404);
  assert.equal((await call('/'+ramp,'PUT',{...body,department:'OPERATIONS'})).status,403);
  assert.equal((await call('/'+ramp,'PUT',{...body,role:'ADMIN'})).status,400);
  assert.equal((await call('','POST',{...body,department:'OPERATIONS'})).status,403);
  assert.equal(writes,0);assert.equal((await call('/'+ramp,'PUT',body)).status,200);assert.equal(writes,1);
  assert.equal((await(await call('','GET',null,'root')).json()).length,3);
 }finally{await new Promise(resolve=>server.close(resolve));}
});
