const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {createRequire}=require('node:module');
const validate=require('../server/services/lirValidation');
function load(file,mocks){const filename=path.join(__dirname,'..',file),module={exports:{}},real=createRequire(filename);vm.runInNewContext(fs.readFileSync(filename,'utf8'),{module,exports:module.exports,require:n=>n in mocks?mocks[n]:real(n),console,process},{filename});return module.exports;}
function res(){return {statusCode:200,status(n){this.statusCode=n;return this;},json(body){this.body=body;return this;}};}
function handler(router,method,route){return router.stack.find(x=>x.route?.path===route&&x.route.methods[method]).route.stack[0].handle;}
const signature=[[{x:.1,y:.2},{x:.3,y:.4}]];
const payload={expectedVersion:0,complete:false,annotations:[{type:'tick',page:1,x:.2,y:.3}],signature:[]};
test('OPS uploads, RAMP annotates; default OPERATIONS role does not grant OPS access',()=>{
 assert.equal(validate.permissions({role:'OPERATIONS',department:'RAMP'}).upload,false);
 assert.equal(validate.permissions({department:'OPERATIONS'}).annotate,false);
 assert.equal(validate.permissions({department:'PASSENGER_HANDLING'}).view,false);
 assert.equal(validate.permissions({role:'ADMIN'}).annotate,true);
});
test('LIR preserves text layout and PDF bytes; rejects invalid/oversized sources',()=>{
 const text=validate.source({kind:'text',text:'HOLD\t1\r\nULD 123',expectedSequence:0});assert.equal(text.original.toString(),'HOLD    1\nULD 123');
 const pdf=Buffer.from('%PDF-1.7\nexample');assert.deepEqual(validate.source({kind:'pdf',base64:pdf.toString('base64'),expectedSequence:1}).original,pdf);
 assert.throws(()=>validate.source({kind:'pdf',base64:Buffer.from('not PDF').toString('base64'),expectedSequence:0}));
 assert.throws(()=>validate.source({kind:'text',text:'a'.repeat(201),expectedSequence:0}));
});
test('signature required for completion; invalid coordinates/pages rejected',()=>{
 assert.throws(()=>validate.annotations({...payload,complete:true}));
 assert.equal(validate.annotations({...payload,complete:true,signature}).signature.length,1);
 for(const mark of [{...payload.annotations[0],x:NaN},{...payload.annotations[0],page:51},{type:'strike',page:1,x:0,y:0,x2:2}]) assert.throws(()=>validate.annotations({...payload,annotations:[mark]}));
});
test('two RAMP operators cannot overwrite each other; completion and superseded versions lock',async()=>{
 let doc={_id:'d1',revision:1,annotationVersion:0,status:'UPLOADED'},notices=0;
 const router=load('server/routes/lir.js',{'../models/Lir':{
 findOne:()=>({sort:async()=>doc}),
 findOneAndUpdate:async(filter,update)=>{if(filter.annotationVersion!==doc.annotationVersion||doc.status==='COMPLETED')return null;doc={...doc,...update.$set,annotationVersion:doc.annotationVersion+1};return doc;}
 },'../services/systemMessage':async()=>{notices++;}});
 const save=handler(router,'put','/:flightId/:documentId/annotations');
 const req={lirPermissions:{annotate:true},flight:{_id:'f1'},params:{documentId:'d1'},user:{_id:'u1',name:'Ramp Test'},body:payload,app:{get:()=>({to:()=>({emit(){}})})}};
 let r=res();await save(req,r);assert.equal(r.statusCode,200);assert.equal(doc.annotationVersion,1);
 r=res();await save(req,r);assert.equal(r.statusCode,409);assert.equal(notices,1);
 req.body={...payload,expectedVersion:1,complete:true,signature};r=res();await save(req,r);assert.equal(doc.status,'COMPLETED');assert.equal(doc.signedByName,'Ramp Test');
 req.body={...payload,expectedVersion:2};r=res();await save(req,r);assert.equal(r.statusCode,409);
 doc={_id:'d2',revision:2,status:'UPLOADED',annotationVersion:0};r=res();await save(req,r);assert.equal(r.statusCode,409);assert.equal(notices,2);
 req.lirPermissions.annotate=false;r=res();await save(req,r);assert.equal(r.statusCode,403);
});
test('concurrent OPS uploads reject a stale sequence; RAMP cannot upload',async()=>{
 let sequence=0,created=[];
 const router=load('server/routes/lir.js',{'../models/Turnaround':{findOneAndUpdate:async f=>{const expected=f.lirSequence??0;if(expected!==sequence)return null;return {_id:'f1',lirSequence:++sequence};}},'../models/Lir':{create:async d=>{created.push(d);return {...d,_id:'d1'};},findById:async()=>({revision:sequence})},'../services/systemMessage':async()=>{}});
 const upload=handler(router,'post','/:flightId');const req={lirPermissions:{upload:true},flight:{_id:'f1'},user:{_id:'u',name:'Ops Test'},body:{expectedSequence:0,kind:'text',text:'LIR'},app:{get:()=>({to:()=>({emit(){}})})}};
 let r=res();await upload(req,r);assert.equal(r.statusCode,201);assert.equal(created.length,1);
 r=res();await upload(req,r);assert.equal(r.statusCode,409);assert.equal(created.length,1);
 req.lirPermissions.upload=false;r=res();await upload(req,r);assert.equal(r.statusCode,403);
});
test('auth rejects missing/invalid tokens and uses current DB department rather than JWT department',async()=>{
 const auth=load('server/middleware/requireUser.js',{'jsonwebtoken':{verify:()=>({id:'a'.repeat(24),department:'OPERATIONS'})},'../models/User':{findById:()=>({select:async()=>({active:true,department:'RAMP'})})}});
 let r=res();await auth({headers:{}},r,()=>assert.fail());assert.equal(r.statusCode,401);
 const req={headers:{authorization:'Bearer token'}};let called=false;await auth(req,res(),()=>{called=true;});assert.equal(called,true);assert.equal(req.user.department,'RAMP');
});
