(function(){
  let editing=null,copyRows=[],copyBusy=false,shiftBusy=false,editRequest=0,copyRequest=0;
  const local=value=>value?OperationalTime.localInput(value).slice(0,16):'';
  function close(){editRequest++;copyRequest++;if(!shiftBusy)$('shiftEditor').close();if(!copyBusy)$('copyShiftDialog').close();editing=null;}
  function lane(start,end,items){
    const track=el('div','','timeline');
    for(const item of items){
      if(!item.interval || item.interval[1]<=start || item.interval[0]>=end)continue;
      const left=Math.max(start,item.interval[0]),right=Math.min(end,item.interval[1]);
      const bar=el(item.url?'a':'span',item.text,`timeline-bar ${item.kind||''}`);
      if(item.url)bar.href=item.url;
      bar.style.left=`${100*(left-start)/(end-start)}%`;bar.style.width=`${100*(right-left)/(end-start)}%`;
      bar.title=item.title||item.text;bar.setAttribute('aria-label',bar.title);track.append(bar);
    }
    return track;
  }
  function render(){
    const date=$('date').value;if(!AirlineQualifications.date(date))return;
    const shifts=data.shifts||[],start=+OperationalTime.fromLocal(date+'T00:00'),end=+OperationalTime.fromLocal(OperationalTime.addDays(date,1)+'T00:00');
    const selected=shifts.filter(s=>s.date===date),working=selected.filter(s=>s.status==='WORKING');
    $('rosterSummary').textContent=`${working.length} working · ${selected.filter(s=>s.status==='OFF').length} off · ${selected.filter(s=>s.status==='ABSENT').length} absent · ${data.staff.filter(u=>!selected.some(s=>String(s.userId)===String(u._id))).length} without a record for this date`;
    const table=el('table','','roster-table'),head=el('tr');head.append(el('th','Employee / shift'));
    const axisCell=el('th'),axis=el('div','','timeline timeline-axis');
    for(let at=start;at<end;at+=2*3600000){const label=el('span',time(new Date(at).toISOString()));label.style.left=`${100*(at-start)/(end-start)}%`;axis.append(label);}axisCell.append(axis);head.append(axisCell,el('th','Manage'));const thead=el('thead');thead.append(head);table.append(thead);
    const body=el('tbody'),department=$('rosterDepartment').value,search=$('rosterSearch').value.toLowerCase();
    for(const user of data.staff.filter(u=>(!department||u.department===department)&&String(u.name||'').toLowerCase().includes(search))){
      const rows=shifts.filter(s=>String(s.userId)===String(user._id)),own=rows.find(s=>s.date===date),row=el('tr'),identity=el('td');
      identity.append(el('strong',user.name),el('span',user.department||'','roster-status'));
      identity.append(el('span',own?(own.status==='WORKING'?`${time(own.start)} → ${time(own.end)}${OperationalTime.operatingDate(own.end)!==date?' (+1 day)':''}`:own.status):'No shift recorded','roster-status'));
      const previous=rows.find(s=>s.date<date&&s.status==='WORKING'&&Date.parse(s.end)>start);
      if(previous)identity.append(el('span',`Carry-over until ${time(previous.end)}`,'roster-status'));
      const chart=el('td'),items=[];
      for(const shift of rows.filter(s=>s.status==='WORKING')){
        items.push({interval:ShiftAvailability.interval(shift),text:`Shift ${time(shift.start)}–${time(shift.end)}`});
        for(const b of shift.breaks||[])items.push({interval:ShiftAvailability.interval(b),text:`Break ${time(b.start)}–${time(b.end)}`,kind:'break'});
      }
      chart.append(lane(start,end,items));
      for(const flight of data.flights.filter(f=>!ControlModel.closed(f)))for(const assignment of flight.assignments.filter(a=>String(a.userId?._id)===String(user._id))){
        const check=ShiftAvailability.check(user._id,flight,assignment.role,shifts,data.flights);
        chart.append(lane(start,end,[{interval:check.window,text:`${name(flight)} · ${labels[assignment.role]||assignment.role}`,kind:'task',url:`dashboard.html?id=${flight._id}`,title:`${name(flight)} · ${labels[assignment.role]||assignment.role} · ${check.warnings.join('; ')||'Covered by shift'}`}])) ;
        if(check.warnings.length)chart.append(el('small',`${name(flight)}: ${check.warnings.join('; ')}`,'availability-note text-danger'));
      }
      const manage=el('td');if(user.canManageShift){const button=el('button','Edit');button.onclick=()=>openShift(user,date);manage.append(button);}else manage.textContent='View only';
      row.append(identity,chart,manage);body.append(row);
    }
    table.append(body);$('roster').replaceChildren(table);
    if(edit){const current=data.flights.find(f=>String(f._id)===String(edit.flight._id));if(current)decorateAllocation(current);}
  }
  function decorateAllocation(flight){
    for(const select of $('assignmentFields').querySelectorAll('select')){
      for(const option of select.options){
        if(!option.value||option.disabled)continue;
        const user=data.staff.find(u=>String(u._id)===option.value);if(!user)continue;
        const check=ShiftAvailability.check(user._id,flight,select.dataset.role,data.shifts||[],data.flights);
        option.textContent=`${user.name} · ${check.available?'Available':check.warnings.join('; ')}`;
        option.hidden=$('availableOnly').checked&&!check.available&&option.value!==select.value;
      }
      let note=select.parentElement.querySelector('.availability-note');if(!note){note=el('small','','availability-note');select.parentElement.append(note);}
      const warnings=select.value?ShiftAvailability.check(select.value,flight,select.dataset.role,data.shifts||[],data.flights).warnings:[];
      note.textContent=warnings.join(' · ');note.className=`availability-note ${warnings.length?'text-danger':'text-muted'}`;
      select.onchange=()=>decorateAllocation(flight);
    }
  }
  function addBreak(value={}){
    const row=el('div','','shift-break');
    for(const field of ['start','end']){const label=el('label',`${field==='start'?'Start':'End'} · London`),input=el('input');input.type='datetime-local';input.dataset.field=field;input.value=value[field]?local(value[field]):'';input.required=true;label.append(input);row.append(label);}
    const remove=el('button','Remove break');remove.type='button';remove.onclick=()=>row.remove();row.append(remove);$('shiftBreaks').append(row);
  }
  async function openShift(user,date){
    const ticket=++editRequest;
    editing=null;$('shiftError').textContent='Loading latest shift…';$('shiftTitle').textContent=user.name;$('shiftDateLabel').textContent=`Roster date: ${date} · London`;$('saveShift').disabled=true;$('shiftEditor').showModal();
    try{
      const roster=await request(`/api/shifts?date=${date}`);if(!$('shiftEditor').open||ticket!==editRequest)return;
      const row=roster.shifts.find(s=>String(s.userId)===String(user._id)&&s.date===date);
      editing={user,date,revision:row?.revision||0,original:row};
      $('shiftStatus').value=row?.status||'WORKING';$('shiftStart').value=row?.start?local(row.start):`${date}T06:00`;$('shiftEnd').value=row?.end?local(row.end):`${date}T14:30`;
      $('shiftOccurrence').value='reject';$('shiftBreaks').replaceChildren();for(const b of row?.breaks||[])addBreak(b);
      $('shiftError').textContent=row?.updatedByName?`Last updated by ${row.updatedByName}`:'';setWorking();$('saveShift').disabled=false;
    }catch(error){$('shiftError').textContent=error.message;}
  }
  function setWorking(){const working=$('shiftStatus').value==='WORKING';$('shiftWorking').hidden=!working;for(const input of $('shiftWorking').querySelectorAll('input,select,button'))input.disabled=!working;$('shiftStart').required=working;$('shiftEnd').required=working;}
  $('shiftStatus').onchange=setWorking;$('addShiftBreak').onclick=()=>addBreak();$('closeShift').onclick=()=>{editRequest++;$('shiftEditor').close();};
  $('shiftEditor').addEventListener('cancel',event=>{if(shiftBusy)event.preventDefault();});
  $('shiftForm').onsubmit=async event=>{
    event.preventDefault();if(!editing||shiftBusy)return;
    shiftBusy=true;$('saveShift').disabled=true;$('closeShift').disabled=true;
    const body={date:editing.date,status:$('shiftStatus').value,start:$('shiftStart').value,end:$('shiftEnd').value,timeDisambiguation:$('shiftOccurrence').value,expectedRevision:editing.revision,breaks:[...$('shiftBreaks').children].map(row=>({start:row.querySelector('[data-field="start"]').value,end:row.querySelector('[data-field="end"]').value}))};
    try{await request(`/api/shifts/${editing.user._id}`,{method:'PUT',body:JSON.stringify(body)});$('shiftEditor').close();await refresh();}
    catch(error){$('shiftError').textContent=error.message;}
    finally{shiftBusy=false;$('saveShift').disabled=false;$('closeShift').disabled=false;}
  };
  $('copyShifts').onclick=async()=>{
    const ticket=++copyRequest;
    copyRows=[];$('copyShiftItems').replaceChildren();$('copyShiftResult').textContent='';$('copyShiftInfo').textContent='Loading preview…';$('applyCopyShifts').disabled=true;$('copyShiftDialog').showModal();
    try{
      const preview=await request('/api/shifts/copy-preview',{method:'POST',body:JSON.stringify({date:$('date').value})});if(!$('copyShiftDialog').open||ticket!==copyRequest)return;
      copyRows=preview.items;$('copyShiftInfo').textContent=`${preview.sourceDate} → ${preview.date}. Copies working shifts and breaks only. Existing target records are preserved.`;
      for(const [index,item]of copyRows.entries()){const label=el('label'),check=el('input');check.type='checkbox';check.checked=true;check.dataset.index=index;label.append(check,el('span',`${item.name}: ${item.input.start.replace('T',' ')} → ${item.input.end.replace('T',' ')} · ${item.input.breaks.length} breaks`));$('copyShiftItems').append(label);}
      for(const item of preview.skipped)$('copyShiftItems').append(el('p',`${item.name}: skipped — ${item.reason}`,'muted'));
      if(!copyRows.length)$('copyShiftResult').textContent='No working shifts available to copy.';$('applyCopyShifts').disabled=!copyRows.length;
    }catch(error){$('copyShiftResult').textContent=error.message;}
  };
  $('applyCopyShifts').onclick=async()=>{
    if(copyBusy)return;copyBusy=true;$('applyCopyShifts').disabled=true;$('closeCopyShifts').disabled=true;
    let saved=0;const failed=[];
    try{
      for(const checkbox of $('copyShiftItems').querySelectorAll('input:checked')){
        const item=copyRows[Number(checkbox.dataset.index)];
        try{await request(`/api/shifts/${item.userId}`,{method:'PUT',body:JSON.stringify(item.input)});saved++;checkbox.checked=false;checkbox.disabled=true;}
        catch(error){failed.push(`${item.name}: ${error.message}`);}
      }
      $('copyShiftResult').textContent=`${saved} shifts copied.${failed.length?' '+failed.join(' · '):''}`;await refresh();
    }finally{copyBusy=false;$('applyCopyShifts').disabled=false;$('closeCopyShifts').disabled=false;}
  };
  $('closeCopyShifts').onclick=()=>{copyRequest++;$('copyShiftDialog').close();};$('copyShiftDialog').addEventListener('cancel',event=>{if(copyBusy)event.preventDefault();});
  $('rosterDepartment').onchange=render;$('rosterSearch').oninput=render;$('availableOnly').onchange=()=>{if(edit)decorateAllocation(edit.flight);};
  window.ControlRoster={render,decorateAllocation,close};
})();
