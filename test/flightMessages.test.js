const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),{createRequire}=require('node:module');
const rules=require('../server/services/flightMessages');
test('messages preserve original whitespace and validate type, movement, length and submission ID',()=>{
 const body={type:'CPM',direction:'ARRIVAL',text:'CPM\r\n  SQ317/17.9VABC\n-END  ',requestId:'11111111-1111-4111-8111-111111111111'};
 assert.equal(rules.validate(body).text,body.text);
 for(const change of [{type:'CHAT'},{direction:'BOTH'},{text:'  '},{text:'x'.repeat(30001)},{requestId:'bad'}])assert.throws(()=>rules.validate({...body,...change}));
 assert.equal(rules.canAdd({active:true,department:'OPERATIONS'}),true);
 assert.equal(rules.canAdd({active:true,department:'RAMP'}),false);
 assert.equal(rules.canAdd({active:false,role:'ADMIN'}),false);
});
test('Messages HTTP enforces flight-team reads, OPS writes, server authors, filters, pagination and safe retries',async()=>{
 const express=require('express'),flightId='a'.repeat(24),ops='b'.repeat(24),team='c'.repeat(24),rows=[];let emitted=[];
 const filename=path.join(__dirname,'../server/routes/flightMessages.js'),module={exports:{}},real=createRequire(filename);
 const chain=values=>({select(){return this;},sort(){return this;},limit(n){this.n=n;return this;},lean:async function(){return values.slice(0,this.n);}});
 const mocks={
  '../middleware/requireUser':(req,res,next)=>{const id=req.headers.authorization;if(!id)return res.status(401).json({error:'Sign in'});req.user={_id:id,active:true,name:'Trusted author',department:id===ops?'OPERATIONS':'RAMP'};next();},
  '../models/Turnaround':{findOne:q=>({select:async()=>q._id===flightId?{_id:flightId,operatingDate:'2026-10-17',arrivalFlight:'SQ317',departureFlight:'SQ318'}:null})},
  '../models/Assignment':{exists:async q=>q.userId===team},
  '../models/FlightMessage':{
   create:async value=>{if(rows.some(r=>r.requestId===value.requestId&&r.createdBy===value.createdBy))throw {code:11000};const row={...value,_id:(rows.length+1).toString(16).padStart(24,'0'),createdAt:new Date()};rows.unshift(row);return row;},
   findOne:async q=>rows.find(r=>r.requestId===q.requestId&&r.createdBy===q.createdBy&&r.turnaroundId===q.turnaroundId),
   find:q=>chain(rows.filter(r=>r.turnaroundId===q.turnaroundId&&(!q.type||r.type===q.type)&&(!q.direction||r.direction===q.direction)&&(!q._id||r._id<q._id.$lt)))
  }
 };
 vm.runInNewContext(fs.readFileSync(filename,'utf8'),{module,require:n=>n in mocks?mocks[n]:real(n),console},{filename});
 const app=express();app.use(express.json());app.set('io',{to:id=>({emit:(...args)=>emitted.push({id,args})})});app.use('/messages',module.exports);
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base=`http://127.0.0.1:${server.address().port}/messages/`;
 const req=(id=team,options={},suffix=flightId)=>fetch(base+suffix,{...options,headers:{...(id?{Authorization:id}:{}),'Content-Type':'application/json'}});
 const body={type:'MVT',direction:'DEPARTURE',text:'MVT\nSQ318/18\n  AD0500',createdByName:'Spoofed',requestId:'11111111-1111-4111-8111-111111111111'},post={method:'POST',body:JSON.stringify(body)};
 try{
  assert.equal((await req(null)).status,401);assert.equal((await req('outsider')).status,403);
  assert.equal((await req(team,post)).status,403);assert.equal((await req(ops,post,'bad')).status,400);
  assert.equal((await req(ops,post,'d'.repeat(24))).status,404);
  assert.equal((await req(ops,post)).status,201);assert.equal((await req(ops,post)).status,200);assert.equal(rows.length,1);
  assert.equal(rows[0].createdByName,'Trusted author');assert.equal(emitted.length,1);assert.deepEqual(emitted[0].args,['flightMessagesUpdated']);
  assert.equal((await req(ops,{method:'POST',body:JSON.stringify({...body,text:'different'})})).status,409);
  const read=await (await req()).json();assert.equal(read.canAdd,false);assert.equal(read.messages[0].text,body.text);
  assert.equal((await (await req(team,{},flightId+'?direction=ARRIVAL')).json()).messages.length,0);
  assert.equal((await req(team,{},flightId+'?type=OTHER')).status,400);
  for(let i=0;i<51;i++)rows.unshift({...rows[0],_id:(i+2).toString(16).padStart(24,'0')});
  const first=await (await req()).json();assert.equal(first.messages.length,50);assert.ok(first.nextCursor);
  const second=await (await req(team,{},flightId+'?before='+first.nextCursor)).json();assert.equal(second.messages.length,2);assert.equal(second.nextCursor,null);
 }finally{await new Promise(r=>server.close(r));}
});
