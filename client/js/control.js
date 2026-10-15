checkAuth();
const $ = id => document.getElementById(id), token = localStorage.getItem('token');
let data = {flights:[],staff:[],roles:[]}, version = 0, editorVersion = 0, edit = null, timer, debounce, socket;
const labels = {ARRIVAL:'Arrival Agent',ARRIVAL_DISPATCH:'Arrival Dispatcher',DISPATCH:'Departure Dispatcher',CHECKIN:'Check-in',GATE:'Gate',RAMP:'RAMP',SPUR:'SPUR'};
$('date').value = OperationalTime.operatingDate();
function el(tag,text,cls) { const node=document.createElement(tag);node.textContent=text;if(cls)node.className=cls;return node; }
function time(at) { return at && Number.isFinite(Date.parse(at)) ? new Date(at).toLocaleTimeString('en-GB',{timeZone:'Europe/London',hour:'2-digit',minute:'2-digit'}) : '—'; }
function name(f) { return `${f.arrivalFlight || '—'} / ${f.departureFlight || '—'}`; }
function link(text,url) {const node=el('a',text);node.href=url;return node;}
async function request(url, options={}) {
  if (!token || localStorage.getItem('token') !== token) throw Error('Account changed. Reload this page.');
  const response=await fetch(url,{...options,headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`}});
  if (localStorage.getItem('token') !== token) throw Error('Account changed. Reload this page.');
  const body=await response.json();
  if (localStorage.getItem('token') !== token) throw Error('Account changed. Reload this page.');
  if (!response.ok) { const error=Error(body.error || 'Request failed');error.status=response.status;throw error; }
  return body;
}
function remaining(f) {
  if (ControlModel.closed(f)) return 'Closed';
  const at=Date.parse(ControlModel.target(f));
  if (!Number.isFinite(at)) return 'Time unavailable';
  const minutes=Math.ceil((at-Date.now())/60000);
  return minutes >= 0 ? `${Math.floor(minutes/60)}h ${minutes%60}m to ${f.departure?.etd?'ETD':'STD'}` : `${-minutes}m past ${f.departure?.etd?'ETD':'STD'}`;
}
function render() {
  const all=data.flights, open=all.filter(f=>!ControlModel.closed(f));
  $('summary').replaceChildren();
  for (const [label,count] of [['Flights',all.length],['Open',open.length],['With assignment gaps',open.filter(f=>ControlModel.gaps(f).length).length],['With pending actions',open.filter(f=>ControlModel.actions(f).length).length],['Delayed / past STD',open.filter(f=>ControlModel.late(f)).length]]) {
    const tile=el('div','','metric');tile.append(el('strong',count),el('span',label));$('summary').append(tile);
  }
  const query=$('search').value.trim().toLowerCase(), filter=$('filter').value;
  const filtered=all.filter(f=>{
    const haystack=[name(f),f.airline,f.aircraft?.stand,f.aircraft?.registration,...f.assignments.map(a=>a.userId?.name)].join(' ').toLowerCase();
    return haystack.includes(query) && (filter==='all' || filter==='open'&&!ControlModel.closed(f) || filter==='gaps'&&ControlModel.gaps(f).length || filter==='attention'&&ControlModel.actions(f).length || filter==='late'&&ControlModel.late(f));
  }).sort((a,b)=>Number(ControlModel.closed(a))-Number(ControlModel.closed(b)) || (Date.parse(ControlModel.target(a))||Infinity)-(Date.parse(ControlModel.target(b))||Infinity));
  $('flights').replaceChildren();
  for (const f of filtered) {
    const row=el('tr'), identity=el('td');identity.append(el('strong',name(f)),el('p',`${f.airline || ''} · ${f.aircraft?.aircraftType || '—'}`),el('p',`Stand ${f.aircraft?.stand || '—'} · ${f.aircraft?.registration || '—'}`,'muted'));
    const times=el('td');times.append(el('p',`STA ${time(f.arrival?.staAt)} · ETA ${time(f.arrival?.eta)}`),el('p',`STD ${time(f.departure?.stdAt)} · ETD ${time(f.departure?.etd)}`));
    const status=el('td');status.append(el('span',f.status,'tag'),el('p',remaining(f)));if(ControlModel.late(f))status.append(el('span','Delayed / past STD','tag warn'));
    const assignments=el('td');
    for(const a of f.assignments) assignments.append(el('p',`${labels[a.role]||a.role}: ${a.userId?.name||'Missing user'} ${a.acceptedAt?'✓':'· pending'}`));
    const gaps=ControlModel.gaps(f);if(gaps.length)assignments.append(el('p',`Unassigned: ${gaps.map(r=>labels[r]).join(', ')}`,'muted'));
    const tasks=el('td'), list=el('ul'), actions=ControlModel.actions(f);actions.forEach(t=>list.append(el('li',t)));tasks.append(actions.length?list:el('span','No pending actions','muted'));
    const manage=el('td'), button=el('button','Allocate');button.disabled=ControlModel.closed(f);button.onclick=()=>openEditor(f);manage.append(button,el('p'));manage.append(link('Open flight',`dashboard.html?id=${f._id}`));
    row.append(identity,times,status,assignments,tasks,manage);$('flights').append(row);
  }
  if(!filtered.length){const row=el('tr'),cell=el('td','No flights match this date and filter.');cell.colSpan=6;row.append(cell);$('flights').append(row);}
  $('team').replaceChildren();
  const workload=ControlModel.workload(all);
  for(const person of workload.sort((a,b)=>b.conflicts.length-a.conflicts.length||String(a.user.name || '').localeCompare(String(b.user.name || '')))) {
    const card=el('article','','person');card.append(el('strong',person.user.name));
    card.append(el('p',`${new Set(person.assignments.map(a=>String(a.flight._id))).size} open flights · ${person.assignments.length} roles`));
    const list=el('ul');for(const a of person.assignments){const item=el('li');item.append(link(`${name(a.flight)} · ${labels[a.role]||a.role}`,`dashboard.html?id=${a.flight._id}`));list.append(item);}card.append(list);
    if(person.conflicts.length)card.append(el('p',`${person.conflicts.length} possible window overlap(s) — review allocation`,'tag warn'));
    $('team').append(card);
  }
  if(!workload.length)$('team').append(el('p','No staff assigned to open flights.','muted'));
}
async function refresh() {
  const current=++version;
  try {
    const body=await request(`/api/control?date=${encodeURIComponent($('date').value)}`);
    if(current!==version)return;
    data=body;$('identity').textContent=`${body.user.name} · ${body.user.position || 'ADMIN'}`;
    $('message').textContent='';$('updated').textContent=`Updated ${time(new Date().toISOString())} London`;render();
    if(socket?.connected)for(const f of data.flights)socket.emit('joinFlight',f._id);
  } catch(error) {
    if(current!==version)return;
    $('message').textContent=`${error.message}${data.flights.length?' · Displayed data may be out of date.':''}`;
    if([401,403].includes(error.status)){data={flights:[],staff:[],roles:[]};render();$('allocation').close();socket?.disconnect();}
  }
}
function snapshot(rows,roles) {return rows.filter(a=>roles.includes(a.role)).map(a=>`${a._id}:${a.role}:${a.userId?._id||a.userId||''}`).sort();}
async function openEditor(f) {
  const editorRequest=++editorVersion;
  $('saveMessage').textContent='';$('assignmentFields').replaceChildren();$('allocationTitle').textContent=`Allocate ${name(f)}`;
  $('allocationHelp').textContent='Loading latest assignments…';$('save').disabled=true;$('allocation').showModal();edit=null;
  try {
    const assignments=await request(`/api/assignments/${f._id}`);
    if(!$('allocation').open || editorRequest !== editorVersion)return;
    edit={flight:f,expectedAssignments:snapshot(assignments,data.roles),roles:[...data.roles]};
    $('allocationHelp').textContent='Only agents with valid airline/role training for this operating date can be assigned. “Unassigned” removes that role. Other departments are preserved.';
    for(const role of edit.roles){
      const label=el('label',labels[role]||role),select=el('select');select.dataset.role=role;select.append(new Option('Unassigned',''));
      const current=assignments.filter(a=>a.role===role),selected=current[0]?.userId;
      for(const user of data.staff.filter(u=>AirlineQualifications.eligible(u,f.airline,role,f.operatingDate)))select.append(new Option(user.name,user._id));
      if(selected && ![...select.options].some(o=>o.value===String(selected._id))) {const option=new Option(`${selected.name} (not qualified — replace or remove)`,selected._id);option.disabled=true;select.append(option);}
      select.value=selected?._id||'';label.append(select);if(current.length>1)label.append(el('small','Multiple existing assignments — saving will resolve to this selection.','text-danger'));$('assignmentFields').append(label);
    }
    $('save').disabled=false;
  }catch(error){$('allocationHelp').textContent=error.message;}
}
$('allocationForm').onsubmit=async event=>{
  event.preventDefault();if(!edit)return;
  $('save').disabled=true;$('cancel').disabled=true;
  try{
    const assignments=[...$('assignmentFields').querySelectorAll('select')].filter(s=>s.value).map(s=>({role:s.dataset.role,userId:s.value}));
    await request(`/api/assignments/${edit.flight._id}`,{method:'POST',body:JSON.stringify({assignments,expectedAssignments:edit.expectedAssignments})});
    $('allocation').close();edit=null;await refresh();
  }catch(error){$('saveMessage').textContent=error.status===409?'Assignments changed. Close and reopen this editor to review them.':error.message;}
  finally{$('save').disabled=false;$('cancel').disabled=false;}
};
$('cancel').onclick=()=>{editorVersion++;$('allocation').close();edit=null;};
$('search').oninput=render;$('filter').onchange=render;$('refresh').onclick=refresh;
$('date').onchange=()=>{data.flights=[];render();refresh();};
for(const button of document.querySelectorAll('[data-offset]'))button.onclick=()=>{$('date').value=OperationalTime.addDays(OperationalTime.operatingDate(),Number(button.dataset.offset));$('date').onchange();};
if(typeof io==='function'){
  socket=io();socket.on('connect',()=>{$('connection').textContent='Live connection · 15s refresh';refresh();});
  socket.on('disconnect',()=>{$('connection').textContent='Live connection offline · 15s refresh';});
  const schedule=()=>{clearTimeout(debounce);debounce=setTimeout(()=>{if(!document.hidden)refresh();},400);};
  for(const event of ['flightUpdated','assignmentsUpdated'])socket.on(event,schedule);
}else $('connection').textContent='15-second refresh';
timer=setInterval(()=>{if(!document.hidden)refresh();},15000);
window.addEventListener('pagehide',()=>{clearInterval(timer);clearTimeout(debounce);version++;socket?.disconnect();});
window.addEventListener('pageshow',e=>{if(e.persisted)location.reload();});
window.addEventListener('storage',e=>{if(e.key==='token'||e.key===null){version++;data={flights:[],staff:[],roles:[]};render();$('allocation').close();socket?.disconnect();clearInterval(timer);$('message').textContent='Account changed. Reload this page.';}});
refresh();
