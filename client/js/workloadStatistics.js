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
 table.innerHTML='<table class="table table-sm table-hover align-middle"><thead><tr><th>Employee</th><th>Shift</th><th>Assignments</th><th>Overlaps</th><th>Flights / roles</th></tr></thead><tbody>'+staff.map(s=>'<tr><td>'+escapeWorkload(s.name)+'</td><td>'+escapeWorkload(s.shift?.status||'No roster record')+'</td><td>'+s.assignments.length+'</td><td>'+(s.overlaps?'<span class="badge bg-warning text-dark">'+s.overlaps+'</span>':'0')+'</td><td>'+s.assignments.map(a=>escapeWorkload(a.flight)+' ('+escapeWorkload(a.role)+')').join(', ')+'</td></tr>').join('')+'</tbody></table>';
 if(!staff.length)table.textContent='No staff roster or assignments found for this date.';
 }catch(e){table.textContent=e.message;summary.innerHTML=''}
}
document.getElementById('refresh').addEventListener('click',loadWorkload);
document.getElementById('date').addEventListener('change',loadWorkload);
loadWorkload();
