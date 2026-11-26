/* Aircraft Ground Stay / Recovery Flight. No modification of recurring schedules. */
(() => {
 'use strict';
 const $=id=>document.getElementById(id);
 const onFlights=Boolean($('flightContainer'));
 const onDashboard=Boolean($('flightInfo'));
 if(!onFlights&&!onDashboard)return;
 const flightId=onDashboard?new URLSearchParams(location.search).get('id'):null;
 const panel=document.createElement('section');
 panel.id='groundStayCard';panel.className='card border-warning mb-3';
 panel.innerHTML='<div class="card-header d-flex align-items-center justify-content-between gap-2"><strong>✈ Aircraft Ground Stay / Recovery Flights</strong><span class="small text-muted">AOG</span></div><div class="card-body" id="groundStayBody"><span class="text-muted">Loading aircraft ground stays…</span></div>';
 if(onFlights)$('flightSummary').after(panel);else $('flightInfo').before(panel);
 const contents=$('groundStayBody');
 const dialog=document.createElement('div');dialog.className='modal fade';dialog.id='groundStayModal';dialog.tabIndex=-1;
 dialog.innerHTML='<div class="modal-dialog"><form class="modal-content" id="groundStayForm"><div class="modal-header"><h5 class="modal-title" id="groundStayModalTitle">Aircraft Ground Stay</h5><button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button></div><div class="modal-body" id="groundStayFormBody"></div><div class="modal-footer"><div class="small text-danger me-auto" id="groundStayFormError" role="alert"></div><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button><button class="btn btn-primary" id="groundStaySubmit" type="submit">Save</button></div></form></div>';
 document.body.append(dialog);
 const modal=new bootstrap.Modal(dialog);
 let mode='',current=null,canManage=false,lastFlight=null,requestId=0;
 const state={canManage:false};
 const token=()=>localStorage.getItem('token')||'';
 async function api(url,method='GET',body){
  const response=await fetch('/api/ground-stays'+url,{method,headers:{Authorization:'Bearer '+token(),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,cache:'no-store'});
  let data;try{data=await response.json();}catch{throw Error('Ground Stay server returned an invalid response');}
  if(!response.ok)throw Error(data.error||'Ground Stay request failed');
  return data;
 }
 const small=(value,classes='small text-muted')=>{const e=document.createElement('div');e.className=classes;e.textContent=value;return e;};
 const button=(text,style,action)=>{
  const b=document.createElement('button');b.type='button';b.className='btn btn-sm '+style;b.textContent=text;b.addEventListener('click',action);return b;
 };
 const local=v=>v?new Date(v).toLocaleString('en-GB',{timeZone:'Europe/London',dateStyle:'medium',timeStyle:'short'}):'TBC';
 const asLocal=v=>v?OperationalTime.localInput(v).slice(0,16):'';
 const linkFlight=(flight,label)=>{
  const a=document.createElement('a');a.href='dashboard.html?id='+encodeURIComponent(flight.id);
  a.className='btn btn-sm btn-outline-primary';a.textContent=label;return a;
 };
 function formContents(title,html){
  $('groundStayModalTitle').textContent=title;
  $('groundStayFormBody').innerHTML=html; // Templates contain fixed UI markup only, not user data.
  $('groundStayFormError').textContent='';
  $('groundStaySubmit').disabled=false;
  modal.show();
 }
 const reasonOptions='<option value="TECHNICAL">Technical</option><option value="OPERATIONAL">Operational</option><option value="WEATHER">Weather</option><option value="CREW">Crew</option><option value="OTHER">Other</option>';
 const reasonField='<label class="form-label" for="aogReason">Reason</label><select name="reason" id="aogReason" class="form-select mb-3" required>'+reasonOptions+'</select>';
 function openGroundForm(flight){
  if(!canManage)return;
  if(flight?.isRecovery){alert('A recovery flight cannot be grounded as an original arrival.');return;}
  if(!flight?.aircraft?.registration){alert('First enter the aircraft registration in Flight Details, then use Ground Aircraft.');return;}
  mode='ground';current=flight;
  formContents('Ground Aircraft · '+(flight.arrivalFlight||'Arrival'),
   '<p class="small text-danger fw-semibold">This marks the original departure as CANCELLED. The arrival is preserved. The regular schedule is not changed.</p>'+
   '<div class="mb-3 fw-bold" id="aogAircraftLabel"></div>'+reasonField+
   '<label class="form-label" for="aogNotes">Operational notes</label><textarea name="notes" id="aogNotes" class="form-control" rows="3" maxlength="600" placeholder="Reason / aircraft condition / operational notes"></textarea>');
  $('aogAircraftLabel').textContent=(flight.aircraft.registration||'')+' · '+(flight.arrivalFlight||'')+' → '+(flight.departureFlight||'')+' (cancel departure)';
 }
 function openRecovery(stay){
  if(!canManage||stay.status==='CLOSED')return;
  mode='recovery';current=stay;
  const old=stay.recovery;
  formContents(old?'Update Recovery Flight':'Create Recovery Flight',
   '<p class="small text-muted">New departure-only flight linked to '+stay.registration+'. The flight number and STD can remain TBC until confirmed. No LIR, baggage, staff or loading confirmation is copied.</p>'+
   '<label class="form-label" for="recDate">Departure date (London)</label><input type="date" class="form-control mb-2" name="departureDate" id="recDate" required>'+
   '<label class="form-label" for="recNumber">Recovery flight number (optional · TBC)</label><input class="form-control mb-2" name="flightNumber" id="recNumber" placeholder="TK6672 or TK1972D" maxlength="10">'+
   '<label class="form-label" for="recStd">STD London local (optional · TBC)</label><input type="time" class="form-control mb-2" name="std" id="recStd">'+
   '<label class="form-label" for="recKind">Departure flight type</label><select class="form-select mb-2" name="flightType" id="recKind"><option value="PASSENGER">Passenger</option><option value="CARGO">Cargo</option><option value="FERRY">Ferry</option><option value="OTHER">Other</option></select>'+
   '<label class="form-label" for="recDestination">Destination (optional)</label><input class="form-control mb-2" name="destination" id="recDestination" maxlength="12" placeholder="IST">'+
   '<label class="form-label" for="recOccurrence">Repeated time when clocks go back</label><select class="form-select" name="occurrence" id="recOccurrence"><option value="reject">Ask if ambiguous</option><option value="earlier">First occurrence (BST)</option><option value="later">Second occurrence (GMT)</option></select>');
  $('recDate').value=old?.operatingDate||($('flightDate')?.value||OperationalTime.operatingDate());
  $('recNumber').value=old?.departureFlight||'';
  $('recStd').value=old?.departure?.std||'';
  $('recKind').value=old?.departure?.flightType||'PASSENGER';
  $('recDestination').value=old?.destination||stay.source?.destination||'';
 }
 function openDetails(stay){
  if(!canManage||stay.status==='CLOSED')return;
  mode='details';current=stay;
  formContents('Update Ground Stay · '+stay.registration,
   reasonField+
   '<label class="form-label" for="aogNotes">Operational notes</label><textarea name="notes" id="aogNotes" class="form-control mb-3" rows="3" maxlength="600"></textarea>'+
   '<label class="form-label" for="aogExpected">Expected release (London; blank = TBC)</label><input type="datetime-local" id="aogExpected" class="form-control mb-2" name="expectedReleaseLocal">'+
   '<label class="form-label" for="aogOccurrence">Repeated time when clocks go back</label><select id="aogOccurrence" class="form-select" name="occurrence"><option value="reject">Ask if ambiguous</option><option value="earlier">First occurrence (BST)</option><option value="later">Second occurrence (GMT)</option></select>');
  $('aogReason').value=stay.reason;$('aogNotes').value=stay.notes||'';$('aogExpected').value=asLocal(stay.expectedReleaseAt);
 }
 function openClose(stay){
  if(!canManage||stay.status==='CLOSED'||stay.recoveryTurnaroundId)return;
  mode='close';current=stay;
  formContents('Close Ground Stay (no linked recovery)',
   '<p class="small text-danger">Only close this record if the aircraft has left or this AOG entry must be closed for a documented reason.</p>'+
   '<label class="form-label" for="aogCloseReason">Closure reason</label><textarea id="aogCloseReason" name="reason" class="form-control" required minlength="8" maxlength="300" rows="3"></textarea>');
 }
 const form=$('groundStayForm');
 form.addEventListener('submit',async event=>{
  event.preventDefault();
  const payload=Object.fromEntries(new FormData(form).entries());
  $('groundStaySubmit').disabled=true;$('groundStayFormError').textContent='';
  try{
   if(mode==='ground'){
    if(!confirm('Cancel the original departure and mark this aircraft GROUNDED? The arrival and regular schedule will remain unchanged.')){$('groundStaySubmit').disabled=false;return;}
    await api('/','POST',{...payload,sourceFlightId:current._id||current.id});
   }else if(mode==='recovery')await api('/'+current._id+'/recovery','PUT',payload);
   else if(mode==='details')await api('/'+current._id+'/details','PUT',payload);
   else if(mode==='close'){
    if(!confirm('Close this Ground Stay without a recovery departure?')){$('groundStaySubmit').disabled=false;return;}
    await api('/'+current._id+'/close','POST',payload);
   }
   modal.hide();await refresh();
   if(onFlights&&typeof loadFlights==='function')await loadFlights();
   if(onDashboard&&typeof loadFlight==='function')await loadFlight();
  }catch(error){$('groundStayFormError').textContent=error.message;$('groundStaySubmit').disabled=false;}
 });
 function showStay(stay){
  const wrapper=document.createElement('div');wrapper.className='border rounded p-3 mb-2';
  const top=document.createElement('div');top.className='d-flex flex-wrap gap-2 align-items-center mb-2';
  top.append(small(stay.registration+' · '+(stay.aircraftType||'Aircraft'),'fw-bold'));
  const badge=document.createElement('span');badge.className='badge '+(stay.status==='CLOSED'?'bg-secondary':stay.recovery?'bg-info text-dark':'bg-danger');
  badge.textContent=stay.status==='CLOSED'?'CLOSED':stay.recovery?'RECOVERY PLANNED':'GROUNDED';top.append(badge);wrapper.append(top);
  wrapper.append(small('Arrival '+(stay.arrivalFlight||'—')+' · '+stay.originalOperatingDate+
    '  |  Original departure '+(stay.originalDepartureFlight||'—')+' CANCELLED'));
  wrapper.append(small('Grounded since '+local(stay.groundedAt)+' · Reason: '+stay.reason+
    ' · Expected release: '+local(stay.expectedReleaseAt)));
  if(stay.notes)wrapper.append(small('Notes: '+stay.notes));
  if(stay.recovery)wrapper.append(small('Recovery '+(stay.recovery.departureFlight||'TBC')+' · '+
    stay.recovery.operatingDate+' · STD '+(stay.recovery.departure?.std||'TBC')+' · '+stay.recovery.status,'small fw-semibold mt-1'));
  else wrapper.append(small('Recovery flight: TBC','small fw-semibold text-warning mt-1'));
  const actions=document.createElement('div');actions.className='d-flex flex-wrap gap-2 mt-2';
  if(stay.source)actions.append(linkFlight(stay.source,'Original arrival'));
  if(stay.recovery)actions.append(linkFlight(stay.recovery,'Recovery flight'));
  if(canManage&&stay.status!=='CLOSED'){
   actions.append(button(stay.recovery?'Edit recovery':'Create recovery', 'btn-outline-primary',()=>openRecovery(stay)));
   actions.append(button('Update AOG', 'btn-outline-secondary',()=>openDetails(stay)));
   if(!stay.recovery)actions.append(button('Close without recovery','btn-outline-danger',()=>openClose(stay)));
  }
  wrapper.append(actions);
  const history=stay.history||[];
  if(history.length){
   const details=document.createElement('details');details.className='mt-2';
   const summary=document.createElement('summary');summary.className='small text-muted';summary.textContent='Aircraft history ('+history.length+')';
   details.append(summary);
   for(const record of history){
    details.append(small(local(record.at)+' · '+record.action+(record.by?' · '+record.by:'')+(record.details?' · '+record.details:'')));
   }
   wrapper.append(details);
  }
  return wrapper;
 }
 async function refresh(){
  const version=++requestId;
  try{
   const date=$('flightDate')?.value;
   const data=onFlights?await api('/?date='+encodeURIComponent(date||OperationalTime.operatingDate())):await api('/flight/'+encodeURIComponent(flightId));
   if(version!==requestId)return;
   canManage=!!data.permissions?.manage;state.canManage=canManage;
   contents.replaceChildren();
   const stays=onFlights?data.stays:(data.stay?[data.stay]:[]);
   if(onFlights){
    const info=small(stays.length+' aircraft ground-stay record(s) affecting this date · includes carry-over from previous days.','small text-muted mb-2');
    contents.append(info);
   }
   if(!stays.length){
    if(onFlights)contents.append(small('No aircraft recorded as grounded on this date.'));
    else{
     contents.append(small('No Ground Stay linked to this flight.'));
     if(canManage){
      const f=await fetch('/api/flights/'+encodeURIComponent(flightId),{headers:{Authorization:'Bearer '+token()},cache:'no-store'});
      if(f.ok){
       const flight=await f.json();
       if(flight&&!flight.isRecovery&&!['DEPARTED','PUSHBACK'].includes(flight.status)){
        contents.append(button('Ground Aircraft','btn-outline-danger mt-2',()=>openGroundForm(flight)));
       }
      }
     }
    }
   }else for(const stay of stays)contents.append(showStay(stay));
  }catch(error){if(version===requestId)contents.replaceChildren(small('Ground Stay unavailable: '+error.message,'small text-danger'));}
 }
 window.GroundStayUI={refresh,openGroundForm,get canManage(){return state.canManage;}};
 if(onFlights){
  $('flightDate')?.addEventListener('change',refresh);
 }
 if(typeof io==='function'){
  const socket=io();socket.on('groundStayUpdated',()=>{refresh();if(onFlights&&typeof loadFlights==='function')loadFlights();});
  window.addEventListener('pagehide',()=>socket.disconnect());
 }
 window.addEventListener('focus',()=>refresh());
 refresh().then(()=>{if(onFlights&&canManage&&typeof loadFlights==='function')loadFlights();});
})();
