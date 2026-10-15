const test=require('node:test'),assert=require('node:assert/strict'),service=require('../server/services/gateItems'),tasks=require('../client/js/flightTasks');
test('gate item counts/tags are exact, preserve zeros and reject cross-type duplicates',()=>{
 const result=service.batch([{type:'BAG',count:2,tags:['00123',' abc-1 ']},{type:'STROLLER',count:1,tags:['00124']},{type:'WHEELCHAIR',count:1,tags:['00125']}]);
 assert.equal(result[0].tag,'00123');assert.equal(result[1].tag,'ABC-1');assert.equal(result.length,4);
 assert.throws(()=>service.batch([{type:'BAG',count:2,tags:['00123']}]));
 assert.throws(()=>service.batch([{type:'BAG',count:1,tags:['00123']},{type:'STROLLER',count:1,tags:['00123']}]));
 assert.throws(()=>service.batch([{type:'BAG',count:1,tags:['00123']}],[{tag:'00123',status:'RECEIVED'}]));
 assert.equal(service.batch([{type:'BAG',count:1,tags:['00123']}],[{tag:'00123',status:'CANCELLED'}]).length,1);
 assert.throws(()=>service.batch([{type:'BAG',count:1,tags:[123]}]));
});
test('only assigned Gate submits and assigned RAMP handles; transitions enforce physical sequence',()=>{
 const rows=[{role:'GATE',userId:'g'},{role:'RAMP',userId:'r'}];
 assert.equal(service.permissions(rows,{_id:'g'}).submit,true);assert.equal(service.permissions(rows,{_id:'g'}).handle,false);
 assert.equal(service.permissions(rows,{_id:'r'}).handle,true);assert.equal(service.permissions(rows,{_id:'admin',role:'ADMIN'}).handle,false);
 assert.equal(service.permissions([...rows,rows[0]],{_id:'g'}).submit,false);
 assert.equal(service.transition('SUBMITTED','receive'),'RECEIVED');assert.equal(service.transition('RECEIVED','load'),'LOADED');
 assert.throws(()=>service.transition('SUBMITTED','load'));assert.throws(()=>service.transition('RECEIVED','cancel'));assert.throws(()=>service.transition('LOADED','receive'));
});
test('counts include loaded in received; cancelled excluded; pending tags create RAMP actions',()=>{
 const summary=service.summary([{type:'BAG',status:'LOADED'},{type:'BAG',status:'RECEIVED'},{type:'BAG',status:'SUBMITTED'},{type:'BAG',status:'CANCELLED'},{type:'WHEELCHAIR',status:'SUBMITTED'}]);
 assert.deepEqual(summary.BAG,{submitted:3,received:2,loaded:1});assert.equal(summary.WHEELCHAIR.submitted,1);
 assert.deepEqual(tasks.actions({assignments:[{role:'RAMP',acceptedAt:'yes'}],gateItems:{total:4,received:2,loaded:1}}),['Receive 2 gate item(s)','Load 1 gate item(s)']);
});
