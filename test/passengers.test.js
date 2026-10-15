const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),{createRequire}=require('node:module');
const figures=require('../client/js/passengerFigures');
test('TOB includes boarded infants but excludes jump seat; remaining counts stay separate',()=>{
 const p=figures.validate({checkedIn:240,checkedInInfants:3,boarded:235,infants:2,jumpSeat:4,tob:999});
 assert.equal(p.tob,237);const view=figures.normalize(p);assert.equal(view.remaining,5);assert.equal(view.remainingInfants,1);
 const mismatch=figures.normalize({...p,boarded:241,infants:4});assert.equal(mismatch.remaining,-1);assert.equal(mismatch.remainingInfants,-1);assert.equal(mismatch.tob,245);
});
test('legacy TOB remains interpretable without inventing checked-in infants or accepting impossible splits',()=>{
 const p=figures.normalize({checkedIn:240,tob:242,infants:2,boarded:0});assert.equal(p.boarded,240);assert.equal(p.checkedInInfants,null);assert.equal(p.remainingInfants,null);assert.equal(p.tob,242);
 assert.equal(figures.normalize({tob:1,infants:2}).invalidLegacy,true);
 assert.equal(figures.normalize({tob:1,infants:2}).boarded,null);
 const good={checkedIn:0,checkedInInfants:0,boarded:0,infants:0,jumpSeat:0};
 for(const value of [null,-1,1.2,'3',NaN])assert.throws(()=>figures.validate({...good,checkedInInfants:value}));
});
test('passenger API calculates totals itself, preserves jump seat and refuses stale overwrites',async()=>{
 const filename=path.join(__dirname,'../server/routes/flights.js'),module={exports:{}},real=createRequire(filename);let version=0,saved,notices=0;
 const mocks={'../models/Turnaround':{findOneAndUpdate:async(filter,update)=>{if((filter.passengerRevision??0)!==version)return null;version++;saved=update.$set.passengers;return {_id:'f1',passengers:saved};}},'../services/systemMessage':async()=>{notices++;}};
 vm.runInNewContext(fs.readFileSync(filename,'utf8'),{module,require:n=>n in mocks?mocks[n]:real(n),console},{filename});
 const route=module.exports.stack.find(l=>l.route?.path==='/:id/passengers').route;assert.equal(route.stack.length,2);
 const save=route.stack.at(-1).handle,res=()=>({code:200,status(n){this.code=n;return this;},json(body){this.body=body;return this;}});
 const req={user:{name:'Gate Agent',skills:['GATE']},params:{id:'a'.repeat(24)},body:{checkedIn:240,checkedInInfants:3,boarded:235,infants:2,jumpSeat:4,tob:999,expectedRevision:0},app:{get:()=>({to:()=>({emit(){}})})}};
 let r=res();await save(req,r);assert.equal(r.code,200);assert.equal(saved.tob,237);assert.equal(saved.jumpSeat,4);assert.equal(saved.figuresVersion,2);
 r=res();await save(req,r);assert.equal(r.code,409);assert.equal(notices,1);
 req.user.skills=[];r=res();await save(req,r);assert.equal(r.code,403);
 const Flight=require('../server/models/Turnaround');const model=new Flight({passengers:saved});assert.equal(model.toObject().passengers.jumpSeat,4);assert.equal(model.toObject().passengers.checkedInInfants,3);
});
test('passenger editor previews sums, preserves unknown legacy value and submits only validated counts',async()=>{
 const source=fs.readFileSync(path.join(__dirname,'../client/js/dashboard.js'),'utf8');
 const ids=[...figures.fields,'tob','passengerEditMessage','passengerEditRemaining','passengerPanel'];const elements=Object.fromEntries(ids.map(id=>[id,{_value:'',get value(){return this._value;},set value(v){this._value=String(v);},textContent:'',innerHTML:'',addEventListener(){}}]));
 let sent,hidden=false;
 const context={PassengerFigures:figures,document:{getElementById:id=>elements[id]},localStorage:{getItem:()=> 'token'},flightId:'f1',passengerModal:{show(){},hide(){hidden=true;}},canEdit:()=>true,loadFlight:async()=>{},alert:msg=>assert.fail(msg),fetch:async(url,options)=>{if(options){sent=JSON.parse(options.body);return {ok:true};}return {ok:true,json:async()=>({passengers:{checkedIn:240,tob:237,infants:2,jumpSeat:4},passengerRevision:0})};}};
 vm.createContext(context);vm.runInContext(source.slice(source.indexOf('let passengerEditRevision='),source.indexOf('function loadSpecialHandling(')),context);
 await context.editPassengers();assert.equal(elements.checkedInInfants.value,'');assert.equal(elements.boarded.value,'235');
 // Real input values are strings; mimic the browser after assigning values.
 for(const field of figures.fields)elements[field].value=String(elements[field].value);
 elements.checkedInInfants.value='3';context.updatePassengerPreview();assert.equal(elements.tob.value,'237');
 elements.tob.value='999';await context.savePassengers();assert.equal(sent.tob,237);assert.equal(sent.jumpSeat,4);assert.equal(hidden,true);
 context.loadPassengerInfo({passengers:{...sent,boarded:241,infants:4}});assert.match(elements.passengerPanel.innerHTML,/Mismatch/);
});
