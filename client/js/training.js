checkAuth();
const id=new URLSearchParams(location.search).get('id');
const token=localStorage.getItem('token');
const headers={Authorization:'Bearer '+token,'Content-Type':'application/json'};
let revision=0,employees=[],record=null;
const $=id=>document.getElementById(id);
const roles=['DISPATCH','ARRIVAL_DISPATCH','CHECKIN','GATE','ARRIVAL','ARRIVAL_RAMP','RAMP','SPUR'];
const notify=(msg,bad=false)=>{const el=$('notice');el.hidden=false;el.className='alert '+(bad?'alert-danger':'alert-success');el.textContent=msg;};
async function api(url,options={}){const r=await fetch(url,{...options,headers});const data=await r.json().catch(()=>({}));if(!r.ok)throw Error(data.error||'Request failed');return data;}
function field(type,name,value='',placeholder=''){const input=document.createElement('input');input.type=type;input.className='form-control form-control-sm';input.dataset.field=name;input.value=value||'';input.placeholder=placeholder;return input;}
function cell(row,label,input){const wrap=document.createElement('label');wrap.className='col-md small';wrap.textContent=label;wrap.append(input);row.append(wrap);}
const mandatoryPresets={DGR:'Dangerous Goods Regulations',JETTY:'Jetty Training',ADP:'Airport Driving Permit',WB:'Weight and Balance Training'};
function trainingStatus(t){
 const today=new Date().toLocaleDateString('en-CA',{timeZone:'Europe/London'});
 if(!t.completedOn)return ['Not completed','text-bg-secondary'];
 if(!t.validUntil)return ['Expiry not recorded','text-bg-secondary'];
 if(t.validUntil<today)return ['Expired','text-bg-danger'];
 const days=Math.round((Date.parse(t.validUntil+'T00:00:00Z')-Date.parse(today+'T00:00:00Z'))/86400000);
 return days<=30?['Expiring in '+days+' days','text-bg-warning']:['Valid','text-bg-success'];
}
function addMandatory(t={}){
 const row=document.createElement('div');row.className='mandatory-row row g-2 mb-3 align-items-end';
 for(const [label,name,type,placeholder] of [['Code','code','text','DGR'],['Training','name','text','Dangerous Goods Regulations'],['Completed','completedOn','date',''],['Valid until','validUntil','date',''],['Evidence','evidence','text','Certificate / reference'],['Notes','notes','text','']]){
 const input=field(type,name,t[name],placeholder);
 if(name==='code')input.addEventListener('change',()=>{const code=input.value.trim().toUpperCase();input.value=code;const title=row.querySelector('[data-field="name"]');if(mandatoryPresets[code]&&!title.value.trim())title.value=mandatoryPresets[code];});
 cell(row,label,input);
 }
 const status=document.createElement('span');status.className='badge col-md-auto';
 const refresh=()=>{const value=Object.fromEntries([...row.querySelectorAll('[data-field]')].map(x=>[x.dataset.field,x.value]));const [label,css]=trainingStatus(value);status.className='badge col-md-auto '+css;status.textContent=label;};
 row.querySelector('[data-field="completedOn"]').addEventListener('change',refresh);
 row.querySelector('[data-field="validUntil"]').addEventListener('change',refresh);
 row.append(status);
 const btn=document.createElement('button');btn.type='button';btn.className='btn btn-outline-danger btn-sm col-md-auto';btn.textContent='Remove';btn.onclick=()=>row.remove();row.append(btn);$('mandatoryRows').append(row);refresh();
}
function addPreset(code){
 const existing=[...document.querySelectorAll('.mandatory-row [data-field="code"]')].some(el=>el.value.trim().toUpperCase()===code);
 if(existing){notify(code+' is already listed.',true);return;}
 addMandatory({code,name:mandatoryPresets[code]});
}
function addTrainer(t={}){const row=document.createElement('div');row.className='trainer-row row g-2 mb-3 align-items-end';cell(row,'Airline',field('text','airline',t.airline,'SQ'));const select=document.createElement('select');select.className='form-select form-select-sm';select.dataset.field='role';for(const role of roles)select.append(new Option(role,role));select.value=t.role||roles[0];cell(row,'Role',select);for(const name of ['canTrain','canCheck']){const input=document.createElement('input');input.type='checkbox';input.className='form-check-input d-block mt-2';input.dataset.field=name;input.checked=!!t[name];cell(row,name==='canTrain'?'Can Train':'Can Check',input);}cell(row,'Valid until',field('date','validUntil',t.validUntil));const btn=document.createElement('button');btn.className='btn btn-outline-danger btn-sm col-md-auto';btn.textContent='Remove';btn.onclick=()=>row.remove();row.append(btn);$('trainerRows').append(row);}
function values(selector){return [...document.querySelectorAll(selector)].map(row=>Object.fromEntries([...row.querySelectorAll('[data-field]')].map(input=>[input.dataset.field,input.type==='checkbox'?input.checked:input.value.trim()])));}
function render(){revision=record.trainingRevision||0;$('employeeName').textContent=record.name+' · '+record.department;$('mandatoryRows').replaceChildren();$('trainerRows').replaceChildren();(record.mandatoryTraining||[]).forEach(addMandatory);(record.lineTrainerQualifications||[]).forEach(addTrainer);const body=$('flightHistory');body.replaceChildren();for(const f of [...(record.trainingFlights||[])].reverse()){const tr=document.createElement('tr');const mentor=employees.find(e=>e._id===(f.trainer?._id||f.trainer));for(const v of [f.flightDate,f.flightNumber,f.airline+' / '+f.role,f.kind,mentor?.name||'—',f.outcome,f.notes||'']){const td=document.createElement('td');td.textContent=v;tr.append(td);}body.append(tr);}}
async function load(){record=await api('/api/training/'+encodeURIComponent(id));render();}
$('addMandatory').onclick=()=>addMandatory();
for(const code of Object.keys(mandatoryPresets)){const button=document.getElementById('preset'+code);if(button)button.onclick=()=>addPreset(code);}
$('addTrainer').onclick=()=>addTrainer();
$('saveTraining').onclick=async()=>{try{const mandatoryTraining=values('.mandatory-row').map(x=>({...x,code:x.code.toUpperCase()}));if(mandatoryTraining.some(t=>['JETTY','ADP'].includes(t.code)&&(!t.completedOn||!t.validUntil))){notify('Jetty Training and ADP require completion and expiry dates.',true);return;}
const lineTrainerQualifications=values('.trainer-row').map(x=>({...x,airline:x.airline.toUpperCase()}));await api('/api/training/'+encodeURIComponent(id),{method:'PUT',body:JSON.stringify({mandatoryTraining,lineTrainerQualifications,expectedRevision:revision})});await load();notify('Training saved.');}catch(e){notify(e.message,true);}};
const form=$('flightForm');for(const role of roles)form.elements.role.append(new Option(role,role));
function outcomes(){const s=form.elements.outcome;s.replaceChildren();for(const v of form.elements.kind.value==='SHADOW'?['COMPLETED']:['PASS','FAIL'])s.append(new Option(v,v));}
form.elements.kind.onchange=outcomes;outcomes();
form.onsubmit=async e=>{e.preventDefault();try{const payload=Object.fromEntries(new FormData(form));payload.airline=payload.airline.toUpperCase().trim();payload.expectedRevision=revision;await api('/api/training/'+encodeURIComponent(id)+'/flights',{method:'POST',body:JSON.stringify(payload)});await load();form.reset();outcomes();notify('Training flight recorded.');}catch(error){notify(error.message,true);}};
(async()=>{try{if(!id)throw Error('Missing employee ID');employees=await api('/api/users');for(const e of employees){if(e.active!==false&&e._id!==id)form.elements.trainer.append(new Option(e.name,e._id));}await load();}catch(e){notify(e.message,true);}})();
