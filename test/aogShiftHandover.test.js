const test=require('node:test'),assert=require('node:assert/strict');
const mongoose=require('mongoose');
const GroundStay=require('../server/models/AircraftGroundStay');
const ShiftHandover=require('../server/models/AogShiftHandover');

test('AOG shift handover revision is separate from check-in to gate document',()=>{
 const stayId=new mongoose.Types.ObjectId();
 const senderId=new mongoose.Types.ObjectId();
 const recipientId=new mongoose.Types.ObjectId();
 const handover=new ShiftHandover({
  groundStayId:stayId,revision:1,notes:'Aircraft remains on the ground awaiting engineering release.',
  sentBy:senderId,sentByName:'Outgoing ODM',
  receipts:[{userId:recipientId,name:'Incoming ODM',receivedAt:new Date('2026-11-27T06:00:00Z')}]
 });
 assert.equal(handover.validateSync(),undefined);
 assert.equal(String(handover.groundStayId),String(stayId));
 assert.equal(handover.revision,1);
 assert.equal(handover.receipts.length,1);
 assert.equal(handover.receipts[0].name,'Incoming ODM');
 assert.ok(ShiftHandover.schema.indexes().some(([keys,opts])=>
  keys.groundStayId===1&&keys.revision===1&&opts.unique===true));
});

test('Existing ground stays default to no prepared handover',()=>{
 const stay=new GroundStay({
  sourceTurnaroundId:new mongoose.Types.ObjectId(),airline:'TK',registration:'TC-LJG',
  reason:'TECHNICAL',groundedAt:new Date('2026-11-26T12:00:00Z')
 });
 assert.equal(stay.handoverSequence,0);
 assert.equal(stay.status,'GROUNDED');
 assert.equal(stay.validateSync(),undefined);
});

test('Handover requires a sender, ground stay and revision',()=>{
 const invalid=new ShiftHandover({notes:'Awaiting engineering update'});
 const errors=invalid.validateSync();
 assert.ok(errors?.errors?.groundStayId);
 assert.ok(errors?.errors?.revision);
 assert.ok(errors?.errors?.sentBy);
});
