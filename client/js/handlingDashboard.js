(() => {
 const panel=document.getElementById('handlingInstructionsPanel');
 const count=document.getElementById('handlingInstructionsCount');
 if(!panel||!count)return;
 let lastKey='',lastFetch=0,request=0;
 const flightKey=new URLSearchParams(location.search).get('id')||'';
 const user=(()=>{try{return JSON.parse(localStorage.getItem('user')||'{}')}catch{return {}}})();
 const prefix='handlingRead:v1:'+String(user._id||'guest')+':'+flightKey+':';
 const el=(tag,cls,text)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node;};
 function render(items){
  panel.replaceChildren();count.textContent=String(items.length);
  if(!items.length){panel.append(el('p','text-muted mb-0','No published handling instructions for your department and role.'));return;}
  for(const operation of ['ARRIVAL','TURNAROUND','DEPARTURE']){
   const group=items.filter(item=>item.operation===operation);
   if(!group.length)continue;
   panel.append(el('h6','mt-2 mb-3',operation));
   for(const item of group){
    const block=el('div','border rounded p-3 mb-2');
    const header=el('div','d-flex align-items-center gap-2 flex-wrap mb-2');
    const label=el('span','badge '+(item.type==='MANDATORY'?'text-bg-danger':item.type==='CHECKLIST'?'text-bg-warning':'text-bg-info'),item.type);
    header.append(label,el('strong','',item.title),el('small','text-muted',item.aircraftType+' · '+item.role));
    block.append(header);
    if(item.type==='CHECKLIST'){
     if(item.body)block.append(el('p','text-muted small mb-2',item.body));
     const steps=Array.isArray(item.steps)&&item.steps.length?item.steps:String(item.body||'').split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
     const progress=el('div','small text-muted mb-2');
     block.append(progress);
     let completed=0;
     steps.forEach((step,index)=>{
      const key=prefix+item._id+':'+item.revision+':step:'+index;
      const line=el('label','d-flex align-items-start gap-2 py-1');
      const checkbox=el('input','form-check-input mt-1');checkbox.type='checkbox';checkbox.checked=localStorage.getItem(key)==='yes';
      const text=el('span','',step);if(checkbox.checked)text.classList.add('text-decoration-line-through','text-muted');
      checkbox.addEventListener('change',()=>{
       if(checkbox.checked)localStorage.setItem(key,'yes');else localStorage.removeItem(key);
       text.classList.toggle('text-decoration-line-through',checkbox.checked);
       text.classList.toggle('text-muted',checkbox.checked);
       updateProgress();
      });
      line.append(checkbox,text);block.append(line);
     });
     function updateProgress(){completed=block.querySelectorAll('input[type=checkbox]:checked').length;progress.textContent=completed+' / '+steps.length+' tasks completed (saved on this browser only)';}
     updateProgress();
    }else{
     block.append(el('div','mb-2',item.body));
     const key=prefix+item._id+':'+item.revision;
     const line=el('label','d-flex gap-2 align-items-center small');
     const checkbox=el('input','form-check-input mt-0');checkbox.type='checkbox';checkbox.checked=localStorage.getItem(key)==='yes';
     checkbox.addEventListener('change',()=>{if(checkbox.checked)localStorage.setItem(key,'yes');else localStorage.removeItem(key);});
     line.append(checkbox,el('span','','Mark as read (this browser only)'));
     block.append(line);
    }
    panel.append(block);
   }
  }
 }
 async function refresh(){
  if(typeof currentFlight==='undefined'||!currentFlight)return;
  const airline=String(currentFlight.airline||'').toUpperCase();
  const aircraft=String(currentFlight.aircraft?.aircraftType||'').toUpperCase();
  if(!airline)return;
  const key=airline+':'+aircraft;
  if(key===lastKey&&Date.now()-lastFetch<60000)return;
  lastKey=key;lastFetch=Date.now();const id=++request;
  try{
   const response=await fetch('/api/handling-instructions/applicable?'+new URLSearchParams({airline,aircraftType:aircraft}),{headers:{Authorization:'Bearer '+(localStorage.getItem('token')||'')}});
   if(!response.ok)throw Error('Handling instructions unavailable ('+response.status+')');
   const items=await response.json();
   if(id!==request)return;
   render(items);
  }catch(error){if(id!==request)return;lastKey='';panel.replaceChildren(el('p','text-danger mb-0',error.message));}
 }
 refresh();setInterval(refresh,10000);
})();
