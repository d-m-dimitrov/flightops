/* OPS FIDS: single read-only table, live FlightOps assignments. */
(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  const token=localStorage.getItem('token');
  if(!token){location.replace('login.html');return;}
  const tz='Europe/London';
  const clock=new Intl.DateTimeFormat('en-GB',{timeZone:tz,hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
  let flights=[],lastDate='',version=0,socket=null,debounce=null,refreshTimer=null;
  const node=(tag,value,cls)=>{
    const n=document.createElement(tag);
    if(value!==undefined&&value!==null)n.textContent=String(value);
    if(cls)n.className=cls;
    return n;
  };
  const stamp=value=>value&&Number.isFinite(Date.parse(value))?clock.format(new Date(value)):'—';
  const ms=value=>value&&Number.isFinite(Date.parse(value))?Date.parse(value):null;
  const appendCell=(tr,value,cls)=>{
    const td=node('td',null,cls);
    if(value instanceof Node)td.append(value);
    else if(value!==undefined&&value!==null)td.textContent=String(value);
    tr.append(td);return td;
  };
  function notice(message){
    const panel=$('notice');panel.hidden=!message;panel.textContent=message||'';
  }
  function statusFor(f){
    if(f.departureStatus==='CANCELLED'||f.status==='GROUNDED')return ['GROUNDED / CNL','bad'];
    if(f.status==='CANCELLED')return ['CANCELLED','bad'];
    if(f.status==='RECOVERY_COMPLETED')return ['RECOVERY DONE','good'];
    if(f.departure?.airborne||f.departure?.atd||f.status==='DEPARTED')return ['DEPARTED','good'];
    if(f.isRecovery&&f.status==='RECOVERY_TBC')return ['RECOVERY TBC','special'];
    const std=ms(f.departure?.stdAt),etd=ms(f.departure?.etd);
    const sta=ms(f.arrival?.staAt),eta=ms(f.arrival?.eta);
    if(f.departureToday&&std!==null&&etd!==null&&etd-std>=300000)return ['DELAYED','warn'];
    if(f.arrivalToday&&sta!==null&&eta!==null&&eta-sta>=300000)return ['ARR DELAYED','warn'];
    if(f.departureToday&&std!==null&&Date.now()>std+300000&&!f.departure?.atd &&
       !['PUSHBACK','READY','BOARDING'].includes(f.status))return ['PAST STD','warn'];
    if(f.status==='PUSHBACK')return ['PUSHBACK','info'];
    if(f.status==='READY')return ['READY','good'];
    if(f.status==='BOARDING')return ['BOARDING','warn'];
    if(f.status==='CHECKIN')return ['CHECK-IN','info'];
    if(f.arrivalToday&&f.arrival?.onBlocks)return [f.departureToday?'ON BLOCKS':'ARRIVED','good'];
    if(f.status==='TURNAROUND')return ['TURNAROUND','info'];
    if(f.status==='ARRIVING')return ['ARRIVING','info'];
    if(f.isRecovery)return ['RECOVERY','special'];
    return [f.status||'SCHEDULED','neutral'];
  }
  function times(cell,entries,applicable){
    if(!applicable){cell.append(node('span','—','dim'));return;}
    const box=node('div',null,'times');
    for(const [label,value,tone] of entries){
      const line=node('div',null,'time-line');
      line.append(node('span',label,'time-code'));
      line.append(node('span',stamp(value),tone&&value?'time-'+tone:''));
      box.append(line);
    }
    cell.append(box);
  }
  function people(cell,names,applicable){
    if(!applicable){cell.append(node('span','—','dim'));return;}
    if(!names?.length){cell.append(node('span','UNASSIGNED','missing'));return;}
    for(const person of names)cell.append(node('div',person,'person'));
  }
  function renderFlight(f){
    const tr=node('tr');tr.tabIndex=0;
    const link=node('a',f.isRecovery?(f.departureFlight||'RECOVERY TBC'):
      (f.arrivalFlight||'—')+' / '+(f.departureFlight||'—'),'flight-link');
    link.href='dashboard.html?id='+encodeURIComponent(String(f.id));
    const flight=appendCell(tr,null,'flight-cell');flight.append(link);
    if(f.isRecovery)flight.append(node('div','RECOVERY','flight-note'));
    else if(f.dayLabel)flight.append(node('div',f.dayLabel,'flight-note'));
    const ac=appendCell(tr);ac.append(node('strong',f.aircraft?.aircraftType||'—'));
    ac.append(node('div',f.aircraft?.registration||'—','secondary'));
    appendCell(tr,f.aircraft?.stand||'—','stand');
    times(appendCell(tr,null,'arrival-col'),[
      ['STA',f.arrival?.staAt],['ETA',f.arrival?.eta,'estimate'],
      ['ATA',f.arrival?.onBlocks||f.arrival?.ata,'actual']
    ],f.arrivalToday);
    times(appendCell(tr,null,'departure-col'),[
      ['STD',f.departure?.stdAt],['ETD',f.departure?.etd,'estimate'],
      ['ATD',f.departure?.atd||f.departure?.airborne,'actual']
    ],f.departureToday);
    people(appendCell(tr,null,'arrival-col'),f.dispatchers?.arrival,!!f.arrivalToday);
    people(appendCell(tr,null,'departure-col'),f.dispatchers?.departure,!!f.departureToday&&f.departureStatus!=='CANCELLED');
    const [label,tone]=statusFor(f);
    appendCell(tr,node('span',label,'status '+tone));
    tr.addEventListener('click',event=>{if(!event.target.closest('a'))location.assign(link.href);});
    tr.addEventListener('keydown',event=>{if(event.key==='Enter'&&event.target===tr)location.assign(link.href);});
    return tr;
  }
  function filtered(){
    const mode=$('mode').value,airline=$('airline').value,q=$('search').value.trim().toLowerCase();
    return flights.filter(f=>{
      if(mode==='arrivals'&&!f.arrivalToday)return false;
      if(mode==='departures'&&!f.departureToday)return false;
      if(airline&&f.airline!==airline)return false;
      const terms=[f.airline,f.arrivalFlight,f.departureFlight,f.aircraft?.aircraftType,
        f.aircraft?.registration,f.aircraft?.stand,...(f.dispatchers?.arrival||[]),
        ...(f.dispatchers?.departure||[])].join(' ').toLowerCase();
      return !q||terms.includes(q);
    });
  }
  function render(){
    $('board').dataset.mode=$('mode').value;
    const body=$('flightRows');body.replaceChildren();
    const matches=filtered();
    if(!matches.length){
      const tr=node('tr'),td=node('td','No flights match this date or filter.','empty');
      td.colSpan=8;tr.append(td);body.append(tr);return;
    }
    const fragment=document.createDocumentFragment();
    for(const f of matches)fragment.append(renderFlight(f));
    body.append(fragment);
  }
  function updateAirlines(){
    const select=$('airline'),chosen=select.value;
    const airlines=[...new Set(flights.map(f=>f.airline).filter(Boolean))].sort();
    select.replaceChildren(new Option('All',''));
    for(const airline of airlines)select.append(new Option(airline,airline));
    if(airlines.includes(chosen))select.value=chosen;
  }
  function joinRooms(){
    if(!socket?.connected)return;
    for(const f of flights)socket.emit('joinFlight',String(f.id));
  }
  async function refresh(){
    if(localStorage.getItem('token')!==token){notice('Session changed. Reload and sign in again.');return;}
    const date=$('date').value,request=++version;
    $('refresh').disabled=true;
    try{
      const response=await fetch('/api/ops-fids?date='+encodeURIComponent(date),{
        headers:{Authorization:'Bearer '+token},cache:'no-store'
      });
      const data=await response.json();
      if(request!==version)return;
      if(!response.ok)throw Error(data.error||'Unable to load flights');
      flights=Array.isArray(data.flights)?data.flights:[];
      lastDate=date;updateAirlines();render();
      $('lastUpdated').textContent='Updated '+stamp(data.asOf);
      notice('');joinRooms();
    }catch(error){
      if(request!==version)return;
      notice('OPS FIDS unavailable: '+error.message+(lastDate===date?' · Showing last loaded data.':''));
      if(lastDate!==date){flights=[];updateAirlines();render();}
    }finally{if(request===version)$('refresh').disabled=false;}
  }
  function scheduleRefresh(){
    clearTimeout(debounce);
    debounce=setTimeout(()=>{if(!document.hidden)refresh();},350);
  }
  const params=new URLSearchParams(location.search),requestedDate=params.get('date');
  $('date').value=requestedDate&&/^\d{4}-\d{2}-\d{2}$/.test(requestedDate)?
    requestedDate:OperationalTime.operatingDate();
  const mode=params.get('mode');
  if(['arrivals','departures','combined'].includes(mode))$('mode').value=mode;
  $('date').addEventListener('change',refresh);
  $('mode').addEventListener('change',render);
  $('airline').addEventListener('change',render);
  $('search').addEventListener('input',render);
  $('refresh').addEventListener('click',refresh);
  $('fullscreen').addEventListener('click',async()=>{
    try{
      if(document.fullscreenElement)await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    }catch(error){notice('Fullscreen unavailable: '+error.message);}
  });
  document.addEventListener('fullscreenchange',()=>{
    document.body.classList.toggle('wallboard',!!document.fullscreenElement);
    $('fullscreen').title=document.fullscreenElement?'Press Escape to leave full screen':'Full screen';
  });
  if(typeof io==='function'){
    socket=io();
    socket.on('connect',()=>{ $('liveDot').classList.remove('offline');$('connection').textContent='Live updates connected';joinRooms();refresh();});
    socket.on('disconnect',()=>{ $('liveDot').classList.add('offline');$('connection').textContent='Live updates disconnected';});
    for(const event of ['flightUpdated','assignmentsUpdated','lirUpdated','lirChecklistUpdated','groundStayUpdated'])
      socket.on(event,scheduleRefresh);
  }
  refreshTimer=setInterval(()=>{if(!document.hidden)refresh();},30000);
  window.addEventListener('focus',scheduleRefresh);
  window.addEventListener('pagehide',()=>{clearInterval(refreshTimer);clearTimeout(debounce);version++;socket?.disconnect();});
  window.addEventListener('pageshow',event=>{if(event.persisted)location.reload();});
  window.addEventListener('storage',event=>{
    if(event.key==='token'||event.key===null)if(localStorage.getItem('token')!==token){
      flights=[];render();notice('Session changed. Reload and sign in again.');
    }
  });
  refresh();
})();
