checkAuth();
const token=localStorage.getItem('token'),headers={Authorization:'Bearer '+token,'Content-Type':'application/json'};
const $=id=>document.getElementById(id);
const codes=[['GENERAL','General'],['DGR','DGR'],['JETTY','Jetty'],['ADP','ADP'],['WB','W&B']];
let users=[],mode='mandatory',exportRows=[];
function airlines(){return [...new Set(users.flatMap(u=>[...(u.airlineQualifications||[]).map(q=>q.airline),...(u.trainingFlights||[]).map(f=>f.airline)]).filter(Boolean))].sort();}
const today=new Date().toLocaleDateString('en-CA',{timeZone:'Europe/London'});
function status(u,code){
 if((u.trainingNotRequired||[]).includes(code))return ['NA','N/A'];
 const t=(u.mandatoryTraining||[]).find(x=>x.code===code);
 if(!t||!t.completedOn)return ['MISSING','Not recorded'];
 if(!t.validUntil)return ['MISSING','Expiry not recorded'];
 if(t.validUntil<today)return ['EXPIRED','Expired '+t.validUntil];
 const remaining=Math.round((Date.parse(t.validUntil+'T00:00:00Z')-Date.parse(today+'T00:00:00Z'))/86400000);
 return remaining<=30?['SOON','Expires '+t.validUntil]:['VALID','Valid to '+t.validUntil];
}
const airlineColors={LICENSED:'success',TRAINED:'info',SHADOW:'warning',UNTRAINED:'secondary',EXPIRED:'danger'};
const airlineSymbols={LICENSED:'✓',TRAINED:'T',SHADOW:'S',UNTRAINED:'—',EXPIRED:'✕'};
function airlineState(u,airline){const qs=(u.airlineQualifications||[]).filter(q=>q.airline===airline&&['DISPATCH','ARRIVAL_DISPATCH'].includes(q.role));const valid=qs.filter(q=>!q.validUntil||q.validUntil>=today);if(valid.length)return ['LICENSED','Licensed',valid.map(q=>q.role+(q.validUntil?' · '+q.validUntil:'')).join(' / ')];const flights=(u.trainingFlights||[]).filter(f=>f.airline===airline&&['DISPATCH','ARRIVAL_DISPATCH'].includes(f.role));const checks=flights.filter(f=>f.kind==='CHECK').sort((a,b)=>String(b.flightDate).localeCompare(String(a.flightDate)));if(checks[0]?.outcome==='PASS')return ['TRAINED','Trained','Check Flight passed '+checks[0].flightDate+'; independent qualification not recorded'];const shadow=flights.filter(f=>f.kind==='SHADOW').length;if(shadow)return ['SHADOW','Shadow',shadow+' shadow flights'];if(qs.length)return ['EXPIRED','Expired','Qualification expired'];return ['UNTRAINED','Untrained','No qualification or training recorded'];}
const colors={VALID:'success',SOON:'warning',EXPIRED:'danger',MISSING:'secondary',NA:'light'};
function td(tr,text){const c=document.createElement('td');c.textContent=text;tr.append(c);return c;}
function badge(kind,label){const b=document.createElement('span');b.className='badge text-bg-'+colors[kind];b.textContent=label;return b;}
function filtered(){const q=$('search').value.trim().toLowerCase(),dept=$('department').value,filter=$('status').value;return users.filter(u=>(!dept||u.department===dept)&&(!q||(u.name||'').toLowerCase().includes(q))&&(!filter||(mode==='mandatory'&&codes.some(([code])=>status(u,code)[0]===filter))));}
function draw(){
 const rows=filtered(),head=$('head'),body=$('body');head.replaceChildren();body.replaceChildren();exportRows=[];
 const h=document.createElement('tr');for(const name of mode==='mandatory'?['Employee','Department',...codes.map(x=>x[1])]:['Employee',...airlines()]){const th=document.createElement('th');th.textContent=name;h.append(th);}head.append(h);
 let counts={VALID:0,SOON:0,EXPIRED:0,MISSING:0,NA:0};
 for(const u of rows){
 if(mode==='mandatory'){
 const tr=document.createElement('tr');td(tr,u.name||'—');td(tr,u.department||'—');
 const out=[u.name||'',u.department||''];
 for(const [code] of codes){const [kind,label]=status(u,code);counts[kind]++;out.push(label);const cell=document.createElement('td');const button=document.createElement('button');button.className='btn btn-sm p-0 border-0';button.append(badge(kind,label));button.title='Open training record / set N/A';button.onclick=()=>manage(u,code,kind);cell.append(button);tr.append(cell);}body.append(tr);exportRows.push(out);
 }else{
 const tr=document.createElement('tr');td(tr,u.name||'—');const out=[u.name||''];for(const airline of airlines()){const [kind,label,detail]=airlineState(u,airline);out.push(label);const cell=document.createElement('td');const pill=document.createElement('span');pill.className='badge text-bg-'+airlineColors[kind];pill.textContent=airlineSymbols[kind];pill.title=label+' — '+detail;pill.setAttribute('aria-label',airline+' '+label+' — '+detail);pill.style.minWidth='2rem';pill.style.fontSize='0.9rem';cell.className='text-center';cell.append(pill);tr.append(cell);}body.append(tr);exportRows.push(out);
 }
 }
 $('summary').textContent=mode==='mandatory'?rows.length+' employees · '+counts.VALID+' valid · '+counts.SOON+' expiring · '+counts.EXPIRED+' expired · '+counts.MISSING+' missing · '+counts.NA+' N/A':rows.length+' dispatchers · '+airlines().length+' airlines';
}
async function manage(u,code,kind){
 const choice=window.prompt('Training '+code+' for '+u.name+'\nType EDIT to open employee training, NA to mark Not Required, or REQUIRED to remove N/A.','EDIT');
 if(!choice)return;
 if(choice.trim().toUpperCase()==='EDIT'){location.href='training.html?id='+encodeURIComponent(u._id);return;}
 const value=choice.trim().toUpperCase();if(!['NA','REQUIRED'].includes(value))return;
 if(value==='NA'&&!confirm('Mark '+code+' as not required for '+u.name+'?'))return;
 try{const detail=await request('/api/training/'+encodeURIComponent(u._id));await request('/api/training/'+encodeURIComponent(u._id)+'/not-required',{method:'PUT',body:JSON.stringify({code,notRequired:value==='NA',expectedRevision:detail.trainingRevision})});await load();}catch(e){$('notice').hidden=false;$('notice').textContent=e.message;}
}
async function request(path,options={}){const r=await fetch(path,{...options,headers});const x=await r.json().catch(()=>({}));if(!r.ok)throw Error(x.error||'Request failed');return x;}
async function load(){users=await request('/api/training/matrix');const dept=$('department'),selected=dept.value;dept.replaceChildren(new Option('All departments',''));for(const name of [...new Set(users.map(u=>u.department).filter(Boolean))].sort())dept.append(new Option(name,name));dept.value=selected;draw();}
for(const id of ['search','department','status'])$(id).addEventListener('input',draw);
for(const [id,value] of [['mandatoryTab','mandatory'],['airlineTab','airline']])$(id).onclick=()=>{mode=value;$('mandatoryTab').classList.toggle('active',mode==='mandatory');$('airlineTab').classList.toggle('active',mode==='airline');$('status').disabled=mode==='airline';draw();};
$('export').onclick=()=>{const headings=[...$('head').querySelectorAll('th')].map(x=>x.textContent);const quote=s=>'"'+String(s??'').replace(/"/g,'""')+'"';const csv=[headings,...exportRows].map(row=>row.map(quote).join(',')).join('\r\n');const blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='flightops-'+mode+'-matrix.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
load().catch(e=>{$('notice').hidden=false;$('notice').textContent=e.message;});
