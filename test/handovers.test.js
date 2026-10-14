const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {createRequire}=require('node:module');const express=require('express');
test('handover HTTP: exact assignees, version conflicts, idempotent Gate receipt and reassignment',async()=>{
 const flightId='a'.repeat(24);let seq=0,documents=[],gateId='g1',notices=0;
 const assignments=()=>[{_id:'c1',role:'CHECKIN',userId:'checkin'},{_id:gateId,role:'GATE',userId:'gate'}];
 const filename=path.join(__dirname,'../server/routes/handovers.js'),module={exports:{}},real=createRequire(filename);
 const mocks={'../middleware/requireUser':(req,res,next)=>{if(!req.headers.authorization)return res.sendStatus(401);req.user={_id:req.headers.authorization,name:req.headers.authorization,active:true};next();},
 '../models/Turnaround':{findOne:async()=>({_id:flightId,handoverSequence:seq,operatingDate:'2026-10-14'}),findOneAndUpdate:async q=>{if((q.handoverSequence??0)!==seq)return null;return {_id:flightId,handoverSequence:++seq};}},
 '../models/Assignment':{find:async()=>assignments()},
 '../models/Handover':{find:()=>({sort:async()=>[...documents].reverse()}),findOne:()=>({sort:async()=>documents.at(-1)}),create:async data=>{const doc={...data,_id:'v'+seq,receipts:[]};documents.push(doc);return doc;},findOneAndUpdate:async(q,u)=>{const doc=documents.find(d=>d._id===q._id);if(doc.receipts.some(r=>r.assignmentId===q.receipts.$not.$elemMatch.assignmentId))return null;doc.receipts.push(u.$push.receipts);return doc;}},
 '../services/systemMessage':async()=>{notices++;}};
 vm.runInNewContext(fs.readFileSync(filename,'utf8'),{module,console,require:n=>n in mocks?mocks[n]:real(n)},{filename});
 const app=express();app.use(express.json());app.set('io',{to:()=>({emit(){}})});app.use('/handover',module.exports);
 const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});const base=`http://127.0.0.1:${server.address().port}/handover/${flightId}`;
 const call=(user,method='GET',body,suffix='')=>fetch(base+suffix,{method,headers:{Authorization:user,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
 const payload={assignmentId:'c1',expectedSequence:0,checkedIn:240,infants:3,bags:260,notes:'Two WCHR passengers; meet at gate.'};
 try{
  assert.equal((await call('stranger')).status,403);
  assert.equal((await call('gate','POST',payload)).status,403);
  assert.equal((await call('checkin','POST',payload)).status,201);assert.equal(seq,1);
  assert.equal((await call('checkin','POST',payload)).status,409);
  const received={assignmentId:'g1',handoverId:'v1'};
  assert.equal((await call('checkin','POST',received,'/receive')).status,403);
  assert.equal((await call('gate','POST',received,'/receive')).status,200);
  await call('gate','POST',received,'/receive');assert.equal(documents[0].receipts.length,1);assert.equal(notices,2);
  gateId='g2';let data=await (await call('gate')).json();assert.equal(data.receipt,null);
  assert.equal((await call('gate','POST',received,'/receive')).status,409);
  assert.equal((await call('checkin','POST',{...payload,expectedSequence:1,bags:261})).status,201);
  assert.equal((await call('gate','POST',{...received,assignmentId:'g2'},'/receive')).status,409);
  data=await (await call('gate')).json();assert.equal(data.versions.length,2);assert.equal(data.versions[0].bags,261);assert.equal(data.receipt,null);
 }finally{await new Promise(resolve=>server.close(resolve));}
});
