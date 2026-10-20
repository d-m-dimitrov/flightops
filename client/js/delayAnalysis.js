(()=>{
const el=id=>document.getElementById(id);
el('delayFrom').value=el('perfFrom').value;
el('delayTo').value=el('perfTo').value;
const esc=v=>String(v??'').replace(/[&<>"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]));
const cell=v=>v===null||v===undefined?'—':esc(v);
async function run(){
 const error=el('delayError');error.className='';error.textContent='';
 const q=new URLSearchParams({from:el('delayFrom').value,to:el('delayTo').value,airline:el('delayAirline').value.trim().toUpperCase(),aircraft:el('delayAircraft').value.trim().toUpperCase()});
 try{
 const response=await fetch('/api/statistics/delay-analysis?'+q,{headers:{Authorization:'Bearer '+localStorage.getItem('token')}});
 const data=await response.json();if(!response.ok)throw Error(data.error||'Delay data unavailable');
 el('delayCards').innerHTML=card('Turnrounds',data.total,'In selected period')+card('Delayed departures',data.delayed,'Pushback > STD +15 min')+card('Late inbound',data.lateInbound,'Among delayed departures')+card('Missing pushback / STD',data.unknown,'Not classified');
 el('delayTable').innerHTML='<table class="table table-striped table-sm"><thead><tr><th>Date</th><th>Airline</th><th>Flight</th><th>Departure delay</th><th>Inbound delay</th><th>Est. inbound impact</th><th>Unattributed</th></tr></thead><tbody>'+data.rows.map(r=>'<tr><td>'+esc(r.date)+'</td><td>'+esc(r.airline)+'</td><td>'+esc(r.departureFlight)+'</td><td><span class="badge text-bg-danger">'+r.delay+' min</span></td><td>'+cell(r.inboundDelay)+'</td><td>'+cell(r.estimatedInboundContribution)+'</td><td>'+cell(r.unattributed)+'</td></tr>').join('')+'</tbody></table>';
 el('delayDefinition').textContent=data.definition+(data.truncated?' Only the 250 longest delays are shown.':'')+' All durations are minutes.';
 }catch(e){error.className='alert alert-danger';error.textContent=e.message;el('delayCards').innerHTML='';el('delayTable').innerHTML=''}
}
el('delayRefresh').addEventListener('click',run);
run();
})();