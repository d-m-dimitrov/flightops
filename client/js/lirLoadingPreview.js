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
  let changes=[],changeInfo={};try{changeInfo=await api('/checklist/changes');changes=changeInfo.changes||[];}catch(e){actions.append(span('⚠ Could not load change requests: '+e.message,'alert alert-danger d-block'));}
  const changeSection=document.createElement('div');changeSection.className='mb-3';
  const open=changes.filter(x=>['REQUESTED','AUTHORISED'].includes(x.status));
  changeSection.append(span('Loading change requests · '+open.length+' open · LIR v'+(changeInfo.latestRevision??data.revision),'fw-bold d-block mb-2'));if(!changes.length)changeSection.append(span('No loading change requests recorded for this LIR version.','small text-muted d-block mb-2'));if(changeInfo.otherRevisionCount)changeSection.append(span('⚠ '+changeInfo.otherRevisionCount+' request(s) belong to an earlier LIR revision and cannot be approved against the current plan.','alert alert-warning d-block'));
  for(const change of changes.slice(0,15)){
   const line=document.createElement('div');line.className='border rounded p-2 mb-2';
   line.style.backgroundColor=change.status==='REQUESTED'?'#fff4e5':change.status==='AUTHORISED'?'#e8f3ff':'#f8f9fa';
   line.append(span(change.action+' · '+change.from+(change.to?' → '+change.to:'')+(change.replacementUld?' · '+change.replacementUld:'')+' · '+change.status,'fw-semibold d-block'));
   const fromRow=c?.rows?.find(r=>r.position===change.from),toRow=c?.rows?.find(r=>r.position===change.to);
   const sourceUld=change.sourceUld||(fromRow?.actualUld||fromRow?.plannedUld||'Unknown');
   const destUld=change.destinationUld||(toRow?.actualUld||toRow?.plannedUld||'Empty');
   const details=change.action==='SWAP'
    ?change.from+' · '+sourceUld+'  ⇄  '+change.to+' · '+destUld
    :change.action==='MOVE'
    ?change.from+' · '+sourceUld+'  →  '+change.to+' · '+destUld
    :change.from+' · '+sourceUld+'  →  '+change.replacementUld;
   line.append(span(details,'fw-bold d-block my-1'));
   const affected=[fromRow,...(change.to?[toRow]:[])].filter(Boolean);
   if(affected.some(r=>r.dgStatus==='DG_PRESENT')){
    const warning=span('⚠ DANGEROUS GOODS PRESENT — verify NOTOC and loading restrictions with Load Control before authorising.','fw-bold d-block p-2 my-1');
    warning.style.cssText='color:#b00020;background:white;border:3px solid #b00020;border-radius:4px';
    line.append(warning);
   }else if(affected.some(r=>!r.dgStatus||r.dgStatus==='UNKNOWN'))line.append(span('⚠ DG status unknown — verify before authorising.','text-warning fw-bold d-block'));
   line.append(span('Reason: '+change.reason+' · Requested by '+(change.requestedBy||'RAMP'),'small d-block mb-1'));
   const act=async(endpoint,body,button)=>{button.disabled=true;try{await api('/checklist/changes/'+change._id+'/'+endpoint,'POST',body);await showChecklist();}catch(e){status.textContent=e.message;button.disabled=false;}};
   if(change.status==='REQUESTED'&&data.permissions.publish){
    const note=span('Verify with Load Control / approved loading procedure before authorising.','small text-danger d-block');
    line.append(note);
    for(const decision of ['AUTHORISED','REJECTED']){
     const b=document.createElement('button');b.className='btn btn-sm '+(decision==='AUTHORISED'?'btn-outline-primary':'btn-outline-danger')+' me-2 mt-1';b.textContent=decision==='AUTHORISED'?'Mark authorised':'Reject';
     b.onclick=()=>{if(confirm('Confirm '+decision+'? Only mark authorised after required operational approval.'))act('review',{decision},b);};line.append(b);
    }
   }
   if(change.status==='AUTHORISED'&&data.permissions.confirm){
    const b=document.createElement('button');b.className='btn btn-sm btn-primary mt-1';b.textContent='Mark physically completed';
    b.onclick=()=>{if(confirm('Has this change physically been carried out? Positions will need reconfirmation.'))act('execute',{expectedVersion:c.version},b);};line.append(b);
   }
   changeSection.append(line);
  }
  actions.append(changeSection);
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
     const dg=document.createElement('input');dg.type='checkbox';dg.className='form-check-input';dg.checked=row.dgStatus==='DG_PRESENT';dg.setAttribute('aria-label','DG Present for '+row.position);
     const dgLabel=document.createElement('label');dgLabel.className='form-check d-flex align-items-center gap-2 my-2';
     dgLabel.append(dg,span('DG Present','fw-semibold'));
     const dgAlert=span('⚠ DG PRESENT','fw-bold d-block px-2 py-2 my-2 d-none');
     dgAlert.style.cssText='color:#b00020;background:#fff;border:3px solid #b00020;border-radius:4px';
     const paintDg=()=>{dgAlert.classList.toggle('d-none',!dg.checked);box.style.borderLeft=dg.checked?'5px solid #b00020':'';box.style.backgroundColor=dg.checked?'#fff7f7':'';};
     dg.addEventListener('change',paintDg);paintDg();
     box.append(uld,load,dgLabel,dgAlert,label);editor.append(box);inputs.push({position:row.position,uld,load,reviewed,dg});
    }
    actions.append(editor);
    const save=document.createElement('button');save.className='btn btn-primary me-2 mb-2';save.textContent='Save reviewed draft';
    save.onclick=async()=>{save.disabled=true;try{await api('/checklist/draft','PUT',{rows:inputs.map(x=>({position:x.position,plannedUld:x.uld.value,load:x.load.value,reviewed:x.reviewed.checked,dgStatus:x.dg.checked?'DG_PRESENT':'UNKNOWN'}))});status.textContent='Draft saved';await showChecklist();}catch(e){status.textContent=e.message;save.disabled=false;}};
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
   const dgStatus=row.dgStatus||'UNKNOWN';
   const dgBadge=span(dgStatus==='DG_PRESENT'?'⚠ DANGEROUS GOODS · DG PRESENT':dgStatus==='NO_DG'?'DG: NO DG (verified)':'DG: UNKNOWN / NOT VERIFIED','d-inline-block fw-bold px-2 py-1 my-1');
   if(dgStatus==='DG_PRESENT'){dgBadge.style.cssText='color:#b00020;background:#fff;border:3px solid #b00020;border-radius:4px;letter-spacing:.02em';box.style.borderLeft='5px solid #b00020';}
   else dgBadge.classList.add('small',dgStatus==='UNKNOWN'?'text-warning':'text-muted');
   box.append(dgBadge);
   const executedChange=changes.find(x=>x.status==='EXECUTED'&&(x.from===row.position||x.to===row.position));
   const pendingChange=changes.find(x=>['REQUESTED','AUTHORISED'].includes(x.status)&&(x.from===row.position||x.to===row.position));
   const needsRecheck=!row.confirmedAt&&!!executedChange;
   const badge=span(row.confirmedAt?(row.discrepancy?'⚠ Difference':'✓ Confirmed'):pendingChange?'⏳ Change pending':needsRecheck?'↻ RAMP reconfirmation required':'○ Pending','badge '+(row.confirmedAt?(row.discrepancy?'bg-warning text-dark':'bg-success'):pendingChange||needsRecheck?'bg-warning text-dark':'bg-secondary')+' my-1');
   box.append(badge);
   if(row.confirmedAt)box.append(span((row.actualUld||'')+' @ '+row.actualPosition+(row.bags!=null?' · '+row.bags+' bags':''),'small d-block'));
   if(data.permissions.confirm){
    const toggle=document.createElement('button');toggle.type='button';toggle.className='btn btn-sm btn-outline-secondary ms-2';toggle.textContent='⋮ Change';
    const form=document.createElement('div');form.className='border rounded p-2 mt-2 d-none';form.style.backgroundColor='#fff';
    const action=document.createElement('select');action.className='form-select my-1';for(const [value,label] of [['SWAP','Swap with position'],['MOVE','Move to empty position'],['REPLACE','Replace ULD']]){const o=document.createElement('option');o.value=value;o.textContent=label;action.append(o);}
    const target=document.createElement('select');target.className='form-select my-1';for(const other of c.rows.filter(x=>x.position!==row.position)){const o=document.createElement('option');o.value=other.position;o.textContent=other.position+' · '+(other.actualUld||other.plannedUld||'Empty');target.append(o);}
    const replacement=document.createElement('input');replacement.className='form-control my-1';replacement.placeholder='Replacement ULD (e.g. AKE12345TK)';replacement.maxLength=15;
    const reason=document.createElement('select');reason.className='form-select my-1';reason.required=true;reason.setAttribute('aria-label','Reason for loading change');
    const reasonChoices={
     SWAP:['ULDs loaded in reverse positions','Loading sequence change','Load Control instruction','Operational requirement','Other'],
     MOVE:['Position change requested by Load Control','Aircraft loading restriction','Position unavailable','Operational requirement','Other'],
     REPLACE:['Damaged ULD','Incorrect ULD number','ULD not available','Load Control instruction','Operational requirement','Other']
    };
    const otherReason=document.createElement('input');otherReason.className='form-control my-1 d-none';otherReason.placeholder='Specify reason';otherReason.maxLength=300;otherReason.setAttribute('aria-label','Other reason for loading change');
    const updateReasons=()=>{const selected=reason.value;reason.replaceChildren();for(const value of ['',...(reasonChoices[action.value]||[])]){const option=document.createElement('option');option.value=value;option.textContent=value||'Select reason…';reason.append(option);}if([...reason.options].some(x=>x.value===selected))reason.value=selected;otherReason.classList.toggle('d-none',reason.value!=='Other');};
    reason.onchange=()=>otherReason.classList.toggle('d-none',reason.value!=='Other');
    const updateFields=()=>{target.classList.toggle('d-none',action.value==='REPLACE');replacement.classList.toggle('d-none',action.value!=='REPLACE');};
    action.onchange=()=>{updateFields();updateReasons();};updateFields();updateReasons();
    const submit=document.createElement('button');submit.type='button';submit.className='btn btn-sm btn-warning mt-1';submit.textContent='Request OPS review';
    submit.onclick=async()=>{const why=(reason.value==='Other'?otherReason.value:reason.value).trim();if(!why){reason.classList.add('is-invalid');(reason.value==='Other'?otherReason:reason).focus();status.textContent='Select a reason (or specify Other) before submitting.';return;}reason.classList.remove('is-invalid');if(action.value!=='REPLACE'&&!target.value){status.textContent='Select a destination position.';target.focus();return;}if(action.value==='REPLACE'&&!replacement.value.trim()){status.textContent='Enter the replacement ULD number.';replacement.focus();return;}submit.disabled=true;try{const result=await api('/checklist/changes','POST',{action:action.value,from:row.position,to:target.value,replacementUld:replacement.value,reason:why});await showChecklist();status.textContent='✓ Loading change request saved: '+result.change.action+' '+result.change.from+' · '+result.change.status;}catch(e){status.textContent='⚠ Change request NOT saved: '+e.message;submit.disabled=false;}};
    form.append(action,target,replacement,reason,otherReason,submit);
    toggle.onclick=()=>form.classList.toggle('d-none');
    box.append(toggle,form);
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
    save.disabled=!!pendingChange;save.textContent=pendingChange?'Await change completion':needsRecheck?'Reconfirm position':'Confirm position';
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
   if(!data.supported){status.textContent=data.reason;await showChecklist();return;}
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
