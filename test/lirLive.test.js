const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {createRequire}=require('node:module');
test('live LIR authenticates viewers, isolates documents, protects RAMP ownership and clears ephemeral drafts',async()=>{
 const filename=path.join(__dirname,'../server/services/lirLive.js'),module={exports:{}},real=createRequire(filename);
 let now=100000,expiredSweep,assigned=true;
 const docs={['a'.repeat(24)]:{_id:'a'.repeat(24),turnaroundId:'f1',annotationVersion:0,status:'UPLOADED'},['b'.repeat(24)]:{_id:'b'.repeat(24),turnaroundId:'f2',annotationVersion:0,status:'UPLOADED'}};
 const users={['1'.repeat(24)]:{active:true,department:'RAMP',name:'Ramp One'},['2'.repeat(24)]:{active:true,department:'OPERATIONS',name:'Ops'},['3'.repeat(24)]:{active:true,department:'RAMP',name:'Ramp Two'},['4'.repeat(24)]:{active:true,department:'PASSENGER_HANDLING'}};
 const query=value=>({select:async()=>value});
 const mocks={'./lirAccess':async()=>assigned,'jsonwebtoken':{verify:token=>{if(!users[token])throw Error();return {id:token,exp:100000};}},'../models/User':{findById:id=>query(users[id])},'../models/Lir':{findById:id=>query(docs[id]),findOne:filter=>({sort:()=>query(Object.values(docs).find(d=>d.turnaroundId===filter.turnaroundId))})},'../models/Turnaround':{exists:async()=>true}};
 vm.runInNewContext(fs.readFileSync(filename,'utf8'),{module,process:{env:{JWT_SECRET:"test"}},require:n=>n in mocks?mocks[n]:real(n),Date:{now:()=>now},setTimeout:()=>({unref(){}}),clearTimeout(){},setInterval:fn=>{expiredSweep=fn;return {unref(){}};},clearInterval(){}},{filename});
 const sockets=[],events=[];let authenticate,connect;
 const ns={use:fn=>authenticate=fn,on:(name,fn)=>connect=fn,to:room=>({emit:(name,data)=>{events.push({room,name,data});for(const s of sockets)if(s.rooms.has(room))s.received.push({name,data});}})};
 const io={of:()=>ns};module.exports.attach(io);
 async function socket(id,user){
  const s={id,connected:true,data:{},handshake:{auth:{token:user}},rooms:new Set(),handlers:{},received:[],on(name,fn){this.handlers[name]=fn;},emit(name,data){this.received.push({name,data});},join(r){this.rooms.add(r);},leave(r){this.rooms.delete(r);},to:r=>({emit:(name,data)=>{for(const other of sockets)if(other!==s&&other.rooms.has(r))other.received.push({name,data});}}),disconnect(){this.connected=false;this.handlers.disconnect?.();}};
  const error=await new Promise(resolve=>authenticate(s,resolve));if(error)return {error};sockets.push(s);connect(s);return s;
 }
 const send=(s,name,body={})=>new Promise(resolve=>s.handlers[name](body,resolve));
 assert.ok((await socket('invalid','invalid')).error);
 assert.ok((await socket('passenger','4'.repeat(24))).error);
 const ramp=await socket('ramp','1'.repeat(24)),ops=await socket('ops','2'.repeat(24)),other=await socket('other','3'.repeat(24));
 const id='a'.repeat(24),payload={documentId:id,expectedVersion:0,annotations:[{type:'tick',page:1,x:.2,y:.4}]};
 assert.equal((await send(ramp,'draft',payload)).ok,false); // Cannot broadcast without joining.
 await send(ramp,'watch',{documentId:id});await send(ops,'watch',{documentId:id});await send(other,'watch',{documentId:'b'.repeat(24)});
 assert.equal((await send(ops,'draft',payload)).ok,false);
 assert.equal((await send(ramp,'draft',payload)).ok,true);
 assert.equal(ops.received.at(-1).data.author,'Ramp One');assert.equal(other.received.length,0);
 // Re-watching the same document must not clear the active owner's draft.
 const clearedBefore=ops.received.filter(e=>e.name==='draftCleared').length;
 await send(ramp,'watch',{documentId:id});
 assert.equal(ops.received.filter(e=>e.name==='draftCleared').length,clearedBefore);
 await send(other,'watch',{documentId:id});assert.equal(other.received.at(-1).data.annotations.length,1); // Late join receives preview.
 assert.equal((await send(other,'draft',payload)).ok,false); // One preview owner.
 ramp.disconnect();assert.equal(ops.received.at(-1).name,'draftCleared');
 now+=200;assert.equal((await send(other,'draft',payload)).ok,true);
 module.exports.clearFlight(io,'f1');assert.equal(ops.received.at(-1).name,'draftCleared');
 now+=200;await send(other,'draft',payload);now+=31000;expiredSweep();assert.equal(ops.received.at(-1).name,'draftCleared');
 assigned=false;now+=200;assert.equal((await send(other,'draft',payload)).ok,false);assigned=true;
 docs[id].annotationVersion=1;now+=200;assert.equal((await send(other,'draft',payload)).ok,false);
 docs[id].status='COMPLETED';now+=200;assert.equal((await send(other,'draft',{...payload,expectedVersion:1})).ok,false);
 assert.equal(events.some(e=>e.name==='draftCleared'),true);
});
