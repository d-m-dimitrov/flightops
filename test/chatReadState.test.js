const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const id = n => String(n).padStart(24, '0');
function setup() {
  const messages = [{_id:id(1),turnaroundId:'flight',userId:'sender'}, {_id:id(2),turnaroundId:'flight',userId:null}];
  const states = [];
  const ChatMessage = {find(query) { return {select() {return {lean:async()=>messages.filter(m => m.turnaroundId === query.turnaroundId && query._id.$in.includes(m._id))};}};}};
  let duplicate = false;
  const ChatReadState = {async updateOne(filter, update, options) {
    if (duplicate && options?.upsert) { duplicate=false; throw Object.assign(Error('race'), {code:11000}); }
    let state=states.find(s=>s.userId===filter.userId && s.turnaroundId===filter.turnaroundId);
    if (!state) states.push(state={...filter,readMessageIds:[]});
    state.readMessageIds=[...new Set([...state.readMessageIds,...update.$addToSet.readMessageIds.$each])];
  }};
  const context={module:{exports:{}},require:name=>name.endsWith('/ChatMessage')?ChatMessage:ChatReadState};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../server/services/chatReadState.js'),'utf8'),context);
  return {...context.module.exports,messages,states,race:()=>{duplicate=true;}};
}
test('read state is per account; arrivals after the displayed snapshot stay unread; own messages excluded',async()=>{
  const s=setup();
  await s.markRead('flight','agentA',[id(1),id(2)]);
  s.messages.push({_id:id(3),turnaroundId:'flight',userId:'sender'});
  assert.equal(s.countUnread(s.messages,s.states,'agentA').get('flight'),1);
  assert.equal(s.countUnread(s.messages,s.states,'agentB').get('flight'),3);
  assert.equal(s.countUnread(s.messages,s.states,'sender').get('flight'),1);
});
test('out-of-order tabs and duplicate upsert races preserve all read IDs; foreign IDs rejected',async()=>{
  const s=setup();s.race();
  await s.markRead('flight','agentA',[id(2)]);
  await s.markRead('flight','agentA',[id(1)]);
  await s.markRead('flight','agentA',[id(1)]);
  assert.equal(s.states[0].readMessageIds.length,2);
  await assert.rejects(s.markRead('flight','agentA',[id(9)]),{status:400});
  await assert.rejects(s.markRead('flight','agentA',['invalid']),{status:400});
  assert.equal(s.states[0].readMessageIds.length,2);
});
test('dashboard only auto-reads the opening snapshot, never background chat refreshes',async()=>{
  const source=fs.readFileSync(path.join(__dirname,'../client/js/dashboard.js'),'utf8');
  const fn=source.slice(source.indexOf('async function loadChat('),source.indexOf('async function sendChatMessage('));
  const marked=[];
  const panel={replaceChildren(){},append(){},scrollHeight:10};
  let messages=[{_id:id(1),createdAt:new Date().toISOString(),message:'hello'}];
  const context={chatLoadVersion:0,chatSessionToken:'token',localStorage:{getItem:()=> 'token'},flightId:'flight',
    document:{getElementById:()=>panel,createElement:()=>({append(){}})},
    fetch:async()=>({ok:true,json:async()=>messages.slice()}),markDisplayedChatRead:async ids=>marked.push([...ids]),
    showChatToast:()=>assert.fail('unexpected error'),console};
  vm.createContext(context);vm.runInContext(fn,context);
  await context.loadChat({markRead:true});
  messages.push({_id:id(2),createdAt:new Date().toISOString(),message:'new'});
  await context.loadChat();await context.loadChat();
  assert.deepEqual(marked,[[id(1)]]);
  assert.match(source,/loadChat\(\{markRead:true\}\);/);
});
