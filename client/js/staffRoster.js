checkAuth();
const $=id=>document.getElementById(id),token=localStorage.getItem('token');let state=null,edits=new Map();
$('month').value=OperationalTime.operatingDate().slice(0,7);
const identity=getCurrentUser();if(identity.role!=='ADMIN'){$('department').value=identity.department;$('department').disabled=true;}
async function api(path,options={}){if(localStorage.getItem('token')!==token)throw Error('Account changed; reload');const response=await fetch('/api/roster-planning'+path,{...options,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'}});const body=await response.json();if(!response.ok)throw Error(body.error||'Request failed');return body;}
function notify(message){$('message').textContent=message;}
const typeLabel={EARLY:'E',DAY:'D',LATE:'L',OFF:'OFF'};
function times(type){const ranges={EARLY:[270,360],DAY:[480,690],LATE:[720,900]},r=ranges[type]||[];const output=[];for(let i=r[0];i<=r[1];i+=30)output.push(String(Math.floor(i/60)).padStart(2,'0')+':'+String(i%60).padStart(2,'0'));return output;}
function select(values,value,onchange){const s=document.createElement('select');for(const [v,label]of values)s.add(new Option(label,v));s.value=value||'';s.onchange=onchange;return s;}
function draftCell(entry){const key=String(entry.userId)+'|'+entry.date;return edits.get(key)||{userId:String(entry.userId),date:entry.date,status:entry.status,startTime:entry.startTime};}
function draw(){
 const table=$('table');table.replaceChildren();if(!state)return;
 const head=document.createElement('thead'),tr=document.createElement('tr');for(const label of ['Employee / cycle',...state.days.map(d=>d.slice(-2))]){const th=document.createElement('th');th.textContent=label;tr.append(th);}head.append(tr);table.append(head);
 const body=document.createElement('tbody'),existing=new Map(state.shifts.map(s=>[String(s.userId)+'|'+s.date,s])),entries=new Map((state.draft?.entries||[]).map(e=>[String(e.userId)+'|'+e.date,e])),cycles=new Map(state.cycles.map(c=>[String(c.userId),c]));
 for(const user of state.staff){const row=document.createElement('tr'),name=document.createElement('td');const title=document.createElement('strong');title.textContent=user.name;name.append(title,document.createElement('br'));
 const cycle=cycles.get(String(user._id));const pattern=select([['','Choose cycle'],['EELL00','2 Early / 2 Late / 2 Off'],['LLLL00','4 Late / 2 Off']],cycle?.pattern||'',async()=>saveCycle());const start=document.createElement('input');start.type='date';start.value=cycle?.startDate||'';start.onchange=()=>saveCycle();name.append(pattern,start);
 async function saveCycle(){if(!pattern.value||!start.value)return;try{await api('/cycle/'+user._id,{method:'PUT',body:JSON.stringify({pattern:pattern.value,startDate:start.value})});notify('Cycle saved. Regenerate a new month to apply it; existing draft is unchanged.');}catch(error){notify(error.message);}}
 row.append(name);
 for(const day of state.days){const cell=document.createElement('td'),key=String(user._id)+'|'+day,shift=existing.get(key),entry=entries.get(key);
 if(shift){cell.className=shift.status==='ABSENT'?'absent':'existing';cell.textContent=shift.status==='WORKING'?'✓ '+OperationalTime.localInput(shift.start).slice(11,16):shift.status;cell.title='Existing shift or absence — preserved';}
 else if(entry){const current=draftCell(entry);if(current.status==='OFF')cell.className='off';const check=document.createElement('input');check.type='checkbox';check.className='bulk-check';check.dataset.key=key;check.style.width='15px';cell.append(check);
 const type=select([['EARLY','Early'],['DAY','Day'],['LATE','Late'],['OFF','Off']],current.status,()=>{const updated={...current,status:type.value,startTime:null};edits.set(key,updated);draw();});
 const startTime=select([['','—'],...times(current.status).map(t=>[t,t])],current.startTime||'',()=>{edits.set(key,{...current,startTime:startTime.value||null});});
 startTime.disabled=current.status==='OFF';cell.append(type,startTime);
 }else{cell.textContent='—';}
 row.append(cell);}body.append(row);}table.append(body);
 $('save').disabled=!state.draft||state.draft.status!=='DRAFT';$('publish').disabled=!state.draft||state.draft.status!=='DRAFT';$('generate').disabled=!!state.draft;
}
async function load(){try{state=await api('/?month='+$('month').value+'&department='+$('department').value);edits.clear();draw();notify(state.draft?'Draft: '+state.draft.status+' · revision '+state.draft.revision:'No draft for this month. Configure cycles, then generate.');}catch(error){notify(error.message);}}
$('load').onclick=load;$('month').onchange=load;$('department').onchange=load;
$('generate').onclick=async()=>{try{const r=await api('/draft',{method:'POST',body:JSON.stringify({month:$('month').value,department:$('department').value})});await load();notify('Draft generated. '+r.skipped.length+' staff without a cycle.');}catch(error){notify(error.message);}};
$('save').onclick=async()=>{if(!state?.draft)return;try{const r=await api('/draft',{method:'PUT',body:JSON.stringify({month:state.month,department:state.department,expectedRevision:state.draft.revision,edits:[...edits.values()]})});state.draft=r.draft;edits.clear();draw();notify('Draft saved.');}catch(error){notify(error.message);}};
$('publish').onclick=async()=>{if(!state?.draft)return;if(edits.size){notify('Save draft edits before publishing.');return;}if(!confirm('Publish completed roster shifts to Operations Control? Existing records will remain unchanged.'))return;try{const r=await api('/publish',{method:'POST',body:JSON.stringify({month:state.month,department:state.department,expectedRevision:state.draft.revision})});await load();notify(r.created+' shifts published. '+r.skipped.length+' existing records skipped.');}catch(error){notify(error.message);}};
function bulkOptions(){const type=$('bulkType').value;$('bulkStart').replaceChildren(new Option('No time change',''));for(const t of times(type))$('bulkStart').add(new Option(t,t));}
$('bulkType').onchange=bulkOptions;
$('bulk').onclick=()=>{if(!state?.draft)return;const type=$('bulkType').value,clock=$('bulkStart').value;for(const check of document.querySelectorAll('.bulk-check:checked')){const key=check.dataset.key,entry=state.draft.entries.find(e=>String(e.userId)+'|'+e.date===key);if(!entry)continue;const current=draftCell(entry),status=type||current.status,startTime=status==='OFF'?null:clock||((status===current.status)?current.startTime:null);edits.set(key,{...current,status,startTime});}draw();notify('Bulk edits prepared; click Save draft edits.');};
load();
