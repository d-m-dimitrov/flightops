checkAuth();
const $=id=>document.getElementById(id),token=localStorage.getItem('token');
let generation=0,flights=[],busy=false;
const airlineCache=new Map();
const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
const datePart=t=>parts.find(p=>p.type===t).value;
$('date').value=`${datePart('year')}-${datePart('month')}-${datePart('day')}`;
function el(tag,text,cls){const e=document.createElement(tag);e.textContent=text;if(cls)e.className=cls;return e;}
async function request(url,options={}){if(localStorage.getItem('token')!==token)throw Error('Account changed. Reload this page.');const r=await fetch(url,{...options,headers:{Authorization:`Bearer ${token}`}});if(localStorage.getItem('token')!==token)throw Error('Account changed. Reload this page.');if(!r.ok)throw Error((await r.json()).error||'Unable to load flights');const body=await r.json();if(localStorage.getItem('token')!==token)throw Error('Account changed. Reload this page.');return body;}
function time(value){return value?new Date(value).toLocaleTimeString('en-GB',{timeZone:'Europe/London',hour:'2-digit',minute:'2-digit'}):'—';}
function countdown(f){const target=FlightTasks.target(f),at=Date.parse(target.value);if(FlightTasks.closed(f))return f.status;if(!Number.isFinite(at))return `${target.label}: time unavailable`;const minutes=Math.ceil((at-Date.now())/60000);return `${target.label} ${time(target.value)} · ${minutes>=0?`${Math.floor(minutes/60)}h ${minutes%60}m remaining`:`${Math.abs(minutes)}m past`}`;}
function appendPhone(row,phone,label='Call'){
 const clean=String(phone).replace(/[^+0-9]/g,'');
 const valid=/^\+?[0-9]{5,16}$/.test(clean);
 row.append(document.createTextNode(' · '));
 if(!valid){row.append(el('span',phone,'text-muted'));return;}
 const a=el('a',phone,'link-primary text-decoration-underline');
 a.href='tel:'+clean;
 a.setAttribute('aria-label',(label==='Backup'?'Call backup number ':'Call ')+phone);
 a.title=label==='Backup'?'Call backup number':'Call';
 row.append(a);
}
function render(){
 $('cards').replaceChildren();
 for(const f of FlightTasks.sort(flights)){
  const tasks=FlightTasks.actions(f),card=el('article','',`card flight-card ${tasks.length?'attention':''}`),body=el('div','','card-body');card.append(body);
  body.append(el('h2',f.flightNumberDisplay||`${f.arrivalFlight||'—'} / ${f.departureFlight||'—'}`,'h5'),el('p',`${f.assignments.map(a=>FlightTasks.label(a.role)).join(' · ')} · ${f.status}`,'small text-muted'),el('div',`Stand ${f.aircraft?.stand||'—'} · ${f.aircraft?.registration||'—'}`));
  body.append(el('div',`STA ${f.arrival?.sta||time(f.arrival?.staAt)} · STD ${f.departure?.std||time(f.departure?.stdAt)}`,'small'));
  if(f.dayLabel)body.append(el('p',f.dayLabel,'badge bg-info text-dark'));
  const clock=el('p',countdown(f),'countdown mt-2');clock.dataset.flight=f._id;body.append(clock);
  if(tasks.length){const list=el('ul','','action-list');tasks.forEach(t=>list.append(el('li',t)));body.append(list);}else body.append(el('p','No pending acknowledgements','text-muted'));
  body.append(el('p',f.handover?`Handover v${f.handover.revision} · ${f.handover.received?'Received by Gate':'Awaiting Gate receipt'}`:'Check-in handover not sent','small'));
  if(f.gateItems)body.append(el('p',`Gate items: ${f.gateItems.total} submitted · ${f.gateItems.received} received · ${f.gateItems.loaded} loaded`,'small'));
  if(f.canLir)body.append(el('p',f.lir?`LIR v${f.lir.revision} · ${f.lir.status} · ${f.lir.received?'Read':'Awaiting receipt'}`:'LIR not uploaded','small'));
  const airlineCode=String(f.airline||'').trim().toUpperCase();
  if(/^[A-Z0-9]{2,3}$/.test(airlineCode)){
   const details=document.createElement('details');details.className='border rounded p-2 my-2';
   const summary=el('summary','Airline information · '+airlineCode,'fw-semibold');summary.style.cursor='pointer';details.append(summary);
   const info=el('div','Open to load airline contacts and instructions','small mt-2');details.append(info);body.append(details);
   details.addEventListener('toggle',async()=>{
    if(!details.open)return;
    info.textContent='Loading airline information…';
    try{
     if(!airlineCache.has(airlineCode))airlineCache.set(airlineCode,request('/api/airline-directory/'+encodeURIComponent(airlineCode)).catch(e=>{airlineCache.delete(airlineCode);throw e;}));
     const data=await airlineCache.get(airlineCode);
     if(!details.isConnected)return;
     info.replaceChildren();
     info.append(el('h3',data.name||airlineCode,'h6'));
     const logo=el('img','','mb-2');logo.alt=data.name||airlineCode;logo.style.cssText='max-height:55px;max-width:160px;object-fit:contain';
     logo.src=data.logoData||data.logoUrl||'logos/'+airlineCode.toLowerCase()+'.png';logo.onerror=()=>logo.remove();info.append(logo);
     for(const contact of data.representatives||[]){
      const row=el('div',(contact.name||'Representative')+(contact.position?' · '+contact.position:''),'mb-1');
      if(contact.phone)appendPhone(row,contact.phone);info.append(row);
     }
     const labels={cargo:'Cargo Handling',crewTransport:'Crew Transport',passengerBuses:'Passenger Buses',catering:'Catering',cleaning:'Aircraft Cleaning',fuel:'Fuel',waterToilet:'Water / Toilet'};
     for(const [key,label] of Object.entries(labels)){
      const v=data.services?.[key];if(!v||!Object.values(v).some(Boolean))continue;
      const row=el('div',label+': '+(v.provider||'—')+(v.contact?' · '+v.contact:''),'mb-1');
      if(v.phone)appendPhone(row,v.phone);if(v.backupPhone)appendPhone(row,v.backupPhone,'Backup');
      if(v.notes)row.append(el('div',v.notes,'text-muted'));info.append(row);
     }
     try{
      const aircraft=String(f.aircraft?.aircraftType||'').trim().toUpperCase();
      const instructions=await request('/api/airline-directory/'+encodeURIComponent(airlineCode)+'/instructions'+(aircraft?'?aircraftType='+encodeURIComponent(aircraft):''));
      if(!details.isConnected)return;
      for(const item of instructions.items||[]){
       info.append(el('div',item.title+' · '+item.operation+' · '+item.aircraftType,'fw-semibold mt-2'));
       const notes=el('div',item.body||'','text-muted');notes.style.whiteSpace='pre-wrap';info.append(notes);
       if(item.steps?.length){const ul=el('ul','','mb-2');for(const step of item.steps)ul.append(el('li',step));info.append(ul);}
      }
     }catch(e){info.append(el('div','Instructions unavailable: '+e.message,'text-danger'));}
     const link=el('a','Open full Airline Directory','btn btn-sm btn-outline-primary mt-2');link.href='airline-directory.html?iata='+encodeURIComponent(airlineCode);info.append(link);
    }catch(e){info.textContent=e.message==='Airline not found'?'No directory entry for '+airlineCode+'.':e.message;}
   });
  }
  const buttons=el('div','','d-flex flex-wrap gap-2');body.append(buttons);
  if(!FlightTasks.closed(f))for(const a of f.assignments.filter(a=>!a.acceptedAt)){
   const button=el('button',`Accept ${FlightTasks.label(a.role)}`,'btn btn-success');button.onclick=async()=>{button.disabled=true;busy=true;try{await request(`/api/acknowledgements/${f._id}/assignments/${a._id}/accept`,{method:'POST'});await refresh();}catch(error){$('message').textContent=error.message;}finally{busy=false;button.disabled=false;}};buttons.append(button);
  }
  for(const [label,url] of [['Open flight',`dashboard.html?id=${f._id}`],['Messages',`messages.html?id=${f._id}`],['Check-in → Gate',`handover.html?id=${f._id}`],['Gate items',`gate-items.html?id=${f._id}`],...(f.canLir?[['Open LIR',`lir.html?id=${f._id}`]]:[])]){const link=el('a',label,'btn btn-outline-primary');link.href=url;buttons.append(link);}
  $('cards').append(card);
 }
}
async function refresh(){const check=++generation;try{const data=await request(`/api/my-flights?date=${encodeURIComponent($('date').value)}`);if(check!==generation)return;flights=data.flights;$('identity').textContent=data.user.name;$('message').textContent=flights.length?`${flights.length} assigned flight(s) · actions first`:'No flights assigned to you for this operating date.';render();}catch(error){if(check===generation)$('message').textContent=error.message;}}
$('refresh').onclick=refresh;$('date').onchange=refresh;
let timer=setInterval(()=>{if(!document.hidden&&!busy)refresh();},15000);
window.addEventListener('pagehide',()=>{clearInterval(timer);generation++;});window.addEventListener('pageshow',e=>{if(e.persisted)location.reload();});
window.addEventListener('storage',e=>{if(e.key==='token'||e.key===null){flights=[];render();$('message').textContent='Account changed. Reload this page.';}});
refresh();
