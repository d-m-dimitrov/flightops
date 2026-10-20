(()=>{
const byId=id=>document.getElementById(id);
const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
const val=k=>parts.find(x=>x.type===k).value;
const today=val('year')+'-'+val('month')+'-'+val('day');
byId('perfTo').value=today;
const prior=new Date(today+'T12:00:00Z');prior.setUTCDate(prior.getUTCDate()-29);
byId('perfFrom').value=prior.toISOString().slice(0,10);
const escape=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
async function run(){
 const error=byId('perfError');error.textContent='';error.className='';
 const params=new URLSearchParams({from:byId('perfFrom').value,to:byId('perfTo').value,airline:byId('perfAirline').value.trim().toUpperCase(),aircraft:byId('perfAircraft').value.trim().toUpperCase()});
 try{
 const response=await fetch('/api/statistics/turnround-performance?'+params,{headers:{Authorization:'Bearer '+localStorage.getItem('token')}});
 const data=await response.json();if(!response.ok)throw Error(data.error||'Unable to load performance data');
 byId('perfCards').innerHTML=card('Turnrounds',data.total,'Selected period')+card('Measured',data.complete,'On-blocks and pushback')+card('Over MGT',data.exceeded,'Only where MGT is known')+card('Missing times',data.missing,'Excluded from averages');
 byId('perfTable').innerHTML='<table class="table table-striped table-sm"><thead><tr><th>Airline</th><th>Turnrounds</th><th>Measured</th><th>Avg SGT</th><th>Avg actual</th><th>Over MGT</th><th>Missing</th></tr></thead><tbody>'+data.groups.map(g=>'<tr><td>'+escape(g.airline)+'</td><td>'+g.flights+'</td><td>'+g.completed+'</td><td>'+(g.avgScheduled??'—')+'</td><td>'+(g.avgActual??'—')+'</td><td>'+g.overMgt+'</td><td>'+g.missing+'</td></tr>').join('')+'</tbody></table>';
 byId('perfDefinition').textContent=data.definition+' Times shown in minutes. Only records with operating dates in the selected range are included.';
 }catch(e){error.className='alert alert-danger';error.textContent=e.message;byId('perfCards').innerHTML='';byId('perfTable').innerHTML=''}
}
byId('perfRefresh').addEventListener('click',run);
run();
})();