checkAuth();
const $=id=>document.getElementById(id),token=localStorage.getItem('token');
let generation=0,flights=[],busy=false;
const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
const datePart=t=>parts.find(p=>p.type===t).value;
$('date').value=`${datePart('year')}-${datePart('month')}-${datePart('day')}`;
function el(tag,text,cls){const e=document.createElement(tag);e.textContent=text;if(cls)e.className=cls;return e;}
async function request(url,options={}){if(localStorage.getItem('token')!==token)throw Error('Account changed. Reload this page.');const r=await fetch(url,{...options,headers:{Authorization:`Bearer ${token}`}});if(localStorage.getItem('token')!==token)throw Error('Account changed. Reload this page.');if(!r.ok)throw Error((await r.json()).error||'Unable to load flights');const body=await r.json();if(localStorage.getItem('token')!==token)throw Error('Account changed. Reload this page.');return body;}
function time(value){return value?new Date(value).toLocaleTimeString('en-GB',{timeZone:'Europe/London',hour:'2-digit',minute:'2-digit'}):'—';}
function countdown(f){const target=FlightTasks.target(f),at=Date.parse(target.value);if(FlightTasks.closed(f))return f.status;if(!Number.isFinite(at))return `${target.label}: time unavailable`;const minutes=Math.ceil((at-Date.now())/60000);return `${target.label} ${time(target.value)} · ${minutes>=0?`${Math.floor(minutes/60)}h ${minutes%60}m remaining`:`${Math.abs(minutes)}m past`}`;}
function render(){
 $('cards').replaceChildren();
 for(const f of FlightTasks.sort(flights)){
  const tasks=FlightTasks.actions(f),card=el('article','',`card flight-card ${tasks.length?'attention':''}`),body=el('div','','card-body');card.append(body);
  body.append(el('h2',f.flightNumberDisplay||`${f.arrivalFlight||'—'} / ${f.departureFlight||'—'}`,'h5'),el('p',`${f.assignments.map(a=>a.role).join(' · ')} · ${f.status}`,'small text-muted'),el('div',`Stand ${f.aircraft?.stand||'—'} · ${f.aircraft?.registration||'—'}`));
  body.append(el('div',`STA ${f.arrival?.sta||time(f.arrival?.staAt)} · STD ${f.departure?.std||time(f.departure?.stdAt)}`,'small'));
  const clock=el('p',countdown(f),'countdown mt-2');clock.dataset.flight=f._id;body.append(clock);
  if(tasks.length){const list=el('ul','','action-list');tasks.forEach(t=>list.append(el('li',t)));body.append(list);}else body.append(el('p','No pending acknowledgements','text-muted'));
  body.append(el('p',f.handover?`Handover v${f.handover.revision} · ${f.handover.received?'Received by Gate':'Awaiting Gate receipt'}`:'Check-in handover not sent','small'));
  if(f.canLir)body.append(el('p',f.lir?`LIR v${f.lir.revision} · ${f.lir.status} · ${f.lir.received?'Read':'Awaiting receipt'}`:'LIR not uploaded','small'));
  const buttons=el('div','','d-flex flex-wrap gap-2');body.append(buttons);
  if(!FlightTasks.closed(f))for(const a of f.assignments.filter(a=>!a.acceptedAt)){
   const button=el('button',`Accept ${a.role}`,'btn btn-success');button.onclick=async()=>{button.disabled=true;busy=true;try{await request(`/api/acknowledgements/${f._id}/assignments/${a._id}/accept`,{method:'POST'});await refresh();}catch(error){$('message').textContent=error.message;}finally{busy=false;button.disabled=false;}};buttons.append(button);
  }
  for(const [label,url] of [['Open flight',`dashboard.html?id=${f._id}`],['Check-in → Gate',`handover.html?id=${f._id}`],...(f.canLir?[['Open LIR',`lir.html?id=${f._id}`]]:[])]){const link=el('a',label,'btn btn-outline-primary');link.href=url;buttons.append(link);}
  $('cards').append(card);
 }
}
async function refresh(){const check=++generation;try{const data=await request(`/api/my-flights?date=${encodeURIComponent($('date').value)}`);if(check!==generation)return;flights=data.flights;$('identity').textContent=data.user.name;$('message').textContent=flights.length?`${flights.length} assigned flight(s) · actions first`:'No flights assigned to you for this operating date.';render();}catch(error){if(check===generation)$('message').textContent=error.message;}}
$('refresh').onclick=refresh;$('date').onchange=refresh;
let timer=setInterval(()=>{if(!document.hidden&&!busy)refresh();},15000);
window.addEventListener('pagehide',()=>{clearInterval(timer);generation++;});window.addEventListener('pageshow',e=>{if(e.persisted)location.reload();});
window.addEventListener('storage',e=>{if(e.key==='token'||e.key===null){flights=[];render();$('message').textContent='Account changed. Reload this page.';}});
refresh();
