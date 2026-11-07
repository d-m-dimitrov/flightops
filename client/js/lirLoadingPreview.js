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
  const title=document.createElement('p');title.className='fw-bold';title.textContent='Published · '+c.rows.filter(x=>x.confirmedAt).length+'/'+c.rows.length+' confirmed';actions.append(title);
  for(const row of c.rows){
   const box=document.createElement('div');box.className='border rounded p-2 mb-2';
   box.append(span(row.position+' · '+(row.plannedUld||'ULD required'),'fw-semibold d-block'));
   box.append(span(row.load.map(x=>x.type+'/'+x.value).join(' · '),'small d-block'));
   if(row.confirmedAt)box.append(span((row.discrepancy?'⚠ Difference · ':'✓ Confirmed · ')+(row.actualUld||'')+' @ '+row.actualPosition+(row.bags!=null?' · '+row.bags+' bags':''),'small d-block'));
   if(data.permissions.confirm){
    const pos=document.createElement('input');pos.className='form-control my-1';pos.value=row.actualPosition||row.position;pos.placeholder='Actual position';pos.setAttribute('aria-label','Actual position');
    const uld=document.createElement('input');uld.className='form-control my-1';uld.value=row.actualUld||row.plannedUld||'';uld.placeholder='Actual ULD number';uld.setAttribute('aria-label','Actual ULD number');
    const bags=document.createElement('input');bags.className='form-control my-1';bags.type='number';bags.min='0';bags.max='999';bags.placeholder='Bags (if baggage)';bags.value=row.bags??'';bags.setAttribute('aria-label','Actual bags');
    const save=document.createElement('button');save.className='btn btn-sm btn-success';save.textContent='Confirm position';
    save.onclick=async()=>{save.disabled=true;try{await api('/checklist/'+encodeURIComponent(row.position),'PUT',{actualPosition:pos.value,actualUld:uld.value,bags:bags.value===''?null:Number(bags.value),expectedVersion:c.version});await showChecklist();}catch(e){status.textContent=e.message;save.disabled=false;}};
    box.append(pos,uld,bags,save);
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
   status.textContent='TK text preview · LIR v'+data.revision+' · '+data.rows.length+' positions. Not confirmed or published to RAMP.';
   for(const row of data.rows){
    const card=document.createElement('div');card.className='border rounded p-2';
    const top=document.createElement('div');top.className='d-flex justify-content-between gap-2';
    top.append(span(row.position,'fw-bold'),span(row.plannedUld||'ULD number required','text-primary'));card.append(top);
    card.append(span(row.load.map(x=>x.type+'/'+x.value).join(' · ')||'Load details unavailable','small d-block'));
    if(row.needsReview||row.placeholder)card.append(span(row.placeholder?'Placeholder ULD — verify actual number':'Check against original LIR','badge bg-warning text-dark mt-1'));
    rows.append(card);
   }
   for(const warning of data.warnings||[])rows.append(span(warning,'text-danger small'));
   window.tkPreviewRows=data.rows;
   await showChecklist();
  }catch(e){status.textContent=e.message;}finally{btn.disabled=false;}
 });
 // Load the checklist immediately; RAMP should not need to discover a separate Read LIR action.
 setTimeout(()=>btn.click(),300);
})();
