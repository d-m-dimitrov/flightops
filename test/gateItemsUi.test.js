const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {summary}=require('../server/services/gateItems');
test('Gate form preserves tags on remote changes, requires review, and submits separate type counts',async()=>{
 const html=fs.readFileSync(path.join(__dirname,'../client/gate-items.html'),'utf8');
 function element(tag='div'){return {tag,value:'',textContent:'',children:[],hidden:false,disabled:false,append(...children){this.children.push(...children);},replaceChildren(...children){this.children=children;},addEventListener(name,fn){this[name]=fn;},querySelectorAll(tag){return this.children.flatMap(c=>[...(c.tag===tag?[c]:[]),...c.querySelectorAll(tag)]);},remove(){}};}
 const elements=Object.fromEntries([...html.matchAll(/id="([^"]+)"/g)].map(m=>[m[1],element()]));
 for(const type of ['BAG','STROLLER','WHEELCHAIR'])elements[type+'-count'].value='0';
 let data={flight:{flightNumberDisplay:'TEST',operatingDate:'2026-10-15'},permissions:{submit:true,handle:false},gateAssignmentId:'g1',version:1,items:[],history:[],summary:summary()},submitted;
 const context={console,URLSearchParams,checkAuth(){},location:{search:'?id='+ 'a'.repeat(24)},localStorage:{getItem:()=> 'token'},document:{hidden:false,getElementById:id=>elements[id],createElement:element},window:{addEventListener(){}},setInterval:()=>0,clearInterval(){},confirm:()=>true,fetch:async(url,options)=>{
  if(options.method==='POST'){submitted=JSON.parse(options.body);data={...data,version:3};return {ok:true,json:async()=>({success:true})};}
  return {ok:true,json:async()=>structuredClone(data)};
 }};
 vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(__dirname,'../client/js/gateItems.js'),'utf8'),context);
 await new Promise(resolve=>setImmediate(resolve));assert.equal(elements.entrySection.hidden,false);
 elements['BAG-count'].value='2';elements['BAG-tags'].value='00123, 00124';elements['STROLLER-count'].value='1';elements['STROLLER-tags'].value='00125';elements.entryForm.input();
 data={...data,version:2};await elements.refresh.onclick();assert.equal(elements.submit.disabled,true);assert.equal(elements['BAG-tags'].value,'00123, 00124');assert.equal(elements.review.hidden,false);
 elements.review.onclick();assert.equal(elements.submit.disabled,false);
 await elements.entryForm.onsubmit({preventDefault(){}});
 assert.equal(submitted.expectedVersion,2);assert.equal(submitted.assignmentId,'g1');assert.equal(submitted.groups[0].count,2);assert.equal(submitted.groups[0].tags[0],'00123');assert.equal(submitted.groups[1].type,'STROLLER');assert.equal(elements['BAG-tags'].value,'');
});
