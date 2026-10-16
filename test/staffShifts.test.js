const test=require('node:test'),assert=require('node:assert/strict');
const shifts=require('../server/services/staffShifts'),availability=require('../client/js/shiftAvailability');
const input={date:'2026-10-15',status:'WORKING',start:'2026-10-15T22:00',end:'2026-10-16T06:00',breaks:[{start:'2026-10-16T02:00',end:'2026-10-16T02:30'}],expectedRevision:0};
test('shift validation handles London overnight shifts and rejects invalid or overlapping breaks',()=>{
 const shift=shifts.validate(input);
 assert.equal(shift.start.toISOString(),'2026-10-15T21:00:00.000Z');assert.equal(shift.end.toISOString(),'2026-10-16T05:00:00.000Z');
 assert.throws(()=>shifts.validate({...input,end:input.start}),/longer/);
 assert.throws(()=>shifts.validate({...input,date:'2026-10-16'}),/roster date/);
 assert.throws(()=>shifts.validate({...input,breaks:[{start:'2026-10-15T21:00',end:'2026-10-15T22:30'}]}),/inside/);
 assert.throws(()=>shifts.validate({...input,breaks:[...input.breaks,{start:'2026-10-16T02:15',end:'2026-10-16T03:00'}]}),/overlap/);
 assert.equal(shifts.validate({...input,status:'ABSENT'}).start,null);
});
test('copy shifts preserves London wall clock times across DST and requires ambiguous-time choice',()=>{
 const source=shifts.validate({...input,date:'2026-03-28',start:'2026-03-28T06:00',end:'2026-03-28T14:30',breaks:[]});
 const copy=shifts.validate(shifts.copyInput(source,'2026-03-29'));
 assert.equal(copy.start.toISOString(),'2026-03-29T05:00:00.000Z');
 assert.equal(copy.end.toISOString(),'2026-03-29T13:30:00.000Z');
 assert.throws(()=>shifts.validate({...input,date:'2026-03-29',start:'2026-03-29T01:30',end:'2026-03-29T08:00',breaks:[]}),/does not exist/);
 const repeated={...input,date:'2026-10-25',start:'2026-10-25T01:30',end:'2026-10-25T08:00',breaks:[]};
 assert.throws(()=>shifts.validate(repeated),/occurs twice/);
 assert.equal(+shifts.validate({...repeated,timeDisambiguation:'later'}).start-+shifts.validate({...repeated,timeDisambiguation:'earlier'}).start,3600000);
 const night=shifts.copyInput(shifts.validate(input),'2026-10-16');assert.equal(night.end,'2026-10-17T06:00');assert.equal(night.breaks[0].start,'2026-10-17T02:00');
});
test('availability checks full task window, breaks, absence, other flights and previous night carry-over',()=>{
 const shift={...shifts.validate(input),userId:'u'},flight={_id:'f',arrival:{eta:'2026-10-16T03:00:00Z'},departure:{stdAt:'2026-10-16T04:00:00Z'},assignments:[]};
 assert.equal(availability.check('u',flight,'ARRIVAL_DISPATCH',[shift],[]).available,true);
 assert.equal(availability.check('u',flight,'DISPATCH',[shift],[]).available,true);
 const breakFlight={...flight,arrival:{eta:'2026-10-16T01:15:00Z'}};
 assert.ok(availability.check('u',breakFlight,'ARRIVAL_DISPATCH',[shift],[]).warnings.includes('Break overlaps task window'));
 const late={...flight,arrival:{eta:'2026-10-16T05:00:00Z'}};
 assert.ok(availability.check('u',late,'ARRIVAL_DISPATCH',[shift],[]).warnings.includes('Task extends outside shift'));
 assert.equal(availability.check('u',flight,'ARRIVAL_DISPATCH',[],[]).available,false);
 assert.equal(availability.check('u',flight,'ARRIVAL_DISPATCH',[shift,{userId:'u',date:'2026-10-16',status:'ABSENT'}],[]).available,false);
 // An off start-date does not cancel a previous night's explicitly rostered work.
 assert.equal(availability.check('u',flight,'ARRIVAL_DISPATCH',[shift,{userId:'u',date:'2026-10-16',status:'OFF'}],[]).available,true);
 const other={...flight,_id:'other',arrivalFlight:'SQ1',assignments:[{role:'ARRIVAL_DISPATCH',userId:{_id:'u'}}]};
 assert.equal(availability.check('u',flight,'ARRIVAL_DISPATCH',[shift],[other]).available,false);
 assert.equal(availability.check('u',flight,'ARRIVAL_DISPATCH',[shift],[{...other,_id:'f'}]).available,true);
});
test('shift department permissions follow allocator scope and deny ordinary agents',()=>{
 assert.equal(shifts.canManage({active:true,department:'RAMP',position:'RAMP_ALLOCATOR'},{department:'RAMP'}),true);
 assert.equal(shifts.canManage({active:true,department:'RAMP',position:'RAMP_ALLOCATOR'},{department:'OPERATIONS'}),false);
 assert.equal(shifts.canManage({active:true,department:'RAMP',position:'RAMP_SUPERVISOR'},{department:'RAMP'}),false);
 assert.equal(shifts.canManage({active:true,department:'OPERATIONS',position:'OPERATIONS_DM'},{department:'RAMP'}),false);
});

