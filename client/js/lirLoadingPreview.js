(() => {
 const $=id=>document.getElementById(id);
 const id=new URLSearchParams(location.search).get('id');
 const btn=$('loadPreviewBtn'),status=$('loadPreviewStatus'),rows=$('loadPreviewRows');
 if(!id||!btn)return;
 const actions=document.createElement('div');actions.className='mt-3';rows.after(actions);
 const isBulkRow=row=>row?.uldType==='BULK'||row?.position==='BULK';
 const api=async(path,method='GET',body)=>{
  const response=await fetch('/api/lir/'+encodeURIComponent(id)+path,{method,headers:{Authorization:'Bearer '+localStorage.getItem('token'),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,cache:'no-store'});
  const data=await response.json();if(!response.ok)throw Error(data.error||'Request failed');return data;
 };
 async function showChecklist(){
  const data=await api('/checklist');actions.replaceChildren();
  const c=data.checklist;
  const bulkRules=data.bulkRules||{aircraftType:'',positions:['51','52','53'],known:false};
  const validBulk=bulkRules.positions;
  if(!bulkRules.known)actions.append(span('⚠ Aircraft type '+(bulkRules.aircraftType||'not set')+' — BULK position limits could not be determined. Verify the loading plan and aircraft configuration before confirming.','alert alert-warning d-block'));
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
    const bulkCategories=[
     ['BAGGAGE','Baggage'],['CREW_BAGS','Crew bags'],['MAIL','Mail'],['CARGO','Cargo'],
     ['BLANKETS','Blankets'],['EQUIPMENT','Equipment'],['OTHER','Other']
    ];
    const bulkItemsEditor=(box,row={})=>{
     box.append(span('Contents of this BULK position','fw-semibold d-block mt-2'));
     const list=document.createElement('div');list.className='d-grid gap-2 mb-2';box.append(list);
     const refs=[];
     const add=document.createElement('button');add.type='button';add.className='btn btn-sm btn-outline-primary mb-2';add.textContent='+ Add load item';
     const update=()=>{add.disabled=refs.length>=30;};
     const makeItem=(data={})=>{
      if(refs.length>=30)return;
      const wrap=document.createElement('div');wrap.className='border rounded p-2';
      const group=document.createElement('div');group.className='d-flex flex-wrap gap-2 align-items-center';
      const kind=document.createElement('select');kind.className='form-select flex-grow-1';kind.style.minWidth='135px';kind.style.width='auto';kind.setAttribute('aria-label','BULK load category');
      for(const [value,title] of bulkCategories){const option=document.createElement('option');option.value=value;option.textContent=title;kind.append(option);}
      kind.value=bulkCategories.some(([value])=>value===data.type)?data.type:'OTHER';
      const pieces=document.createElement('input');pieces.className='form-control';pieces.style.width='110px';pieces.type='number';pieces.min='0';pieces.max='9999';pieces.step='1';pieces.placeholder='Pcs (opt.)';pieces.value=data.pieces??'';pieces.setAttribute('aria-label','Pieces, optional');
      const remove=document.createElement('button');remove.type='button';remove.className='btn btn-sm btn-outline-danger';remove.textContent='Remove';
      group.append(kind,pieces,remove);
      const details=document.createElement('input');details.className='form-control mt-2';details.maxLength=120;details.value=data.details||'';
      details.setAttribute('aria-label','Item details');
      const updatePlaceholder=()=>{details.placeholder=kind.value==='OTHER'?'Describe item (required)':'Details, if needed (optional)';};
      kind.addEventListener('change',updatePlaceholder);updatePlaceholder();
      wrap.append(group,details);list.append(wrap);
      const item={kind,pieces,details};
      refs.push(item);
      remove.addEventListener('click',()=>{refs.splice(refs.indexOf(item),1);wrap.remove();update();});
      update();
     };
     const previous=Array.isArray(row.bulkItems)&&row.bulkItems.length
      ?row.bulkItems
      :[['bulkBaggage','BAGGAGE'],['bulkMail','MAIL'],['bulkCargo','CARGO']]
       .filter(([field])=>row[field]!=null).map(([field,type])=>({type,pieces:row[field],details:''}));
     for(const item of previous)makeItem(item);
     add.addEventListener('click',()=>makeItem({type:'BAGGAGE',pieces:null,details:''}));
     box.append(add);
     return ()=>refs.map(x=>({type:x.kind.value,pieces:x.pieces.value===''?null:Number(x.pieces.value),details:x.details.value.trim()}));
    };
    const bulkPositionSelect=(box,selected='')=>{
     const label=document.createElement('label');label.className='small fw-semibold d-block mb-1';label.textContent='BULK loading position';
     const select=document.createElement('select');select.className='form-select mb-2';select.setAttribute('aria-label','BULK position');
     for(const value of ['',...validBulk]){
      const option=document.createElement('option');option.value=value;option.textContent=value||'Select BULK position';select.append(option);
     }
     select.value=validBulk.includes(selected)?selected:'';
     box.append(label,select);return select;
    };
    for(const row of draft){
     const box=document.createElement('div');box.className='border rounded p-2 mb-2';
     const isBulk=isBulkRow(row);
     box.append(span(isBulk?'BULK · '+(['51','52','53'].includes(row.position)?row.position:'Choose position'):'Position '+row.position,'fw-bold d-block'));
     const positionSelect=isBulk?bulkPositionSelect(box,row.position):null;
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
     box.append(...(isBulk?[]:[uld]),load);
     const bulk=isBulk?{bulkItems:bulkItemsEditor(box,row)}:{};
     box.append(dgLabel,dgAlert,label);editor.append(box);inputs.push({position:row.position,positionSelect,isBulk,uld,load,reviewed,dg,...bulk});
    }
    actions.append(editor);
    const addBulk=document.createElement('button');addBulk.type='button';addBulk.className='btn btn-outline-secondary mb-2';addBulk.textContent='+ Add BULK position (51 / 52 / 53)';
    const updateAddBulk=()=>{
     const used=new Set(inputs.map(x=>x.positionSelect?.value||x.position).filter(Boolean));
     addBulk.disabled=!validBulk.some(p=>!used.has(p))||inputs.filter(x=>x.isBulk).length>=validBulk.length;
     addBulk.textContent=addBulk.disabled?'All available BULK positions added':'+ Add BULK position ('+validBulk.join(' / ')+')';
    };
    addBulk.onclick=()=>{
     const used=new Set(inputs.map(x=>x.positionSelect?.value||x.position));
     const available=validBulk.filter(x=>!used.has(x));
     if(!available.length){status.textContent='No unused BULK positions for this aircraft.';return;}
     const box=document.createElement('div');box.className='border rounded p-2 mb-2';
     box.append(span('BULK · Loose-loaded items (no ULD)','fw-bold d-block'));
     const positionSelect=bulkPositionSelect(box,available[0]);positionSelect.addEventListener('change',updateAddBulk);
     const load=document.createElement('input');load.className='form-control my-1';load.placeholder='BULK load / pieces';
     const dg=document.createElement('input');dg.type='checkbox';dg.className='form-check-input';
     const dgLabel=document.createElement('label');dgLabel.className='form-check d-flex gap-2 align-items-center';dgLabel.append(dg,span('DG Present'));
     const reviewed=document.createElement('input');reviewed.type='checkbox';reviewed.className='form-check-input';
     const reviewLabel=document.createElement('label');reviewLabel.className='form-check d-flex gap-2 align-items-center';reviewLabel.append(reviewed,span('Checked against original LIR'));
     box.append(load);const bulk={bulkItems:bulkItemsEditor(box,{})};box.append(dgLabel,reviewLabel);editor.append(box);
     inputs.push({position:available[0],positionSelect,isBulk:true,uld:{value:''},load,reviewed,dg,...bulk});
     updateAddBulk();
    };actions.append(addBulk);updateAddBulk();
    const reviewAll=document.createElement('button');reviewAll.type='button';reviewAll.className='btn btn-outline-success me-2 mb-2';reviewAll.textContent='✓ Mark all positions reviewed';
    reviewAll.onclick=()=>{for(const x of inputs)x.reviewed.checked=true;status.textContent='All positions marked reviewed. Save reviewed draft to persist.';};
    actions.append(reviewAll);
    const save=document.createElement('button');save.className='btn btn-primary me-2 mb-2';save.textContent='Save reviewed draft';
    save.onclick=async()=>{
     const bulkInputs=inputs.filter(x=>x.isBulk);
     const positions=bulkInputs.map(x=>x.positionSelect?.value||'');
     if(positions.some(p=>!validBulk.includes(p))||new Set(positions).size!==positions.length){
      status.textContent='Choose unique BULK positions allowed for this aircraft: '+validBulk.join(', ')+'.';return;
     }
     save.disabled=true;
     try{
      const payload=inputs.map(x=>({position:x.isBulk?x.positionSelect.value:x.position,plannedUld:x.isBulk?'':x.uld.value,load:x.load.value,
       reviewed:x.reviewed.checked,dgStatus:x.dg.checked?'DG_PRESENT':'UNKNOWN',
       ...(x.isBulk?{bulkItems:x.bulkItems()}:{})}));
      await api('/checklist/draft','PUT',{rows:payload});status.textContent='Draft saved';await showChecklist();
     }catch(e){status.textContent=e.message;save.disabled=false;}
    };
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
  const labelBulkItem=item=>{
   const labels={BAGGAGE:'Baggage',CREW_BAGS:'Crew bags',MAIL:'Mail',CARGO:'Cargo',BLANKETS:'Blankets',EQUIPMENT:'Equipment',OTHER:'Other'};
   return (item.pieces==null?'':item.pieces+' pcs ')+(labels[item.type]||item.type)+(item.details?' · '+item.details:'');
  };
  const bulkItemsForDisplay=row=>{
   if(Array.isArray(row.bulkItems)&&row.bulkItems.length)return row.bulkItems;
   return [['bulkBaggage','BAGGAGE'],['bulkMail','MAIL'],['bulkCargo','CARGO']]
    .filter(([field])=>row[field]!=null).map(([field,type])=>({type,pieces:row[field],details:''}));
  };
  const suffixes=[...new Set(c.rows.map(x=>(x.plannedUld||'').match(/^[A-Z]{3}[A-Z0-9]{5,8}([A-Z]{2,3})$/)?.[1]).filter(Boolean))];
  const defaultSuffix=suffixes.length===1?suffixes[0]:'TK';
  for(const row of c.rows){
   const box=document.createElement('div');box.className='border rounded p-2 mb-2';
   const isBulk=isBulkRow(row);
   box.style.borderLeft='5px solid '+(row.discrepancy&&row.confirmedAt?'#fd7e14':row.confirmedAt?'#198754':'#adb5bd');
   box.style.backgroundColor=row.discrepancy&&row.confirmedAt?'#fff4e5':row.confirmedAt?'#eaf7ef':'#f8f9fa';
   box.append(span(isBulk?'BULK · '+(row.position==='BULK'?(row.actualPosition||'select BULK position'):row.position):row.position+' · '+(row.confirmedAt && row.actualUld ? row.actualUld : row.plannedUld||'ULD required'),'fw-semibold d-block'));

   if(isBulk){
    const contents=bulkItemsForDisplay(row);
    if(contents.length){
     const list=document.createElement('ul');list.className='mb-2 mt-2 ps-4';
     for(const item of contents){const li=document.createElement('li');li.textContent=labelBulkItem(item);list.append(li);}
     box.append(list);
    }
    const note=row.load.map(x=>x.value||'').filter(Boolean).join(' · ');
    if(note)box.append(span('Notes: '+note,'small d-block mb-1'));
   }else box.append(span(row.load.map(x=>x.type+'/'+x.value).join(' · '),'small d-block'));
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
   if(row.confirmedAt)box.append(span((isBulk?'BULK':row.actualUld||'')+' @ '+row.actualPosition+(row.bags!=null?' · '+row.bags+' bags':''),'small d-block'));
   if(data.permissions.confirm){
    const toggle=document.createElement('button');toggle.type='button';toggle.className='btn btn-sm btn-outline-secondary ms-2';toggle.textContent='⋮ Change';
    const form=document.createElement('div');form.className='border rounded p-2 mt-2 d-none';form.style.backgroundColor='#fff';
    const action=document.createElement('select');action.className='form-select my-1';for(const [value,label] of [['SWAP','Swap with position'],['MOVE','Move to empty position'],['REPLACE','Replace ULD']]){const o=document.createElement('option');o.value=value;o.textContent=label;action.append(o);}
    const target=document.createElement('select');target.className='form-select my-1';for(const other of c.rows.filter(x=>x.position!==row.position&&!isBulkRow(x))){const o=document.createElement('option');o.value=other.position;o.textContent=other.position+' · '+(other.actualUld||other.plannedUld||'Empty');target.append(o);}
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
    if(!isBulk)box.append(toggle,form);
    const pos=document.createElement(isBulk?'select':'input');pos.className='form-control my-1';
    if(isBulk){
     for(const value of ['',...validBulk]){
      const option=document.createElement('option');option.value=value;option.textContent=value||'Select BULK hold';pos.append(option);
     }
     pos.value=validBulk.includes(row.actualPosition)?row.actualPosition:validBulk.includes(row.position)?row.position:'';
    }else{pos.value=row.actualPosition||row.position;pos.placeholder='Actual position';}
    pos.setAttribute('aria-label','Actual position');
    // ULD number is entered in three parts; suggest prefix/suffix, never invent the serial.
    const known=row.actualUld||row.plannedUld||'';
    const match=known.match(/^([A-Z]{3})([A-Z0-9]{5,8})([A-Z]{2,3})$/);
    const group=document.createElement('div');group.className='input-group my-1';
    const prefix=document.createElement('input');prefix.className='form-control';prefix.style.maxWidth='85px';prefix.maxLength=3;prefix.value=match?.[1]||row.uldType||'AKE';prefix.setAttribute('aria-label','ULD prefix');prefix.setAttribute('list','uld-prefix-suggestions');
    const serial=document.createElement('input');serial.className='form-control';serial.inputMode='numeric';serial.placeholder='ULD serial';serial.maxLength=8;serial.value=match?.[2]&&!/^0+$/.test(match[2])?match[2]:'';serial.setAttribute('aria-label','ULD serial number');
    const suffix=document.createElement('input');suffix.className='form-control';suffix.style.maxWidth='78px';suffix.maxLength=3;suffix.value=match?.[3]||defaultSuffix;suffix.setAttribute('aria-label','ULD suffix');suffix.setAttribute('list','uld-suffix-suggestions');
    const prefixes=document.createElement('datalist');prefixes.id='uld-prefix-suggestions';for(const val of ['AKE','AKH','PMC','PAG','PLA']){const option=document.createElement('option');option.value=val;prefixes.append(option);}
    const suffixList=document.createElement('datalist');suffixList.id='uld-suffix-suggestions';for(const val of [...new Set([...suffixes,'TK'])]){const option=document.createElement('option');option.value=val;suffixList.append(option);}
    group.append(prefix,serial,suffix);if(!isBulk)box.append(group,prefixes,suffixList);
    const bags=document.createElement('input');bags.className='form-control my-1';bags.type='number';bags.min='0';bags.max='999';bags.placeholder='Bags (if baggage)';bags.value=row.bags??'';bags.setAttribute('aria-label','Actual bags');
    const save=document.createElement('button');save.className='btn btn-sm btn-success';save.textContent='Confirm position';
    save.disabled=!!pendingChange;save.textContent=pendingChange?'Await change completion':needsRecheck?'Reconfirm position':'Confirm position';
    save.onclick=async()=>{save.disabled=true;try{await api('/checklist/'+encodeURIComponent(row.position),'PUT',{actualPosition:pos.value,actualUld:isBulk?'':(prefix.value+serial.value+suffix.value).toUpperCase(),bags:bags.value===''?null:Number(bags.value),expectedVersion:c.version});await showChecklist();}catch(e){status.textContent=e.message;save.disabled=false;}};
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
