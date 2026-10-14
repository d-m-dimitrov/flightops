const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
test('editor retains page coordinates on resize, saves vectors, and preserves dirty work after socket changes',async()=>{
 const html=fs.readFileSync(path.join(__dirname,'../client/lir.html'),'utf8');
 const context2d=new Proxy({measureText:t=>({width:t.length*7})},{get:(o,k)=>k in o?o[k]:()=>{}});
 function element(){return {textContent:'',hidden:false,disabled:false,value:'',classList:{toggle(){},add(){}},getContext:()=>context2d,querySelectorAll:()=>[],replaceChildren(){},addEventListener(){},getBoundingClientRect:()=>({left:0,top:0,width:450,height:550}),setPointerCapture(){}};}
 const elements=Object.fromEntries([...html.matchAll(/id="([^"]+)"/g)].map(m=>[m[1],element()]));
 const socketListeners={},calls=[];let doc={_id:'b'.repeat(24),revision:1,annotationVersion:0,status:'UPLOADED',kind:'text',filename:'LIR.txt',createdAt:'2026-06-29T09:00:00Z',annotations:[],signature:[]};
 const context={console,URLSearchParams,TextDecoder,structuredClone,queueMicrotask,setTimeout,checkAuth(){},location:{search:'?id='+ 'a'.repeat(24)},localStorage:{getItem:()=> 'token'},document:{getElementById:id=>{assert.ok(elements[id],id);return elements[id];},createElement:()=>element(),querySelectorAll:()=>[],querySelector:()=>element()},window:{addEventListener(){}},io:()=>({on:(n,fn)=>socketListeners[n]=fn,emit(){}}),confirm:()=>true,
 fetch:async(url,opts)=>{calls.push({url,opts});if(url.endsWith('/source'))return {ok:true,arrayBuffer:async()=>new TextEncoder().encode('HOLD 1\nAKE12345').buffer};
 if(opts.method==='PUT'){const body=JSON.parse(opts.body);doc={...doc,annotations:body.annotations,signature:body.signature,annotationVersion:doc.annotationVersion+1};return {ok:true,json:async()=>structuredClone(doc)};}
 return {ok:true,json:async()=>({permissions:{annotate:true,upload:false},sequence:1,revisions:[doc],document:structuredClone(doc),flight:{display:'TEST',operatingDate:'2026-06-29'}})};}};
 vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(__dirname,'../client/js/lir.js'),'utf8')+'\nthis.readState=()=>state;this.saveDraft=()=>save(false);',context);
 await new Promise(resolve=>setImmediate(resolve));
 const state=context.readState();assert.equal(state.ready,true);assert.equal(elements.uploadSection.hidden,true);
 elements.documentCanvas.onpointerdown({clientX:225,clientY:275,preventDefault(){}});
 assert.equal(state.annotations[0].x,.5);assert.equal(state.annotations[0].y,.5);assert.equal(state.dirty,true);
 await context.saveDraft();assert.equal(state.dirty,false);assert.equal(doc.annotations.length,1);assert.equal(state.doc.annotationVersion,1);
 elements.documentCanvas.onpointerdown({clientX:90,clientY:110,preventDefault(){}});
 socketListeners.lirUpdated();assert.equal(state.stale,true);assert.equal(state.annotations.length,2);assert.equal(state.dirty,true);assert.equal(elements.saveBtn.disabled,true);
 // A remote update received during page work must not disappear.
 state.stale=false;state.busy=true;socketListeners.lirUpdated();state.busy=false;
 vm.runInContext('controls()',context);await new Promise(resolve=>setImmediate(resolve));assert.equal(state.stale,true);assert.equal(state.annotations.length,2);
 assert.ok(calls.every(c=>c.opts.headers.Authorization==='Bearer token'));
});