test('shift HTTP enforces scope, revision conflicts and copy preview without overwriting target records',async()=>{
 const express=require('express'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),{createRequire}=require('node:module');
 const uid='a'.repeat(24),other='b'.repeat(24),rows=[];
 const users=[{_id:uid,name:'Ramp A',department:'RAMP',active:true},{_id:other,name:'Ops B',department:'OPERATIONS',active:true}];
 const query=values=>({lean:async()=>values,select(){return this;}});
 const matches=(row,q)=>Object.entries(q).every(([key,value])=>typeof value==='object'?(value.$gte===undefined||row[key]>=value.$gte)&&(value.$lte===undefined||row[key]<=value.$lte):String(row[key])===String(value));
 const mocks={
  '../middleware/requireUser':(req,res,next)=>{if(!req.headers.authorization)return res.sendStatus(401);req.user={_id:'c'.repeat(24),name:'Allocator',active:true,department:'RAMP',position:req.headers.authorization==='agent'?'RAMP_SUPERVISOR':'RAMP_ALLOCATOR'};next();},
  '../models/User':{findById:id=>({select:async()=>users.find(u=>u._id===id)}),find:()=>query(users)},
  '../models/StaffShift':{find:q=>query(rows.filter(row=>matches(row,q))),findOneAndUpdate:async(q,u,options)=>{
    const existing=rows.find(row=>matches(row,q));
    if(options.upsert){if(existing)return {...existing};rows.push({...u.$setOnInsert});return null;}
    if(!existing)return null;Object.assign(existing,u.$set);existing.revision+=u.$inc.revision;return {...existing};
  }}
 };
 const filename=path.join(__dirname,'../server/routes/shifts.js'),module={exports:{}},real=createRequire(filename);
 vm.runInNewContext(fs.readFileSync(filename,'utf8'),{module,require:n=>n in mocks?mocks[n]:real(n),console},{filename});
 const app=express();app.use(express.json());app.use('/shifts',module.exports);const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
 const call=(url,method='GET',body,token='allocator')=>fetch(`http://127.0.0.1:${server.address().port}/shifts${url}`,{method,headers:{Authorization:token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
 try{
  assert.equal((await call('?date=2026-10-15','GET',null,'')).status,401);
  assert.equal((await call('?date=2026-10-15','GET',null,'agent')).status,403);
  assert.equal((await call('/'+other,'PUT',input)).status,403);
  assert.equal((await call('/'+uid,'PUT',input)).status,200);assert.equal(rows[0].revision,1);
  assert.equal((await call('/'+uid,'PUT',{...input,status:'ABSENT'})).status,409);assert.equal(rows[0].status,'WORKING');
  const first=await call('/'+uid,'PUT',{...input,expectedRevision:1,end:'2026-10-16T07:00'});assert.equal(first.status,200);assert.equal(rows[0].revision,2);
  assert.equal((await call('/'+uid,'PUT',{...input,expectedRevision:1,status:'OFF'})).status,409);assert.equal(rows[0].status,'WORKING');
  let preview=await(await call('/copy-preview','POST',{date:'2026-10-16'})).json();assert.equal(preview.items.length,1);assert.equal(preview.items[0].input.start,'2026-10-16T22:00');assert.equal(rows.length,1);
  const copied=preview.items[0].input;assert.equal((await call('/'+uid,'PUT',copied)).status,200);assert.equal(rows.length,2);
  assert.equal((await call('/'+uid,'PUT',copied)).status,409);assert.equal(rows.length,2);
  preview=await(await call('/copy-preview','POST',{date:'2026-10-16'})).json();assert.equal(preview.items.length,0);assert.equal(preview.skipped.length,1);
  const read=await(await call('?date=2026-10-16')).json();assert.equal(read.shifts.length,2);
  assert.equal((await call('?date=2026-02-30')).status,400);
 }finally{await new Promise(resolve=>server.close(resolve));}
});
