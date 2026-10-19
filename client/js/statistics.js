checkAuth();
const date=document.getElementById('date');
const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
const part=k=>parts.find(p=>p.type===k)?.value;
date.value=part('year')+'-'+part('month')+'-'+part('day');
const esc=s=>String(s??'').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
function clock(v){if(!v)return null;const d=new Date(v);if(!Number.isFinite(d.getTime()))return null;return +new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',hour:'2-digit',hourCycle:'h23'}).format(d)}
function card(name,value,detail){return '<div class="col-6 col-lg-3"><div class="card h-100"><div class="card-body"><div class="small text-muted">'+name+'</div><div class="display-6">'+value+'</div><small>'+detail+'</small></div></div></div>'}
async function refresh(){
 const err=document.getElementById('error');err.textContent='';
 try{
 const response=await fetch('/api/flights?date='+encodeURIComponent(date.value),{headers:{Authorization:'Bearer '+localStorage.getItem('token')}});
 if(!response.ok)throw Error('Flight data unavailable: '+response.status);
 const flights=await response.json();
 if(!Array.isArray(flights))throw Error('Unexpected response');
 const airline=document.getElementById('airline').value.trim().toUpperCase();
 const counts={arrivals:0,departures:0,completedArrivals:0,completedDepartures:0,late:0,onTime:0,unknown:0,cancelled:0,delay:0};
 const hours=Array.from({length:24},(_,i)=>({hour:i,arr:0,dep:0}));
 const groups={};
 for(const f of flights){
 if(airline&&f.airline!==airline)continue;
 if(f.status==='CANCELLED'){counts.cancelled++;continue}
 const g=groups[f.airline||'OTHER']||={name:f.airline||'OTHER',arr:0,dep:0,late:0};
 if(f.arrivalToday){counts.arrivals++;g.arr++;const h=clock(f.arrival?.staAt);if(h!==null)hours[h].arr++;if(f.arrival?.ata||f.arrival?.onBlocks)counts.completedArrivals++}
 if(f.departureToday){
 counts.departures++;g.dep++;const h=clock(f.departure?.stdAt);if(h!==null)hours[h].dep++;
 const actual=f.departure?.atd||f.departure?.pushback;
 const a=actual?Date.parse(actual):NaN,s=f.departure?.stdAt?Date.parse(f.departure.stdAt):NaN;
 if(!Number.isFinite(a)||!Number.isFinite(s)){counts.unknown++;continue}
 counts.completedDepartures++;const delay=Math.max(0,(a-s)/60000);counts.delay+=delay;
 if(delay>15){counts.late++;g.late++}else counts.onTime++;
 }
 }
 document.getElementById('metrics').innerHTML=card('Arrivals',counts.arrivals,counts.completedArrivals+' completed')+card('Departures',counts.departures,counts.completedDepartures+' completed')+card('On-time departures',counts.completedDepartures?Math.round(100*counts.onTime/counts.completedDepartures)+'%':'—','STD + 15 minutes')+card('Delayed departures',counts.late,'More than 15 min')+card('Average delay',counts.completedDepartures?Math.round(counts.delay/counts.completedDepartures)+' min':'—','Completed departures')+card('Missing actual times',counts.unknown,'Not counted as completed')+card('Cancelled',counts.cancelled,'Excluded from movement totals');
 const max=Math.max(1,...hours.map(h=>h.arr+h.dep));
 document.getElementById('hours').innerHTML='<div class="small mb-2"><span class="text-primary">■</span> Arrivals &nbsp; <span class="text-success">■</span> Departures</div>'+hours.filter(h=>h.arr+h.dep).map(h=>'<div class="d-flex align-items-center gap-2 mb-2"><span style="width:30px">'+String(h.hour).padStart(2,'0')+'</span><div class="progress flex-grow-1" style="height:18px"><div class="progress-bar bg-primary" style="width:'+h.arr/max*100+'%">'+(h.arr||'')+'</div><div class="progress-bar bg-success" style="width:'+h.dep/max*100+'%">'+(h.dep||'')+'</div></div></div>').join('');
 document.getElementById('airlines').innerHTML='<table class="table table-striped"><thead><tr><th>Airline</th><th>Arrivals</th><th>Departures</th><th>Delayed</th></tr></thead><tbody>'+Object.values(groups).sort((a,b)=>b.dep-a.dep).map(g=>'<tr><td>'+esc(g.name)+'</td><td>'+g.arr+'</td><td>'+g.dep+'</td><td>'+g.late+'</td></tr>').join('')+'</tbody></table>';
 }catch(e){err.className='alert alert-danger';err.textContent=e.message}
}
document.getElementById('refresh').addEventListener('click',refresh);
date.addEventListener('change',refresh);
refresh();
