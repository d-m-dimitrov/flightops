/* Operations Control · Aircraft Ground Stay carry-over and shift handover. */
(() => {
 'use strict';
 const $=id=>document.getElementById(id);
 const host=$('aogShiftCases'),summary=$('aogShiftSummary'),dialog=$('aogShiftDialog');
 if(!host||!summary||!dialog)return;
 let cases=[],user=null,permissions={},activeCase=null,refreshBoard=null,busy=false;
 const text=(tag,value,cls)=>{
  const node=document.createElement(tag);node.textContent=value==null?'':String(value);
  if(cls)node.className=cls;return node;
 };
 const link=(label,id)=>{
  const a=text('a',label,'aog-link');a.href='dashboard.html?id='+encodeURIComponent(String(id));return a;
 };
 const dateTime=value=>value?new Date(value).toLocaleString('en-GB',{timeZone:'Europe/London',dateStyle:'short',timeStyle:'short'}):'TBC';
 const hoursOnGround=stay=>{
  const from=Date.parse(stay.groundedAt),to=stay.closedAt?Date.parse(stay.closedAt):Date.now();
  if(!Number.isFinite(from)||!Number.isFinite(to))return '—';
  const hours=Math.max(0,Math.floor((to-from)/3600000));
  return hours>=24?Math.floor(hours/24)+'d '+hours%24+'h':hours+'h';
 };
 const labelStatus=stay=>{
  if(stay.displayStatus==='RECOVERY_DEPARTED')return ['RECOVERY DEPARTED','aog-badge success'];
  if(stay.status==='CLOSED')return ['CLOSED','aog-badge neutral'];
  if(stay.status==='RECOVERY_PLANNED')return ['RECOVERY PLANNED','aog-badge planned'];
  return ['GROUNDED','aog-badge grounded'];
 };
 const button=(label,fn,cls='')=>{
  const b=text('button',label,cls||'aog-button');b.type='button';b.onclick=fn;return b;
 };
 const form=$('aogShiftForm'),notes=$('aogShiftNotes'),send=$('aogShiftSend');
 function api(url,method='GET',body){
  const token=localStorage.getItem('token');
  if(!token)return Promise.reject(Error('Please sign in again'));
  return fetch(url,{
   method,cache:'no-store',headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},
   body:body?JSON.stringify(body):undefined
  }).then(async response=>{
   const result=await response.json();
   if(!response.ok)throw Error(result.error||'Request failed');
   return result;
  });
 }
 function openHandover(stay){
  if(busy||!permissions.aogHandover||stay.status==='CLOSED')return;
  activeCase=stay;notes.value='';
  $('aogShiftTitle').textContent='Shift handover · '+stay.registration;
  $('aogShiftHelp').textContent='Aircraft '+(stay.aircraftType||'—')+' · '+(stay.arrivalFlight||'—')+
   ' / '+(stay.originalDepartureFlight||'—')+' · revision '+((stay.handoverSequence||0)+1)+
   '. This sends a new handover for the incoming Operations Duty Manager.';
  $('aogShiftError').textContent='';
  dialog.showModal();notes.focus();
 }
 $('aogShiftCancel').addEventListener('click',()=>dialog.close());
 form.addEventListener('submit',async event=>{
  event.preventDefault();
  if(busy||!activeCase||!permissions.aogHandover)return;
  const note=notes.value.trim();
  if(note.length<10){$('aogShiftError').textContent='Provide at least 10 characters describing the situation.';return;}
  busy=true;send.disabled=true;$('aogShiftError').textContent='';
  try{
   await api('/api/ground-stays/'+encodeURIComponent(activeCase._id)+'/shift-handovers','POST',{
    expectedSequence:activeCase.handoverSequence||0,notes:note
   });
   dialog.close();if(refreshBoard)await refreshBoard();
  }catch(error){$('aogShiftError').textContent=error.message;}
  finally{busy=false;send.disabled=false;}
 });
 async function receive(stay){
  const note=stay.latestHandover;
  if(busy||!note||!permissions.aogHandover)return;
  if(!confirm('Confirm you have read and received AOG handover v'+note.revision+' for '+stay.registration+'?'))return;
  busy=true;
  try{
   await api('/api/ground-stays/'+encodeURIComponent(stay._id)+'/shift-handovers/'+encodeURIComponent(note._id)+'/receive','POST',{});
   if(refreshBoard)await refreshBoard();
  }catch(error){alert(error.message);}
  finally{busy=false;}
 }
 async function showHistory(stay,container){
  container.replaceChildren(text('p','Loading previous handovers…','note'));
  try{
   const response=await api('/api/ground-stays/'+encodeURIComponent(stay._id)+'/shift-handovers');
   container.replaceChildren();
   if(!response.handovers.length){container.append(text('p','No shift handovers recorded.','note'));return;}
   for(const item of response.handovers){
    const box=text('div','','aog-history-entry');
    box.append(text('strong','v'+item.revision+' · '+(item.sentByName||'OPS')+' · '+dateTime(item.createdAt)));
    box.append(text('p',item.notes||''));
    for(const ack of item.receipts||[])box.append(text('p','✓ Received by '+ack.name+' · '+dateTime(ack.receivedAt),'note'));
    if(!item.receipts?.length)box.append(text('p','Awaiting incoming manager acknowledgment','note'));
    container.append(box);
   }
  }catch(error){container.replaceChildren(text('p',error.message,'aog-error'));}
 }
 function renderCase(stay){
  const card=text('article','','aog-case');
  const head=text('div','','aog-case-head'),titles=text('div');
  titles.append(text('strong',stay.registration+' · '+(stay.aircraftType||'Aircraft')));
  titles.append(text('p','Ground time '+hoursOnGround(stay)+' · '+(stay.reason||'OTHER')+' · Stand '+(stay.stand||'TBC'),'note'));
  const [label,cls]=labelStatus(stay);head.append(titles,text('span',label,cls));card.append(head);
  card.append(text('p','Arrival '+(stay.arrivalFlight||'—')+' · '+(stay.originalOperatingDate||'')+
   ' → Original departure '+(stay.originalDepartureFlight||'—')+' CANCELLED','aog-case-line'));
  card.append(text('p','Grounded since '+dateTime(stay.groundedAt)+' · Expected release '+dateTime(stay.expectedReleaseAt),'aog-case-line'));
  const dep=stay.recovery?
   'Recovery '+(stay.recovery.flightNumber||'TBC')+' · '+(stay.recovery.date||'')+
   ' · STD '+(stay.recovery.std||'TBC'):'Recovery flight: not yet planned';
  card.append(text('p',dep,'aog-case-line'));
  if(stay.notes)card.append(text('p','Operational notes: '+stay.notes,'aog-case-line'));
  const controls=text('div','','aog-controls');
  if(stay.sourceTurnaroundId)controls.append(link('Original flight',stay.sourceTurnaroundId));
  if(stay.recoveryTurnaroundId)controls.append(link('Recovery flight',stay.recoveryTurnaroundId));
  const handover=stay.latestHandover;
  const status=text('div','','aog-handover-status');
  if(handover){
   status.append(text('strong','Shift handover v'+handover.revision+' · '+(handover.sentByName||'OPS')+' · '+dateTime(handover.createdAt)));
   status.append(text('p',handover.notes||''));
   if(handover.receipts?.length){
    status.append(text('span','✓ Received by '+handover.receipts.map(x=>x.name).join(', '),'aog-badge success'));
   }else if(stay.status!=='CLOSED'){
    status.append(text('span','Awaiting incoming manager acknowledgment','aog-badge planned'));
   }
   const currentUser=String(user?.id||'');
   const hasAcknowledged=(handover.receipts||[]).some(r=>String(r.userId)===currentUser);
   if(permissions.aogHandover&&stay.status!=='CLOSED'&&
      String(handover.sentBy)!==currentUser&&!hasAcknowledged)
    controls.append(button('✓ Acknowledge handover',()=>receive(stay),'aog-button ack'));
  }else if(stay.status!=='CLOSED'){
   status.append(text('p','No shift handover prepared yet. Outstanding AOG case must be reviewed at shift change.','aog-badge planned'));
  }
  if(permissions.aogHandover&&stay.status!=='CLOSED')
   controls.append(button(handover?'Send updated handover':'Prepare shift handover',()=>openHandover(stay)));
  card.append(status);
  const more=button('View handover history',()=>{
   const d=card.querySelector('.aog-history');
   const hidden=d.hidden;d.hidden=!hidden;
   if(hidden)showHistory(stay,d);
  },'aog-button secondary');
  controls.append(more);
  card.append(controls);
  const history=text('div','','aog-history');history.hidden=true;card.append(history);
  return card;
 }
 window.ControlAog={
  render(nextCases,viewer,access,refresh){
   cases=Array.isArray(nextCases)?nextCases:[];
   user=viewer||null;permissions=access||{};refreshBoard=refresh;
   host.replaceChildren();
   const open=cases.filter(stay=>stay.status!=='CLOSED');
   const pending=open.filter(stay=>!stay.latestHandover||!(stay.latestHandover.receipts||[]).length);
   summary.textContent=open.length+' open · '+pending.length+' requiring shift handover attention';
   if(!cases.length){host.append(text('p','No aircraft on ground for this London date.','note'));return;}
   for(const stay of [...cases].sort((a,b)=>(a.status==='CLOSED')-(b.status==='CLOSED')||
    Date.parse(a.groundedAt)-Date.parse(b.groundedAt)))host.append(renderCase(stay));
  }
 };
})();
