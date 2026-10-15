const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {createRequire}=require('node:module'),express=require('express');
test('gate items HTTP: roles, version conflicts, per-tag receipt/loading and audit trail',async()=>{
 const flightId='a'.repeat(24);let manifest=null,ramp='r',notices=0;
 const filename=path.join(__dirname,'../server/routes/gateItems.js'),module={exports:{}},real=createRequire(filename);
 const mocks={
 '../middleware/requireUser':(req,res,next)=>{if(!req.headers.authorization)return res.sendStatus(401);req.user={_id:req.headers.authorization,name:req.headers.authorization,active:true};next();},
 '../models/Turnaround':{findOne:()=>({select:async()=>({_id:flightId})})},
 '../models/Assignment':{find:async()=>[{_id:'ga',role:'GATE',userId:'g'},{_id:'ra',role:'RAMP',userId:ramp}]},
 '../models/GateItems':{findOne:()=>({lean:async()=>manifest?structuredClone(manifest):null}),findOneAndUpdate:async(q,u)=>{if((manifest?.version||0)!==q.version)return null;manifest={...u.$set,history:[...(manifest?.history||[]),...u.$push.history.$each]};manifest.items=manifest.items.map(i=>({...i,_id:String(i._id)}));return manifest;}},
 '../services/systemMessage':async()=>{notices++;}
 };
 vm.runInNewContext(fs.readFileSync(filename,'utf8'),{module,console,require:n=>n in mocks?mocks[n]:real(n)},{filename});
 const app=express();app.use(express.json());app.set('io',{to:()=>({emit(){}})});app.use('/items',module.exports);
 const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
 const url=`http://127.0.0.1:${server.address().port}/items/${flightId}`;
 const call=(user,body)=>fetch(url,{method:body?'POST':'GET',headers:{Authorization:user,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
 const submission={action:'submit',assignmentId:'ga',expectedVersion:0,groups:[{type:'BAG',count:1,tags:['00123']},{type:'STROLLER',count:1,tags:['00124']},{type:'WHEELCHAIR',count:1,tags:['00125']}]};
 try{
  assert.equal((await call('other')).status,403);assert.equal((await call('r',submission)).status,403);
  assert.equal((await call('g',submission)).status,200);assert.equal(manifest.version,1);assert.equal(manifest.items.length,3);
  assert.equal((await call('g',submission)).status,409);
  const action={action:'load',assignmentId:'ra',expectedVersion:1,itemId:manifest.items[0]._id};
  assert.equal((await call('r',action)).status,409);assert.equal(manifest.version,1);
  assert.equal((await call('g',{...action,action:'receive'})).status,403);
  assert.equal((await call('r',{...action,action:'receive'})).status,200);assert.equal(manifest.items[0].status,'RECEIVED');
  assert.equal((await call('r',{...action,expectedVersion:2})).status,200);assert.equal(manifest.items[0].status,'LOADED');
  assert.equal(manifest.items[1].status,'SUBMITTED');assert.equal(manifest.history.length,5);
  assert.equal(manifest.history.at(-1).name,'r');assert.equal(manifest.history.at(-1).tag,'00123');
  assert.equal((await call('g',{action:'cancel',assignmentId:'ga',expectedVersion:3,itemId:manifest.items[0]._id})).status,409);
  assert.equal((await call('g',{action:'cancel',assignmentId:'ga',expectedVersion:3,itemId:manifest.items[1]._id})).status,200);
  ramp='new-ramp';assert.equal((await call('r',{...action,action:'receive',expectedVersion:4,itemId:manifest.items[2]._id})).status,403);
  const result=await (await call('g')).json();assert.equal(result.summary.BAG.loaded,1);assert.equal(result.summary.STROLLER.submitted,0);assert.equal(notices,4);
 }finally{await new Promise(resolve=>server.close(resolve));}
});
