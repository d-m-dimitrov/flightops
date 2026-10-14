const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {createRequire}=require('node:module');
const express=require('express');
test('HTTP acknowledgements enforce identity, preserve timestamps, and reset with new assignment or LIR',async()=>{
 const flight='a'.repeat(24),id='b'.repeat(24),userId='c'.repeat(24),docId='d'.repeat(24);
 let assignment={_id:id,turnaroundId:flight,role:'RAMP',userId:{_id:userId,name:'Ramp A'}},latest=docId;
 let doc={_id:docId,turnaroundId:flight,revision:1,receipts:[]},notices=0;
 const filename=path.join(__dirname,'../server/routes/acknowledgements.js'),module={exports:{}},real=createRequire(filename);
 const matches=q=>assignment&&q._id===assignment._id&&String(q.userId)===String(assignment.userId._id);
 const mocks={
 '../middleware/requireUser':(req,res,next)=>{if(!req.headers.authorization)return res.sendStatus(401);req.user={_id:req.headers.authorization,name:'Ramp A',department:'RAMP',active:true};next();},
 '../models/Turnaround':{exists:async()=>true},
 '../models/Assignment':{find:()=>({populate:()=>({limit:async()=>assignment?[assignment]:[]})}),findOne:async q=>matches(q)?assignment:null,findOneAndUpdate:async(q,update)=>{if(!matches(q)||assignment.acceptedAt)return null;Object.assign(assignment,update.$set);return assignment;}},
 '../models/Lir':{findOne:q=>q._id?Promise.resolve(q._id===doc._id?doc:null):{sort:()=>({select:async()=>({_id:latest})})},findOneAndUpdate:async(q,update)=>{if(doc.receipts.some(r=>String(r.assignmentId)===String(q.receipts.$not.$elemMatch.assignmentId)))return null;doc.receipts.push(update.$push.receipts);return doc;}},
 '../services/systemMessage':async()=>{notices++;}
 };
 vm.runInNewContext(fs.readFileSync(filename,'utf8'),{module,require:n=>n in mocks?mocks[n]:real(n),console},{filename});
 const app=express();app.use(express.json());app.set('io',{to:()=>({emit(){}})});app.use('/ack',module.exports);
 const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
 const base=`http://127.0.0.1:${server.address().port}/ack/${flight}`;
 const call=(url,method='GET',body,token=userId)=>fetch(base+url,{method,headers:{Authorization:token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
 try{
  let r=await call(`/assignments/${id}/accept`,'POST',null,'e'.repeat(24));assert.equal(r.status,403);
  r=await call(`/assignments/${id}/accept`,'POST');assert.equal(r.status,200);const first=await r.json();
  r=await call(`/assignments/${id}/accept`,'POST');assert.equal((await r.json()).acceptedAt,first.acceptedAt);assert.equal(notices,1);
  r=await call(`/lir/${docId}`);let data=await r.json();assert.equal(r.status,200);assert.equal(data.canReceive,true);assert.equal(data.receipt,null);
  r=await call(`/lir/${docId}`,'POST',{assignmentId:id},'e'.repeat(24));assert.equal(r.status,403);
  r=await call(`/lir/${docId}`,'POST',{assignmentId:id});assert.equal(r.status,200);
  await call(`/lir/${docId}`,'POST',{assignmentId:id});assert.equal(doc.receipts.length,1);assert.equal(notices,2);
  assignment={...assignment,_id:'f'.repeat(24)};
  r=await call(`/lir/${docId}`);data=await r.json();assert.equal(data.receipt,null);assert.equal(data.history.length,1);
  r=await call(`/lir/${docId}`,'POST',{assignmentId:id});assert.equal(r.status,403);
  latest='1'.repeat(24);r=await call(`/lir/${docId}`,'POST',{assignmentId:assignment._id});assert.equal(r.status,409);
  doc={...doc,_id:latest,revision:2,receipts:[]};r=await call(`/lir/${latest}`);data=await r.json();assert.equal(data.receipt,null);assert.equal(data.history.length,0);
  r=await call(`/lir/${latest}`,'POST',{assignmentId:assignment._id});assert.equal(r.status,200);
  assignment=null;r=await call(`/lir/${latest}`,'POST',{assignmentId:id});assert.equal(r.status,403);
 }finally{await new Promise(resolve=>server.close(resolve));}
});
