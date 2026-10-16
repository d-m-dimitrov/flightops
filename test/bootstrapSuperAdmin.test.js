const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
function setup(){let admins=[],emailUsed=false,created=[],indexes=0,hashed=[];const module={exports:{}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../server/services/bootstrapSuperAdmin.js'),'utf8'),{module,console:{log(){}},require:name=>name==='bcryptjs'?{hash:async(p,cost)=>{hashed.push({p,cost});return 'hash';}}:{find:()=>({select:()=>({limit:async()=>admins})}),exists:async()=>emailUsed,collection:{createIndex:async()=>indexes++},create:async user=>created.push(user)}});return {run:module.exports,created,hashed,setAdmins:v=>admins=v,setEmail:v=>emailUsed=v,indexes:()=>indexes};}
test('bootstrap is opt-in, hashes password, creates one admin, and does not replace existing credentials',async()=>{
 const s=setup();await s.run({});assert.equal(s.created.length,0);
 const env={SUPER_ADMIN_EMAIL:'Root@example.com',SUPER_ADMIN_PASSWORD:'a unique password 123'};
 await s.run(env);assert.equal(s.created[0].email,'root@example.com');assert.equal(s.created[0].role,'ADMIN');assert.equal(s.created[0].passwordHash,'hash');assert.equal(s.indexes(),1);assert.equal(s.hashed[0].cost,12);
 s.setAdmins([{email:'root@example.com',active:true}]);await s.run({SUPER_ADMIN_EMAIL:'root@example.com'});assert.equal(s.created.length,1);
 s.setAdmins([{email:'other@example.com',active:true}]);await assert.rejects(s.run(env),/already exists/);assert.equal(s.created.length,1);
});
test('bootstrap rejects weak passwords, existing staff emails and multiple admins before any mutation',async()=>{
 const s=setup(),env={SUPER_ADMIN_EMAIL:'root@example.com',SUPER_ADMIN_PASSWORD:'a unique password 123'};
 await assert.rejects(s.run({...env,SUPER_ADMIN_PASSWORD:'short'}),/16 characters/);
 s.setEmail(true);await assert.rejects(s.run(env),/existing account/);assert.equal(s.created.length,0);assert.equal(s.indexes(),0);
 s.setAdmins([{email:'a'},{email:'b'}]);await assert.rejects(s.run(env),/Multiple/);
});

test('login exposes Super Admin role without password hash and refuses inactive accounts',async()=>{
 const {createRequire}=require('node:module'),filename=path.join(__dirname,'../server/routes/auth.js'),real=createRequire(filename),module={exports:{}};
 const user={_id:'a'.repeat(24),name:'Super Admin',email:'root@example.com',role:'ADMIN',active:true,department:'OPERATIONS',position:'OPERATIONS_DM',passwordHash:'private'};
 vm.runInNewContext(fs.readFileSync(filename,'utf8'),{module,process:{env:{JWT_SECRET:'test-secret'}},require:n=>n==='bcryptjs'?{compare:async()=>true}:n==='jsonwebtoken'?{sign:()=> 'signed-token'}:n==='../models/User'?{findOne:async()=>user}:real(n)});
 const handler=module.exports.stack.find(l=>l.route?.path==='/login').route.stack[0].handle;
 const response=()=>({code:200,status(n){this.code=n;return this;},json(value){this.value=value;}});
 let res=response();await handler({body:{email:user.email,password:'password'}},res);assert.equal(res.value.user.role,'ADMIN');assert.equal(res.value.user.passwordHash,undefined);
 user.active=false;res=response();await handler({body:{email:user.email,password:'password'}},res);assert.equal(res.code,401);assert.equal(res.value.token,undefined);
});
