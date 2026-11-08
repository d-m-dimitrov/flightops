(() => {
 const $=id=>document.getElementById(id);
 const id=new URLSearchParams(location.search).get('id');
 const btn=$('loadPreviewBtn'),status=$('loadPreviewStatus'),rows=$('loadPreviewRows');
 if(!id||!btn)return;
 const actions=document.createElement('div');actions.className='mt-3';rows.after(actions);
 const api=async(path,method='GET',body)=>{
  const response=await fetch('/api/lir/'+encodeURIComponent(id)+path,{method,headers:{Authorization:'Bearer '+localStorage.getItem('token'),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,cache:'no-store'});
  const data=await response.json();if(!response.ok)throw Error(data.error||'Request failed');return data;
 };
 async function showChecklist(){
  const data=await api('/checklist');actions.replaceChildren();
  const c=data.checklist;
  if(!c?.published){
   if(data.permissions.publish){
    const draft=c?.rows||window.tkPreviewRows||[];
    const editor=document.createElement('div');editor.className='mb-3';
    const inputs=[];
    for(const row of draft){
     const box=document.createElement('div');box.className='border rounded p-2 mb-2';
     box.append(span('Position '+row.position,'fw-bold d-block'));
     const uld=document.createElement('input');uld.className='form-control my-1';uld.placeholder='Planned ULD (optional)';uld.value=row.plannedUld||'';
     const load=document.createElement('input');load.className='form-control my-1';load.placeholder='Planned load';load.value=row.load.map(x=>x.type==='REVIEWED'?x.value:x.type+'/'+x.value).join(' · ');
     const label=document.createElement('label');label.className='d-flex align-items-center gap-2';
     const reviewed=document.createElement('input');reviewed.type='checkbox';reviewed.checked=!!row.reviewed;label.append(reviewed,span('Checked against original LIR'));
     box.append(uld,load,label);editor.append(box);inputs.push({position:row.position,uld,load,reviewed});
    }
    actions.append(editor);
    const save=document.createElement('button');save.className='btn btn-primary me-2 mb-2';save.textContent='Save reviewed draft';
    save.onclick=async()=>{save.disabled=true;try{await api('/checklist/draft','PUT',{rows:inputs.map(x=>({position:x.position,plannedUld:x.uld.value,load:x.load.value,reviewed:x.reviewed.checked}))});status.textContent='Draft saved';await showChecklist();}catch(e){status.textContent=e.message;save.disabled=false;}};
    actions.append(save);
    if(c?.rows?.length){
     const publish=document.createElement('button');publish.className='btn btn-warning mb-2';publish.textContent='Publish to RAMP';publish.disabled=c.rows.some(x=>!x.reviewed);
     publish.onclick=async()=>{if(!confirm('Publish reviewed loading plan to RAMP?'))return;publish.disabled=true;try{await api('/checklist/publish','POST');await showChecklist();}catch(e){status.textContent=e.message;publish.disabled=false;}};
     actions.append(publish);
    }
   }else actions.append(span('Waiting for OPS to review and publish the loading checklist. RAMP cannot confirm an unpublished plan.','alert alert-warning d-block'));
   return;
  }
  if(!data.permissions.confirm){const note=document.createElement('p');note.className='alert alert-info';note.textContent='Read-only: '+(data.permissions.confirmReason||'Only the assigned Departure RAMP agent can confirm loading.')+'.';actions.append(note);}
  const count=c.rows.filter(x=>x.confirmedAt).length;
  const title=document.createElement('div');title.className='mb-3';
  title.append(span('Loading progress · '+count+'/'+c.rows.length+' confirmed','fw-bold d-block mb-2'));
  const progress=document.createElement('div');progress.className='progress';progress.style.height='9px';
  const bar=document.createElement('div');bar.className='progress-bar bg-success';bar.style.width=(c.rows.length?100*count/c.rows.length:0)+'%';progress.append(bar);title.append(progress);actions.append(title);
  const suffixes=[...new Set(c.rows.map(x=>(x.plannedUld||'').match(/^[A-Z]{3}[A-Z0-9]{5,8}([A-Z]{2,3})$/)?.[1]).filter(Boolean))];
  const defaultSuffix=suffixes.length===1?suffixes[0]:'TK';
  for(const row of c.rows){
   const box=document.createElement('div');box.className='border rounded p-2 mb-2';
   box.style.borderLeft='5px solid '+(row.discrepancy&&row.confirmedAt?'#fd7e14':row.confirmedAt?'#198754':'#adb5bd');
   box.style.backgroundColor=row.discrepancy&&row.confirmedAt?'#fff4e5':row.confirmedAt?'#eaf7ef':'#f8f9fa';
   box.append(span(row.position+' · '+(row.confirmedAt && row.actualUld ? row.actualUld : row.plannedUld||'ULD required'),'fw-semibold d-block'));
   box.append(span(row.load.map(x=>x.type+'/'+x.value).join(' · '),'small d-block'));
   const badge=span(row.confirmedAt?(row.discrepancy?'⚠ Difference':'✓ Confirmed'):'○ Pending','badge '+(row.confirmedAt?(row.discrepancy?'bg-warning text-dark':'bg-success'):'bg-secondary')+' my-1');
   box.append(badge);
   if(row.confirmedAt)box.append(span((row.actualUld||'')+' @ '+row.actualPosition+(row.bags!=null?' · '+row.bags+' bags':''),'small d-block'));
   if(data.permissions.confirm){
    const pos=document.createElement('input');pos.className='form-control my-1';pos.value=row.actualPosition||row.position;pos.placeholder='Actual position';pos.setAttribute('aria-label','Actual position');
    // ULD number is entered in three parts; suggest prefix/suffix, never invent the serial.
    const known=row.actualUld||row.plannedUld||'';
    const match=known.match(/^([A-Z]{3})([A-Z0-9]{5,8})([A-Z]{2,3})$/);
    const group=document.createElement('div');group.className='input-group my-1';
    const prefix=document.createElement('input');prefix.className='form-control';prefix.style.maxWidth='85px';prefix.maxLength=3;prefix.value=match?.[1]||row.uldType||'AKE';prefix.setAttribute('aria-label','ULD prefix');prefix.setAttribute('list','uld-prefix-suggestions');
    const serial=document.createElement('input');serial.className='form-control';serial.inputMode='numeric';serial.placeholder='ULD serial';serial.maxLength=8;serial.value=match?.[2]&&!/^0+$/.test(match[2])?match[2]:'';serial.setAttribute('aria-label','ULD serial number');
    const suffix=document.createElement('input');suffix.className='form-control';suffix.style.maxWidth='78px';suffix.maxLength=3;suffix.value=match?.[3]||defaultSuffix;suffix.setAttribute('aria-label','ULD suffix');suffix.setAttribute('list','uld-suffix-suggestions');
    const prefixes=document.createElement('datalist');prefixes.id='uld-prefix-suggestions';for(const val of ['AKE','AKH','PMC','PAG','PLA']){const option=document.createElement('option');option.value=val;prefixes.append(option);}
    const suffixList=document.createElement('datalist');suffixList.id='uld-suffix-suggestions';for(const val of [...new Set([...suffixes,'TK'])]){const option=document.createElement('option');option.value=val;suffixList.append(option);}
    group.append(prefix,serial,suffix);box.append(group,prefixes,suffixList);
    const bags=document.createElement('input');bags.className='form-control my-1';bags.type='number';bags.min='0';bags.max='999';bags.placeholder='Bags (if baggage)';bags.value=row.bags??'';bags.setAttribute('aria-label','Actual bags');
    const save=document.createElement('button');save.className='btn btn-sm btn-success';save.textContent='Confirm position';
    save.onclick=async()=>{save.disabled=true;try{await api('/checklist/'+encodeURIComponent(row.position),'PUT',{actualPosition:pos.value,actualUld:(prefix.value+serial.value+suffix.value).toUpperCase(),bags:bags.value===''?null:Number(bags.value),expectedVersion:c.version});await showChecklist();}catch(e){status.textContent=e.message;save.disabled=false;}};
    box.append(pos,bags,save);
   }
   actions.append(box);
  }
 }
 const span=(text,cls)=>{const e=document.createElement('span');e.className=cls||'';e.textContent=text;return e;};
 btn.addEventListener('click',async()=>{
  btn.disabled=true;rows.replaceChildren();status.textContent='Reading loading instructions…';
  try{
   const token=localStorage.getItem('token');
   const response=await fetch('/api/lir/'+encodeURIComponent(id)+'/loading-preview',{headers:{Authorization:'Bearer '+token},cache:'no-store'});
   const data=await response.json();if(!response.ok)throw Error(data.error||'Could not read LIR');
   if(!data.supported){status.textContent=data.reason;return;}
   status.textContent='TK LIR v'+data.revision+' · '+data.rows.length+' positions';
   // The extracted rows feed the editable draft or published confirmation list.
   // Do not render a second, read-only ULD list above the working checklist.
   rows.replaceChildren();
   for(const warning of data.warnings||[])rows.append(span(warning,'text-warning small'));
   window.tkPreviewRows=data.rows;
   await showChecklist();
  }catch(e){status.textContent=e.message;}finally{btn.disabled=false;}
 });
 // Keep OPS and RAMP in sync without overwriting an operator's active edits.
 if(typeof io==='function'){
  const live=io();
  let timer=null,pending=false;
  const banner=document.createElement('div');banner.className='alert alert-info py-2 d-none';banner.setAttribute('role','status');
  const refresh=document.createElement('button');refresh.type='button';refresh.className='btn btn-sm btn-outline-primary ms-2';refresh.textContent='Refresh now';
  banner.append(document.createTextNode('Loading checklist updated by another user.'),refresh);
  actions.before(banner);
  const editing=()=>actions.contains(document.activeElement)&&['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName);
  const refreshNow=async()=>{pending=false;banner.classList.add('d-none');btn.click();};
  refresh.addEventListener('click',refreshNow);
  live.on('connect',()=>live.emit('joinFlight',id));
  live.on('lirChecklistUpdated',()=>{
   clearTimeout(timer);
   timer=setTimeout(()=>{
    if(editing()){pending=true;banner.classList.remove('d-none');return;}
    refreshNow();
   },350);
  });
  live.on('lirUpdated',()=>{clearTimeout(timer);timer=setTimeout(()=>{if(editing()){pending=true;banner.classList.remove('d-none');}else refreshNow();},350);});
  window.addEventListener('beforeunload',()=>{clearTimeout(timer);live.disconnect();});
 }
 // Load the checklist immediately; RAMP should not need to discover a separate Read LIR action.
 setTimeout(()=>btn.click(),300);
})();
