const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{createRequire}=require('node:module');
const vip=require('../client/js/vipBaggage');
test('VIP tags preserve zeros and reject empty, invalid or duplicate baggage entries',()=>{
 assert.deepEqual(vip.normalize([{bagTag:'001234'},{bagTag:' ab-12 '}]),[{bagTag:'001234'},{bagTag:'AB-12'}]);
 for(const rows of [[{bagTag:''}],[{bagTag:123}],[{bagTag:'abc'},{bagTag:'ABC'}],[{bagTag:'<script>'}],Array.from({length:201},(_,i)=>({bagTag:String(i)}))])assert.throws(()=>vip.normalize(rows));
 const Flight=require('../server/models/Turnaround');const flight=new Flight({specialHandlingDetails:{vipBaggage:vip.normalize([{bagTag:'001234'}])}});assert.equal(flight.toObject().specialHandlingDetails.vipBaggage[0].bagTag,'001234');
});
test('special handling saves VIP tags, preserves other categories and allows explicit removal',async()=>{
 const filename=path.join(__dirname,'../server/routes/flights.js'),module={exports:{}},real=createRequire(filename);let saved=0;
 const flight={_id:'f1',specialHandlingDetails:{depa:[{seat:'12A'}],vipBaggage:[{bagTag:'0001'}]},save:async()=>{saved++;}};
 const mocks={'../models/Turnaround':{findById:async()=>flight},'../services/systemMessage':async()=>{}};
 vm.runInNewContext(fs.readFileSync(filename,'utf8'),{module,console,require:n=>n in mocks?mocks[n]:real(n)},{filename});
 const handler=module.exports.stack.find(l=>l.route?.path==='/:id/special-handling-details').route.stack[0].handle;
 const req={params:{id:'f1'},body:{details:{vipBaggage:[{bagTag:'0002'}]}},app:{get:()=>({to:()=>({emit(){}})})}};
 const res=()=>({code:200,status(code){this.code=code;return this;},json(body){this.body=body;return this;}});
 await handler(req,res());assert.equal(flight.specialHandlingDetails.depa[0].seat,'12A');assert.equal(flight.specialHandlingDetails.vipBaggage[0].bagTag,'0002');
 req.body.details={depa:[{seat:'13A'}]};await handler(req,res());assert.equal(flight.specialHandlingDetails.vipBaggage[0].bagTag,'0002');
 req.body.details={vipBaggage:[{bagTag:''}]};let r=res();await handler(req,r);assert.equal(r.code,400);assert.equal(saved,2);
 req.body.details={vipBaggage:[]};await handler(req,res());assert.equal(flight.specialHandlingDetails.vipBaggage.length,0);assert.equal(flight.specialHandlingDetails.depa[0].seat,'13A');
});
