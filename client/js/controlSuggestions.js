(function(){
 const button=document.getElementById('suggestAllocation');
 const dialog=document.getElementById('suggestDialog');
 const output=document.getElementById('suggestResults');
 if(!button||!dialog||!output)return;
 document.getElementById('closeSuggestions').onclick=()=>dialog.close();
 button.onclick=()=>{
   output.replaceChildren();
   const roles=['ARRIVAL_DISPATCH','DISPATCH'].filter(r=>data.roles.includes(r));
   if(!roles.length){output.textContent='Dispatcher allocation access required.';dialog.showModal();return;}
   const flights=data.flights.filter(f=>!ControlModel.closed(f));
   const shifts=data.shifts||[];
   const pending=[];
   for(const flight of flights)for(const role of roles){
     if(flight.assignmentRoles&&!flight.assignmentRoles.includes(role))continue;
     if(flight.assignments.some(a=>a.role===role&&a.userId?.active!==false&&a.userId))continue;
     if(!ControlModel.windowFor(flight,role))continue;
     pending.push({flight,role,window:ControlModel.windowFor(flight,role)});
   }
   pending.sort((a,b)=>a.window[0]-b.window[0]);
   const provisional=new Map();
   const assignedMinutes=new Map();
   for(const flight of flights)for(const a of flight.assignments){
     const id=String(a.userId?._id||a.userId||'');
     const w=ControlModel.windowFor(flight,a.role);
     if(id&&w)assignedMinutes.set(id,(assignedMinutes.get(id)||0)+(w[1]-w[0])/60000);
   }
   const overlaps=ShiftAvailability.overlaps;
   for(const item of pending){
     const candidates=data.staff.filter(u=>AirlineQualifications.eligible(u,item.flight.airline,item.role,AirlineQualifications.flightDate(item.flight,item.role))).map(u=>{
       const id=String(u._id);
       const available=ShiftAvailability.check(id,item.flight,item.role,shifts,flights);
       const conflicts=(provisional.get(id)||[]).some(p=>String(p.flight._id)!==String(item.flight._id)&&overlaps(p.window,item.window));
       const paired=item.flight.assignments.some(a=>a.role!==(item.role)&&['DISPATCH','ARRIVAL_DISPATCH'].includes(a.role)&&String(a.userId?._id||a.userId)===id)||(provisional.get(id)||[]).some(p=>String(p.flight._id)===String(item.flight._id)&&p.role!==item.role);
       return {user:u,available:available.available&&!conflicts,paired,minutes:assignedMinutes.get(id)||0};
     }).filter(c=>c.available).sort((a,b)=>Number(b.paired)-Number(a.paired)||a.minutes-b.minutes||a.user.name.localeCompare(b.user.name));
     const best=candidates[0];
     const line=document.createElement('div');line.className='border-bottom py-2';
     const title=document.createElement('strong');title.textContent=(item.flight.arrivalFlight||'—')+' / '+(item.flight.departureFlight||'—')+' · '+item.role;
     const detail=document.createElement('p');detail.className='mb-1';
     detail.textContent=best?'Suggested: '+best.user.name+(best.paired?' · combined dispatch':'')+' · '+Math.round(best.minutes)+' estimated allocated min · '+Math.max(0,candidates.length-1)+' alternatives':'No eligible and available dispatcher found';
     line.append(title,detail);
     if(best){
       const review=document.createElement('button');review.type='button';review.textContent='Review in allocation editor';
       review.onclick=async()=>{dialog.close();await openEditor(item.flight);const select=[...document.querySelectorAll('#assignmentFields select')].find(s=>s.dataset.role===item.role);if(select&&[...select.options].some(o=>o.value===String(best.user._id)))select.value=String(best.user._id);};
       line.append(review);
       const id=String(best.user._id);
       provisional.set(id,[...(provisional.get(id)||[]),item]);
       assignedMinutes.set(id,(assignedMinutes.get(id)||0)+(item.window[1]-item.window[0])/60000);
     }
     output.append(line);
   }
   if(!pending.length)output.textContent='No unassigned dispatcher roles with valid flight times on this date.';
   dialog.showModal();
 };
})();