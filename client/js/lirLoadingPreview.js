(() => {
 const $=id=>document.getElementById(id);
 const id=new URLSearchParams(location.search).get('id');
 const btn=$('loadPreviewBtn'),status=$('loadPreviewStatus'),rows=$('loadPreviewRows');
 if(!id||!btn)return;
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
  }catch(e){status.textContent=e.message;}finally{btn.disabled=false;}
 });
})();
