checkAuth();
const $=id=>document.getElementById(id),token=localStorage.getItem('token');
const flightId=new URLSearchParams(location.search).get('id')||'',base=`/api/flight-messages/${encodeURIComponent(flightId)}`;
let generation=0,rows=[],cursor=null,canAdd=false,busy=false,pending=null,stopped=false;
$('flightLink').href=`dashboard.html?id=${encodeURIComponent(flightId)}`;
function el(tag,text,cls){const n=document.createElement(tag);n.textContent=text;if(cls)n.className=cls;return n;}
function controls(){$('save').disabled=busy||!canAdd||stopped;$('older').hidden=!cursor;}
function lock(message){stopped=true;generation++;canAdd=false;rows=[];cursor=null;$('history').replaceChildren();$('flightTitle').textContent='';$('status').textContent=message;socket.disconnect();clearInterval(timer);controls();}
async function request(url,options={}){
 if(stopped||localStorage.getItem('token')!==token)throw Error('Account changed. Reload this page.');
 const response=await fetch(url,{...options,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'}});
 if(localStorage.getItem('token')!==token)throw Error('Account changed. Reload this page.');
 const body=await response.json();
 if(!response.ok){if([401,403,404].includes(response.status))lock(body.error);throw Error(body.error||'Unable to load messages');}
 return body;
}
function render(){
 $('history').replaceChildren();
 if(!rows.length)$('history').append(el('p','No messages match these filters.','text-muted'));
 for(const row of rows){
  const card=el('article','','card mb-3'),body=el('div','','card-body'),head=el('div','','d-flex flex-wrap justify-content-between gap-2');
  head.append(el('h3',`${row.type} · ${row.direction==='ARRIVAL'?'Arrival':'Departure'}`,'h6'));
  const copy=el('button','Copy','btn btn-sm btn-outline-primary');copy.onclick=async()=>{try{await navigator.clipboard.writeText(row.text);copy.textContent='Copied';}catch{$('status').textContent='Copy unavailable. Select the message text and copy it manually.';}};head.append(copy);
  body.append(head,el('p',`${row.createdByName} · ${new Date(row.createdAt).toLocaleString('en-GB',{timeZone:'Europe/London',timeZoneName:'short'})}`,'small text-muted'),el('pre',row.text,'mb-0'));card.append(body);$('history').append(card);
 }
 controls();
}
async function refresh(older=false,preserve=false){
 if(stopped)return;const version=++generation,params=new URLSearchParams();
 if($('filterType').value)params.set('type',$('filterType').value);
 if($('filterDirection').value)params.set('direction',$('filterDirection').value);
 if(older&&cursor)params.set('before',cursor);
 $('older').disabled=true;
 try{const data=await request(`${base}?${params}`);if(version!==generation||stopped)return;
  canAdd=data.canAdd;$('composer').hidden=!canAdd;
  $('flightTitle').textContent=`${data.flight.arrivalFlight||'—'} / ${data.flight.departureFlight||'—'} · Arrival date ${data.flight.operatingDate}`;
  const keep=preserve&&rows.length>0&&data.messages.some(m=>rows.some(r=>r._id===m._id));
  if(older){rows=[...rows,...data.messages.filter(m=>!rows.some(r=>r._id===m._id))];cursor=data.nextCursor;}
  else if(keep){rows=[...data.messages,...rows.filter(r=>!data.messages.some(m=>m._id===r._id))];}
  else {rows=data.messages;cursor=data.nextCursor;}
  render();
  $('status').textContent=socket.connected?'Live updates connected · Times shown in London time':'Connected · Checking for updates';
 }catch(error){if(version===generation&&!stopped){$('status').textContent=error.message;canAdd=false;controls();}}
 finally{$('older').disabled=false;}
}
$('messageForm').onsubmit=async event=>{
 event.preventDefault();if(!canAdd||busy||stopped)return;
 const input={type:$('type').value,direction:$('direction').value,text:$('text').value};
 if(!input.text.trim()){$('saveStatus').textContent='Enter message text.';return;}
 const signature=JSON.stringify(input);if(!pending||pending.signature!==signature)pending={signature,id:crypto.randomUUID()};
 busy=true;controls();$('saveStatus').textContent='Saving…';
 try{await request(base,{method:'POST',body:JSON.stringify({...input,requestId:pending.id})});
  if($('text').value===input.text)$('text').value='';pending=null;
  $('saveStatus').textContent='Message saved to this flight.';await refresh();
 }catch(error){$('saveStatus').textContent=error.message;}finally{busy=false;controls();}
};
$('refresh').onclick=()=>refresh();$('older').onclick=()=>refresh(true);
for(const id of ['filterType','filterDirection'])$(id).onchange=()=>{cursor=null;refresh();};
const socket=io();socket.on('connect',()=>{if(!stopped){socket.emit('joinFlight',flightId);refresh();}});
socket.on('flightMessagesUpdated',()=>refresh(false,true));socket.on('assignmentsUpdated',()=>refresh(false,true));
socket.on('disconnect',()=>{if(!stopped)$('status').textContent='Live connection interrupted · Checking for updates';});
const timer=setInterval(()=>{if(!document.hidden&&!busy)refresh(false,true);},15000);
window.addEventListener('storage',()=>{if(localStorage.getItem('token')!==token)lock('Account changed. Reload this page.');});
window.addEventListener('beforeunload',event=>{if($('text').value.trim()){event.preventDefault();event.returnValue='';}});
window.addEventListener('pagehide',()=>{stopped=true;generation++;clearInterval(timer);socket.disconnect();});
window.addEventListener('pageshow',event=>{if(event.persisted)location.reload();});
refresh();
