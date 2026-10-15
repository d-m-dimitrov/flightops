checkAuth();
const $=id=>document.getElementById(id),flightId=new URLSearchParams(location.search).get('id'),token=localStorage.getItem('token'),base=`/api/gate-items/${encodeURIComponent(flightId||'')}`;
const labels={BAG:'Bags',STROLLER:'Strollers',WHEELCHAIR:'Wheelchairs'};
let state=null,busy=false,dirty=false,formVersion=0,formAssignment=null,generation=0;
$('flightLink').href=`dashboard.html?id=${encodeURIComponent(flightId||'')}`;
function el(tag,text,cls){const e=document.createElement(tag);e.textContent=text;if(cls)e.className=cls;return e;}
function time(value){return new Date(value).toLocaleString('en-GB',{timeZone:'Europe/London',timeZoneName:'short'});}
async function request(url,options={}){
 if(localStorage.getItem('token')!==token)throw Error('Account changed. Reload before continuing.');
 const r=await fetch(url,{...options,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'}}),body=await r.json().catch(()=>({}));
 if(localStorage.getItem('token')!==token)throw Error('Account changed. Reload before continuing.');
 if(!r.ok)throw Error(body.error||'Unable to load gate items');return body;
}
function controls(){
 const valid=localStorage.getItem('token')===token;
 $('submit').disabled=busy||!valid||!state?.permissions.submit||formVersion!==state.version||formAssignment!==state.gateAssignmentId;
 $('review').hidden=!dirty||!state?.permissions.submit||(formVersion===state.version&&formAssignment===state.gateAssignmentId);
 $('review').disabled=busy||!valid;$('refresh').disabled=busy;
 $('items').querySelectorAll('button').forEach(b=>b.disabled=busy||!valid);
}
function render(){
 $('flightTitle').textContent=`${state.flight.flightNumberDisplay||`${state.flight.arrivalFlight||'—'} / ${state.flight.departureFlight||'—'}`} · ${state.flight.operatingDate}`;
 if(!dirty){formVersion=state.version;formAssignment=state.gateAssignmentId;}
 $('entrySection').hidden=!state.permissions.submit&&!dirty;
 $('totals').replaceChildren();const table=el('table','','table table-sm');const head=el('tr');['Type','Submitted','Received','Loaded'].forEach(t=>head.append(el('th',t)));table.append(head);
 for(const type of Object.keys(labels)){const row=el('tr'),s=state.summary[type];[labels[type],s.submitted,s.received,s.loaded].forEach(v=>row.append(el('td',v)));table.append(row);}$('totals').append(table);
 $('items').replaceChildren();
 for(const type of Object.keys(labels)){
  const rows=state.items.filter(i=>i.type===type);if(!rows.length)continue;
  $('items').append(el('h3',labels[type],'h6 mt-3'));
  for(const item of rows){
   const row=el('div','','border-bottom py-2');row.append(el('strong',item.tag),el('span',` · ${item.status}`,'ms-2'));
   for(const [field,label] of [['submitted','Submitted'],['received','Received'],['loaded','Loaded'],['cancelled','Cancelled']])if(item[field+'At'])row.append(el('div',`${label}: ${item[field+'ByName']} · ${time(item[field+'At'])}`,'small text-muted'));
   const action=state.permissions.handle?(item.status==='SUBMITTED'?'receive':item.status==='RECEIVED'?'load':null):null;
   if(action)addButton(row,item,action,action==='receive'?'Confirm received':'Confirm loaded');
   if(state.permissions.submit&&item.status==='SUBMITTED')addButton(row,item,'cancel','Cancel item');
   $('items').append(row);
  }
 }
 if(!state.items.length)$('items').textContent='No gate items submitted.';
 $('history').replaceChildren();for(const h of [...state.history].reverse())$('history').append(el('p',`${time(h.at)} · ${h.name} · ${h.action} · ${labels[h.type]} · ${h.tag}`,'small border-bottom py-2'));
 if(dirty&&(formVersion!==state.version||formAssignment!==state.gateAssignmentId))$('message').textContent='The list or assignment changed. Your entries are preserved. Review the current items before sending.';
 else $('message').textContent=state.permissions.submit?'Gate: enter counts and tags for new items.':state.permissions.handle?'RAMP: confirm each tag received, then loaded.':'Read-only view for the flight team.';
 controls();
}
function addButton(row,item,action,label){const b=el('button',label,`btn btn-sm ${action==='cancel'?'btn-outline-danger':'btn-success'} mt-2 me-2`);b.type='button';b.onclick=()=>updateItem(item,action);row.append(b);}
async function refresh(){const check=++generation;try{const next=await request(base);if(check!==generation)return;state=next;render();}catch(error){if(check!==generation)return;if(state)state.permissions={};$('message').textContent=error.message;$('items').querySelectorAll('button').forEach(b=>b.remove());controls();}}
async function updateItem(item,action){
 if(busy)return;
 if(!confirm(`${{receive:'Confirm received',load:'Confirm loaded',cancel:'Cancel'}[action]}: ${labels[item.type]} tag ${item.tag}?`))return;
 const assignmentId=action==='cancel'?state.gateAssignmentId:state.rampAssignmentId;busy=true;controls();
 try{await request(base,{method:'POST',body:JSON.stringify({action,itemId:item._id,assignmentId,expectedVersion:state.version})});await refresh();}catch(error){$('message').textContent=error.message;}finally{busy=false;controls();}
}
$('entryForm').addEventListener('input',()=>{dirty=true;controls();});
$('entryForm').onsubmit=async event=>{
 event.preventDefault();if(busy||!state?.permissions.submit)return;
 const groups=[];
 for(const type of Object.keys(labels)){
  const count=Number($(type+'-count').value),tags=$(type+'-tags').value.trim().split(/[\s,;]+/).filter(Boolean);
  if(!count&&!tags.length)continue;
  if(!Number.isInteger(count)||count<1||count!==tags.length){$('message').textContent=`${labels[type]}: count must match the number of tags.`;return;}
  groups.push({type,count,tags});
 }
 if(!groups.length){$('message').textContent='Enter at least one item and its tag.';return;}
 busy=true;controls();
 try{
  await request(base,{method:'POST',body:JSON.stringify({action:'submit',assignmentId:formAssignment,expectedVersion:formVersion,groups})});
  dirty=false;for(const type of Object.keys(labels)){$(type+'-count').value='0';$(type+'-tags').value='';}await refresh();
 }catch(error){$('message').textContent=error.message;}finally{busy=false;controls();}
};
$('review').onclick=()=>{if(!state?.permissions.submit)return;formVersion=state.version;formAssignment=state.gateAssignmentId;$('message').textContent='Draft retained. Check counts and tags, then send.';controls();};
$('refresh').onclick=refresh;
const timer=setInterval(()=>{if(!busy&&!document.hidden)refresh();},10000);
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
window.addEventListener('pagehide',()=>{clearInterval(timer);generation++;});window.addEventListener('pageshow',e=>{if(e.persisted)location.reload();});
window.addEventListener('storage',()=>{if(localStorage.getItem('token')!==token){generation++;$('message').textContent='Account changed. Copy any unsent tags, then reload.';controls();}});
refresh();
