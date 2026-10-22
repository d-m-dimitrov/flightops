const escapeWorkload=value=>String(value??'').replace(/[&<>"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]));
async function loadWorkload(){
 const table=document.getElementById('workloadTable'),summary=document.getElementById('workloadSummary');
 if(!table)return;
 try{
 const date=document.getElementById('date').value;
 const response=await fetch('/api/statistics/workload?date='+encodeURIComponent(date),{headers:{Authorization:'Bearer '+localStorage.getItem('token')}});
 if(!response.ok)throw Error('Workload data unavailable ('+response.status+')');
 const data=await response.json(),staff=data.staff||[];
 const working=staff.filter(s=>s.shift?.status==='WORKING').length;
 const assigned=staff.filter(s=>s.assignments.length).length;
 const conflicts=staff.reduce((n,s)=>n+s.overlaps,0);
 summary.innerHTML=card('Working shifts',working,'Roster records')+card('Assigned staff',assigned,'With flight assignments')+card('Assignments',staff.reduce((n,s)=>n+s.assignments.length,0),'Roles allocated')+card('Potential overlaps',conflicts,'Estimated windows');
 document.getElementById('workloadMethod').textContent=data.method||'';
 const coverage=document.getElementById('workloadCoverage');
 if(coverage){
   const combined=data.combined||[],hourly=data.hourly||[];
   const peak=Math.max(1,...hourly.map(h=>Math.max(h.working,h.assigned,h.required)));
   coverage.innerHTML='<div class="row g-3 mb-3">'+
    '<div class="col-md-4">'+card('Combined turnarounds',combined.reduce((n,p)=>n+p.count,0),'Same dispatcher: arrival + departure')+'</div>'+
    '<div class="col-md-4">'+card('Dispatchers with combined duties',combined.length,'Unique staff')+'</div>'+
    '<div class="col-md-4">'+card('Peak assigned staff',Math.max(0,...hourly.map(h=>h.assigned)),'Distinct people in 15-minute slots')+'</div></div>'+
    '<h3 class="h6">Hourly staffing coverage (London time)</h3>'+
    '<p class="small text-muted">Working = peak rostered staff in each hour; assigned = peak distinct staff with an active assignment window; role demand = peak simultaneous role slots. These are separate indicators, not a verified minimum staffing requirement. Shift breaks are not deducted.</p>'+
    '<div class="table-responsive"><table class="table table-sm align-middle"><thead><tr><th>Hour</th><th>Working</th><th>Assigned</th><th>Role demand</th></tr></thead><tbody>'+
    hourly.map(h=>'<tr><td>'+String(h.hour).padStart(2,'0')+':00</td>'+
     [h.working,h.assigned,h.required].map((v,i)=>'<td style="min-width:90px"><div class="d-flex gap-2 align-items-center"><span class="small" style="width:22px">'+v+'</span><div class="progress flex-grow-1" style="height:12px"><div class="progress-bar '+['bg-primary','bg-success','bg-secondary'][i]+'" style="width:'+(v/peak*100)+'%"></div></div></div></td>').join('')+'</tr>').join('')+
    '</tbody></table></div>'+
    (combined.length?'<h3 class="h6">Combined dispatch by employee</h3><p>'+combined.map(p=>escapeWorkload(p.name)+' ('+p.count+')').join(', ')+'</p>':'');
 }

 const workloadLevel=s=>{
   if(s.overlaps>0)return {row:'table-danger',label:'Overlap',badge:'text-bg-danger'};
   if(s.shift?.status==='OFF'||s.shift?.status==='ABSENT')return {row:'table-secondary',label:s.shift.status==='OFF'?'Day off':'Absent',badge:'text-bg-secondary'};
   if(s.assignments.length>=4)return {row:'table-warning',label:'High workload',badge:'text-bg-warning'};
   if(s.assignments.length>0)return {row:'table-success',label:'Normal',badge:'text-bg-success'};
   if(s.shift?.status==='WORKING')return {row:'table-info',label:'Available',badge:'text-bg-primary'};
   return {row:'table-secondary',label:'No assignment',badge:'text-bg-secondary'};
 };
 table.innerHTML='<div class="d-flex flex-wrap gap-2 mb-3"><span class="badge text-bg-success">Normal</span><span class="badge text-bg-warning">High workload (4+)</span><span class="badge text-bg-danger">Overlap</span><span class="badge text-bg-primary">Available</span><span class="badge text-bg-secondary">Off / absent / unassigned</span></div>'+
 '<table class="table table-sm table-hover align-middle"><thead><tr><th>Employee</th><th>Shift</th><th>Load</th><th>Assignments</th><th>Overlaps</th><th>Flights / roles</th></tr></thead><tbody>'+
 staff.map(s=>{const level=workloadLevel(s);return '<tr class="'+level.row+'"><td class="fw-semibold">'+escapeWorkload(s.name)+'</td><td>'+escapeWorkload(s.shift?.status||'No roster record')+'</td><td><span class="badge '+level.badge+'">'+escapeWorkload(level.label)+'</span></td><td>'+s.assignments.length+'</td><td>'+(s.overlaps?'<span class="badge text-bg-danger">'+s.overlaps+'</span>':'0')+'</td><td>'+s.assignments.map(a=>escapeWorkload(a.flight)+' ('+escapeWorkload(a.role)+')').join(', ')+'</td></tr>'}).join('')+'</tbody></table>';
 if(!staff.length)table.textContent='No staff roster or assignments found for this date.';
 }catch(e){table.textContent=e.message;summary.innerHTML=''}
}
document.getElementById('refresh').addEventListener('click',loadWorkload);
document.getElementById('date').addEventListener('change',loadWorkload);
loadWorkload();
