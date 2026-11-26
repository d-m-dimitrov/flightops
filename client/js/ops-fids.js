/* OPS FIDS · read-only operational wallboard. All flight and staff data from /api/ops-fids. */
(() => {
 'use strict';
 const $=id=>document.getElementById(id);
 const token=localStorage.getItem('token');
 if(!token){location.replace('login.html');return;}
 let rows=[],aog=[],lastDate='',requestId=0,busy=false,socket=null,refreshTimer,clockTimer,debounce;
 const timeZone='Europe/London';
 const clockFormat=new Intl.DateTimeFormat('en-GB',{timeZone,hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
 const dateFormat=new Intl.DateTimeFormat('en-GB',{timeZone,weekday:'short',day:'2-digit',month:'short',year:'numeric'});
 const shortTime=new Intl.DateTimeFormat('en-GB',{timeZone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
 const el=(tag,value,cls)=>{
  const n=document.createElement(tag);if(value!==undefined&&value!==null)n.textContent=String(value);
  if(cls)n.className=cls;return n;
 };
 const formatted=value=>value&&Number.isFinite(Date.parse(value))?shortTime.format(new Date(value)):'—';
 const dateText=value=>value&&Number.isFinite(Date.parse(value))?dateFormat.format(new Date(value)):'—';
 const dateTime=value=>value&&Number.isFinite(Date.parse(value))?
  dateFormat.format(new Date(value))+' '+shortTime.format(new Date(value)):'TBC';
 const minutes=value=>value&&Number.isFinite(Date.parse(value))?Date.parse(value):null;
 const field=(t,c,v)=>{
  const td=el('td',null,c);
  if(typeof v==='string')td.textContent=v;
  else if(v)td.append(v);
  t.append(td);return td;
 };
 function updateClock(){
  $('londonClock').textContent=clockFormat.format(new Date());
  $('londonDate').textContent=dateFormat.format(new Date());
 }
 function setConnection(connected){
  $('connection').textContent=connected?'LIVE · 30s backup refresh':'Offline · 30s refresh';
  $('liveDot').classList.toggle('offline',!connected);
 }
 function showNotice(message){
  const n=$('notice');n.hidden=!message;n.textContent=message||'';
 }
 function statusFor(f){
  if(f.departureStatus==='CANCELLED'||f.status==='GROUNDED')
   return {label:'GROUNDED / CNL',kind:'bad'};
  if(f.status==='CANCELLED')return {label:'CANCELLED',kind:'bad'};
  if(f.status==='RECOVERY_COMPLETED')return {label:'RECOVERY DONE',kind:'good'};
  if(f.departure?.airborne||f.departure?.atd||f.status==='DEPARTED')return {label:'DEPARTED',kind:'good'};
  if(f.isRecovery&&f.status==='RECOVERY_TBC')return {label:'RECOVERY TBC',kind:'special'};
  const dep=minutes(f.departure?.stdAt),etd=minutes(f.departure?.etd);
  const arr=minutes(f.arrival?.staAt),eta=minutes(f.arrival?.eta);
  const activeDep=f.departureToday&&!f.departure?.atd;
  const activeArr=f.arrivalToday&&!f.arrival?.onBlocks;
  if(activeDep&&dep!==null&&etd!==null&&etd-dep>=5*60000)return {label:'DELAYED',kind:'warn'};
  if(activeArr&&arr!==null&&eta!==null&&eta-arr>=5*60000)return {label:'ARR DELAYED',kind:'warn'};
  if(activeDep&&dep!==null&&Date.now()>dep+5*60000&&!f.departure?.atd&&
   !['PUSHBACK','READY','BOARDING'].includes(f.status))return {label:'PAST STD',kind:'warn'};
  if(f.status==='PUSHBACK')return {label:'PUSHBACK',kind:'info'};
  if(f.status==='READY')return {label:'READY',kind:'good'};
  if(f.status==='BOARDING')return {label:'BOARDING',kind:'warn'};
  if(f.status==='CHECKIN')return {label:'CHECK-IN',kind:'info'};
  if(f.arrivalToday&&f.arrival?.onBlocks)return {label:f.departureToday?'ON BLOCKS':'ARRIVED',kind:'good'};
  if(f.status==='ARRIVING'||f.status==='TURNAROUND')return {label:f.status==='TURNAROUND'?'TURNAROUND':'ARRIVING',kind:'info'};
  if(f.isRecovery)return {label:'RECOVERY',kind:'special'};
  return {label:f.status||'SCHEDULED',kind:'neutral'};
 }
 function isCompleted(f){
  return f.status==='CANCELLED'||f.status==='RECOVERY_COMPLETED'||f.status==='AOG_CLOSED'||
   f.status==='DEPARTED'||!!f.departure?.atd||!!f.departure?.airborne;
 }
 function addTimes(cell,entries){
  const wrap=el('div',null,'time-pairs');
  for(const [label,value,kind] of entries){
   const line=el('div'),lbl=el('span',label,'time-label'),
    actual=el('span',formatted(value),'time-value '+(kind==='actual'&&value?'time-actual':kind==='estimate'&&value?'time-changed':''));
   line.append(lbl,actual);wrap.append(line);
  }
  cell.append(wrap);
 }
 function dispatcherList(cell,names,applicable){
  if(!applicable){cell.append(el('span','—','not-applicable'));return;}
  if(!names?.length){cell.append(el('span','UNASSIGNED','unassigned'));return;}
  const block=el('div',null,'dispatcher-list');
  for(const name of names)block.append(el('span',name,'dispatcher'));cell.append(block);
 }
 function statusBadge(parent,status){
  parent.append(el('span',status.label,'status '+status.kind));
 }
 function rowUI(f){
  const tr=el('tr');tr.tabIndex=0;const id=String(f.id);
  const flightCell=field(tr,'');
  const n=el('a',f.isRecovery?(f.departureFlight||'RECOVERY TBC'):
    (f.arrivalFlight||'—')+' / '+(f.departureFlight||'—'),'flight-link');
  n.href='dashboard.html?id='+encodeURIComponent(id);flightCell.append(n);
  const caption=f.isRecovery?'Recovery departure':f.dayLabel||f.airline||'';
  flightCell.append(el('span',caption,'flight-sub'));
  if(f.departureStatus==='CANCELLED')flightCell.append(el('span','Departure cancelled','flight-sub'));
  const ac=field(tr,'');ac.append(el('strong',f.aircraft?.aircraftType||'—'));
  ac.append(el('span',f.aircraft?.registration||'Registration TBC','sub'));
  field(tr,'',f.aircraft?.stand||'—');
  const arr=field(tr,'arrival-col');
  if(f.arrivalToday)addTimes(arr,[['STA',f.arrival?.staAt],['ETA',f.arrival?.eta,'estimate'],['ATA',f.arrival?.onBlocks||f.arrival?.ata,'actual']]);
  else arr.append(el('span','—','not-applicable'));
  const dep=field(tr,'departure-col');
  if(f.departureToday)addTimes(dep,[['STD',f.departure?.stdAt],['ETD',f.departure?.etd,'estimate'],['ATD',f.departure?.atd||f.departure?.airborne,'actual']]);
  else dep.append(el('span','—','not-applicable'));
  dispatcherList(field(tr,'arrival-col'),f.dispatchers?.arrival,f.arrivalToday);
  dispatcherList(field(tr,'departure-col'),f.dispatchers?.departure,f.departureToday&&f.departureStatus!=='CANCELLED');
  dispatcherList(field(tr,''),f.dispatchers?.ramp,f.departureToday&&f.departureStatus!=='CANCELLED');
  const lir=field(tr,'');
  if(f.departureToday&&f.departureStatus!=='CANCELLED'){
   lir.append(el('div',f.lir?.loading||'NO CHECKLIST','code'));
   if(f.lir?.status!=='NONE')lir.append(el('span','LIR: '+f.lir.status,'sub'));
  }else lir.append(el('span','—','not-applicable'));
  const statusCell=field(tr,'');statusBadge(statusCell,statusFor(f));
  tr.addEventListener('click',event=>{
   if(event.target.closest('a'))return;
   location.assign(n.href);
  });
  tr.addEventListener('keydown',event=>{if(event.key==='Enter'&&event.target===tr)location.assign(n.href);});
  return tr;
 }
 function aogUI(stay){
  const card=el('article',null,'aog-item'+(stay.status==='CLOSED'?' closed':stay.status==='RECOVERY_PLANNED'?' recovery':''));
  const head=el('div',null,'aog-head');
  head.append(el('strong',stay.registration||'Registration TBC'));
  const dep=stay.displayStatus==='RECOVERY DEPARTED'?'RECOVERY DEPARTED':
   stay.status==='CLOSED'?'CLOSED':stay.status==='RECOVERY_PLANNED'?'RECOVERY PLANNED':'GROUNDED';
  statusBadge(head,{label:dep,kind:dep==='RECOVERY DEPARTED'?'good':stay.status==='CLOSED'?'neutral':stay.status==='RECOVERY_PLANNED'?'special':'bad'});
  card.append(head);
  card.append(el('p',(stay.aircraftType||'—')+' · Stand '+(stay.stand||'TBC')+
   ' · '+(stay.reason||'AOG')));
  card.append(el('p','Original '+(stay.arrivalFlight||'—')+' / '+(stay.originalDepartureFlight||'—')));
  card.append(el('p','Grounded '+dateTime(stay.groundedAt)+' · Release '+dateTime(stay.expectedReleaseAt)));
  card.append(el('p','Recovery '+(stay.recoveryFlight||'TBC')+
   (stay.recoveryDate?' · '+stay.recoveryDate:'')+
   (stay.recoveryStatus?' · '+stay.recoveryStatus:'')));
  const links=el('div');
  if(stay.originalFlightId){
   const a=el('a','Original flight');a.href='dashboard.html?id='+encodeURIComponent(String(stay.originalFlightId));
   links.append(a);
  }
  if(stay.recoveryFlightId){
   if(links.childNodes.length)links.append(el('span',' · '));
   const a=el('a','Recovery flight');a.href='dashboard.html?id='+encodeURIComponent(String(stay.recoveryFlightId));links.append(a);
  }
  card.append(links);
  return card;
 }
 function filters(){
  const chosen=$('airline').value,search=$('search').value.trim().toLowerCase(),mode=$('mode').value;
  return rows.filter(f=>{
   if(mode==='arrivals'&&!f.arrivalToday||mode==='departures'&&!f.departureToday)return false;
   if(chosen&&f.airline!==chosen)return false;
   if($('hideCompleted').checked&&isCompleted(f))return false;
   const hay=[f.airline,f.arrivalFlight,f.departureFlight,f.aircraft?.registration,
    f.aircraft?.aircraftType,f.aircraft?.stand,...(f.dispatchers?.arrival||[]),
    ...(f.dispatchers?.departure||[]),...(f.dispatchers?.ramp||[])].join(' ').toLowerCase();
   return !search||hay.includes(search);
  });
 }
 function paint(){
  const filtered=filters(),mode=$('mode').value;
  $('board').dataset.mode=mode;
  const body=$('flightRows');body.replaceChildren();
  if(!filtered.length){
   const tr=el('tr'),td=el('td','No flights match the selected date and filters.','empty');
   td.colSpan=10;tr.append(td);body.append(tr);
  }else{
   const frag=document.createDocumentFragment();
   for(const f of filtered)frag.append(rowUI(f));body.append(frag);
  }
  const countId=(id,value)=>{$(id).textContent=String(value);};
  countId('metricFlights',filtered.length);
  countId('metricArrivals',filtered.filter(f=>f.arrivalToday).length);
  countId('metricDepartures',filtered.filter(f=>f.departureToday).length);
  countId('metricDelayed',filtered.filter(f=>statusFor(f).kind==='warn'&&['DELAYED','ARR DELAYED','PAST STD'].includes(statusFor(f).label)).length);
  const aogShown=aog.filter(stay=>{
   const q=$('search').value.trim().toLowerCase();
   const hay=[stay.registration,stay.aircraftType,stay.stand,stay.arrivalFlight,stay.originalDepartureFlight,stay.recoveryFlight].join(' ').toLowerCase();
   return (!q||hay.includes(q))&&(!$('airline').value||String(stay.arrivalFlight).startsWith($('airline').value));
  });
  countId('metricAog',aogShown.filter(x=>x.status!=='CLOSED').length);
  $('aogCount').textContent=aogShown.length+' aircraft';
  const list=$('aogRows');list.replaceChildren();
  if(!aogShown.length)list.append(el('p','No aircraft ground stays for this date.','sub'));
  else for(const g of aogShown)list.append(aogUI(g));
 }
 function populateAirlines(){
  const select=$('airline'),keep=select.value,
   options=[...new Set(rows.map(f=>f.airline).filter(Boolean))].sort();
  select.replaceChildren(new Option('All airlines',''));
  for(const v of options)select.append(new Option(v,v));
  if(options.includes(keep))select.value=keep;
 }
 function joinRooms(){
  if(!socket?.connected)return;
  for(const f of rows)socket.emit('joinFlight',String(f.id));
 }
 async function refresh(){
  if(localStorage.getItem('token')!==token){showNotice('Account changed. Reload the page.');return;}
  const date=$('date').value,seq=++requestId;
  $('refresh').disabled=true;busy=true;
  try{
   const response=await fetch('/api/ops-fids?date='+encodeURIComponent(date),{
    headers:{Authorization:'Bearer '+token},cache:'no-store'
   });
   const data=await response.json();
   if(seq!==requestId)return;
   if(!response.ok)throw Error(data.error||'Unable to load OPS FIDS');
   rows=Array.isArray(data.flights)?data.flights:[];aog=Array.isArray(data.aog)?data.aog:[];
   lastDate=date;populateAirlines();paint();
   $('lastUpdated').textContent='Updated '+formatted(data.asOf)+' London';
   showNotice('');
   joinRooms();
  }catch(error){
   if(seq!==requestId)return;
   showNotice('OPS FIDS data could not be refreshed: '+error.message+
    (lastDate===date?' · Last loaded data may be outdated.':' · No verified data for this date.'));
   if(lastDate!==date){rows=[];aog=[];paint();}
  }finally{if(seq===requestId){busy=false;$('refresh').disabled=false;}}
 }
 function scheduleRefresh(){
  clearTimeout(debounce);debounce=setTimeout(()=>{if(!document.hidden)refresh();},350);
 }
 const params=new URLSearchParams(location.search);
 const requestedDate=params.get('date');
 $('date').value=requestedDate&&/^\d{4}-\d{2}-\d{2}$/.test(requestedDate)?requestedDate:OperationalTime.operatingDate();
 const mode=params.get('mode');if(['arrivals','departures','combined'].includes(mode))$('mode').value=mode;
 $('date').addEventListener('change',refresh);
 $('mode').addEventListener('change',paint);
 $('airline').addEventListener('change',paint);
 $('search').addEventListener('input',paint);
 $('hideCompleted').addEventListener('change',paint);
 $('refresh').addEventListener('click',refresh);
 $('fullscreen').addEventListener('click',async()=>{
  try{
   if(document.fullscreenElement)await document.exitFullscreen();
   else await document.documentElement.requestFullscreen();
  }catch(error){showNotice('Full screen unavailable: '+error.message);}
 });
 document.addEventListener('fullscreenchange',()=>{$('fullscreen').textContent=document.fullscreenElement?'⛶ Exit full screen':'⛶ Full screen';});
 updateClock();clockTimer=setInterval(updateClock,1000);
 if(typeof io==='function'){
  socket=io();
  socket.on('connect',()=>{setConnection(true);joinRooms();refresh();});
  socket.on('disconnect',()=>setConnection(false));
  for(const event of ['flightUpdated','assignmentsUpdated','lirUpdated','lirChecklistUpdated','groundStayUpdated'])
   socket.on(event,scheduleRefresh);
 }else setConnection(false);
 refreshTimer=setInterval(()=>{if(!document.hidden)refresh();},30000);
 window.addEventListener('focus',scheduleRefresh);
 window.addEventListener('pagehide',()=>{clearInterval(clockTimer);clearInterval(refreshTimer);clearTimeout(debounce);requestId++;socket?.disconnect();});
 window.addEventListener('pageshow',event=>{if(event.persisted)location.reload();});
 window.addEventListener('storage',event=>{if(event.key==='token'||event.key===null){
  if(localStorage.getItem('token')!==token){rows=[];aog=[];paint();showNotice('Session changed. Reload and sign in again.');}
 }});
 refresh();
})();
