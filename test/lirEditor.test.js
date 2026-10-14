const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
for (const mobile of [false,true]) test(`editor zoom, read gestures and conflict preservation (${mobile ? 'mobile' : 'desktop'})`,async()=>{
 const html=fs.readFileSync(path.join(__dirname,'../client/lir.html'),'utf8');
 const context2d=new Proxy({measureText:t=>({width:t.length*7})},{get:(o,k)=>k in o?o[k]:()=>{}});
 function element(){return {style:{},setAttribute(){},clientWidth:450,clientHeight:550,scrollLeft:0,scrollTop:0,textContent:'',hidden:false,disabled:false,value:'',classList:{toggle(){},add(){}},getContext:()=>context2d,querySelectorAll:()=>[],replaceChildren(){},addEventListener(){},getBoundingClientRect:()=>({left:0,top:0,width:450,height:550}),setPointerCapture(){}};}
 const elements=Object.fromEntries([...html.matchAll(/id="([^"]+)"/g)].map(m=>[m[1],element()]));
 const socketListeners={},liveListeners={},windowListeners={},calls=[];let token='token',received=false;let allowAnnotation=true;let doc={_id:'b'.repeat(24),revision:1,annotationVersion:0,status:'UPLOADED',kind:'text',filename:'LIR.txt',createdAt:'2026-06-29T09:00:00Z',annotations:[],signature:[]};
 const context={console,URLSearchParams,TextDecoder,structuredClone,queueMicrotask,setTimeout,clearTimeout,setInterval:()=>0,clearInterval(){},checkAuth(){},location:{search:'?id='+ 'a'.repeat(24)},localStorage:{getItem:()=> token},document:{getElementById:id=>{assert.ok(elements[id],id);return elements[id];},createElement:()=>element(),querySelectorAll:()=>[],querySelector:()=>element()},window:{matchMedia:()=>({matches:mobile}),addEventListener:(n,fn)=>windowListeners[n]=fn},io:namespace=>({on:(n,fn)=>(namespace?liveListeners:socketListeners)[n]=fn,emit(){},disconnect(){}}),confirm:()=>true,
 fetch:async(url,opts)=>{calls.push({url,opts});
 if(url.includes('/api/acknowledgements/')){if(opts.method==='POST')received=true;return {ok:true,json:async()=>({assignmentId:'assignment1',agentName:'Ramp One',canReceive:true,receipt:received?{name:'Ramp One',receivedAt:'2026-06-29T09:01:00Z'}:null,history:[]})};}
if(url.endsWith('/source'))return {ok:true,arrayBuffer:async()=>new TextEncoder().encode('HOLD 1\nAKE12345').buffer};
 if(opts.method==='PUT'){const body=JSON.parse(opts.body);doc={...doc,annotations:body.annotations,signature:body.signature,annotationVersion:doc.annotationVersion+1};return {ok:true,json:async()=>structuredClone(doc)};}
 return {ok:true,json:async()=>({user:{id:'u1',name:'Ramp One'},permissions:{annotate:allowAnnotation,upload:false},sequence:1,revisions:[doc],document:structuredClone(doc),flight:{display:'TEST',operatingDate:'2026-06-29'}})};}};
 vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(__dirname,'../client/js/lir.js'),'utf8')+'\nthis.readState=()=>state;this.saveDraft=()=>save(false);',context);
 await new Promise(resolve=>setImmediate(resolve));
 const state=context.readState();assert.equal(state.ready,true);assert.equal(elements.receiveBtn.hidden,false);await elements.receiveBtn.onclick();assert.equal(received,true);assert.equal(elements.receiveBtn.hidden,true);assert.equal(state.dirty,false);assert.equal(elements.uploadSection.hidden,true);
 if(mobile){
   assert.equal(elements.documentCanvas.style.width,'900px');
   elements.documentCanvas.onpointerdown({preventDefault(){assert.fail('Mobile starts in read mode');}});
   assert.equal(state.annotations.length,0);
   elements.panBtn.onclick();
 }

 elements.documentCanvas.onpointerdown({clientX:225,clientY:275,preventDefault(){}});
 assert.equal(state.annotations[0].x,.5);assert.equal(state.annotations[0].y,.5);assert.equal(state.dirty,true);
 await context.saveDraft();assert.equal(state.dirty,false);assert.equal(doc.annotations.length,1);assert.equal(state.doc.annotationVersion,1);
 liveListeners.draft({documentId:doc._id,expectedVersion:1,owner:'other',author:'Ramp Two',annotations:[]});
 assert.equal(elements.saveBtn.disabled,true);assert.match(elements.liveStatus.textContent,/UNSAVED/);
 assert.equal(state.annotations.length,1); // Incoming previews never mutate saved vectors.
 liveListeners.draftCleared({documentId:doc._id});

 elements.documentCanvas.onpointerdown({clientX:90,clientY:110,preventDefault(){}});
 socketListeners.lirUpdated();assert.equal(state.stale,true);assert.equal(state.annotations.length,2);assert.equal(state.dirty,true);assert.equal(elements.saveBtn.disabled,true);
 // A remote update received during page work must not disappear.
 state.stale=false;state.busy=true;socketListeners.lirUpdated();state.busy=false;
 vm.runInContext('controls()',context);await new Promise(resolve=>setImmediate(resolve));assert.equal(state.stale,true);assert.equal(state.annotations.length,2);
 // Explicit zoom keeps normalized annotations stable and read mode prevents accidental marks.
 elements.actualSizeBtn.onclick();assert.equal(elements.documentCanvas.style.width,'900px');
 elements.zoomInBtn.onclick();assert.equal(elements.documentCanvas.style.width,'1125px');
 elements.fitBtn.onclick();assert.equal(elements.documentCanvas.style.width,'426px');
 state.stale=false;elements.panBtn.onclick();
 const count=state.annotations.length;
 elements.documentCanvas.onpointerdown({clientX:225,clientY:275,preventDefault(){assert.fail('Read mode must allow native gestures');}});
 assert.equal(state.annotations.length,count);
 allowAnnotation=false;await socketListeners.assignmentsUpdated();
 assert.equal(state.permissions.annotate,false);assert.equal(state.stale,true);
 assert.equal(state.annotations.length,count);assert.equal(elements.saveBtn.disabled,true);
 assert.match(elements.message.textContent,/assigned/);
 assert.ok(calls.every(c=>c.opts.headers.Authorization==='Bearer token'));
 token='different-account';windowListeners.storage({key:'token'});
 assert.equal(state.stale,true);assert.equal(elements.saveBtn.disabled,true);
 assert.match(elements.message.textContent,/Account changed/);
 const previous=state.annotations.length;
 elements.documentCanvas.onpointerdown({preventDefault(){assert.fail('Changed account must not draw');}});
 assert.equal(state.annotations.length,previous);
});
