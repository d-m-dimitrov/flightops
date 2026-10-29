checkAuth();
const $=id=>document.getElementById(id),headers={Authorization:'Bearer '+localStorage.getItem('token'),'Content-Type':'application/json'};
const services=[['cargo','Cargo Handling'],['crewTransport','Crew Transport'],['passengerBuses','Passenger Buses'],['catering','Catering'],['cleaning','Aircraft Cleaning'],['fuel','Fuel'],['waterToilet','Water / Toilet Services']];
const serviceFields=[['provider','Provider'],['contact','Contact'],['phone','Phone'],['backupPhone','Backup phone'],['notes','Notes']];
const instructions=['arrival','departure','aircraft','general'];
const user=getCurrentUser()||{};const editor=user.role==='ADMIN'||['OPERATIONS_DM','PAX_DM','RAMP_DM','SPUR_DM'].includes(user.position);
let current=null;
function input(label,value='',type='text'){const div=document.createElement('div');div.className='col-md-4';const lab=document.createElement('label');lab.className='form-label small';lab.textContent=label;const el=document.createElement(type==='textarea'?'textarea':'input');el.className='form-control form-control-sm';if(type!=='textarea')el.type=type;el.value=value||'';el.disabled=!editor;div.append(lab,el);return {div,el};}
function rep(row={}){const box=document.createElement('div');box.className='row g-2 border-bottom pb-3 mb-3';const fields={};for(const k of ['name','position','phone','email','notes']){const x=input(k,row[k]||'');box.append(x.div);fields[k]=x.el;}const remove=document.createElement('button');remove.type='button';remove.className='btn btn-sm btn-outline-danger w-auto align-self-end';remove.textContent='Remove';remove.disabled=!editor;remove.onclick=()=>box.remove();box.append(remove);box.fields=fields;$('representatives').append(box);}
function render(row={}){current=row;for(const key of ['name','icao','callsign','awbPrefix','logoUrl'])$(key).value=row[key]||'';const logo=$('logo');logo.hidden=false;logo.src=row.logoData||row.logoUrl||('logos/'+String(row.iata||$('iata').value).toLowerCase()+'.png');logo.onerror=()=>{logo.hidden=true;};$('representatives').replaceChildren();for(const r of row.representatives||[])rep(r);$('services').replaceChildren();for(const [key,title] of services){const block=document.createElement('div');block.className='mb-3 border-bottom pb-3';const h=document.createElement('h6');h.textContent=title;block.append(h);const grid=document.createElement('div');grid.className='row g-2';block.fields={};for(const [field,label] of serviceFields){const x=input(label,row.services?.[key]?.[field]||'',field==='notes'?'textarea':'text');grid.append(x.div);block.fields[field]=x.el;}block.append(grid);block.dataset.service=key;$('services').append(block);}const ins=$('instructions');ins.replaceChildren();ins.append(document.createTextNode('Loading published instructions…'));loadInstructions(row.iata||$('iata').value);for(const id of ['name','icao','callsign','awbPrefix','logoUrl','iata'])$(id).disabled=!editor;$('addRep').disabled=!editor;$('logoFile').disabled=!editor;$('uploadLogo').hidden=!editor;$('removeLogo').hidden=!editor;$('save').hidden=!editor;$('form').querySelector('button[type=submit]').hidden=!editor;$('updated').textContent=row.updatedAt?'Last updated: '+new Date(row.updatedAt).toLocaleString()+(row.updatedBy?' · Updated by '+row.updatedBy:''):'';}
function message(text){$('alert').textContent=text;$('alert').classList.remove('d-none');}
async function request(url,opts={}){const r=await fetch(url,{...opts,headers});const body=await r.json().catch(()=>({}));if(!r.ok)throw Error(body.error||'Request failed');return body;}
async function list(){const rows=await request('/api/airline-directory');const select=$('airlines');select.replaceChildren(new Option('Select airline',''));for(const r of rows)select.append(new Option(r.iata+' — '+r.name,r.iata));return rows;}
async function open(){const code=($('iata').value||$('airlines').value).trim().toUpperCase();if(!/^[A-Z0-9]{2,3}$/.test(code)){message('Enter a valid IATA code');return;}$('alert').classList.add('d-none');$('iata').value=code;try{render(await request('/api/airline-directory/'+encodeURIComponent(code)));}catch(e){if(e.message==='Airline not found'){render({iata:code});}else message(e.message);}}
$('open').onclick=open;$('airlines').onchange=()=>{$('iata').value=$('airlines').value;if($('iata').value)open();};$('addRep').onclick=()=>rep();
async function save(e){e?.preventDefault();if(!editor)return;const code=$('iata').value.trim().toUpperCase();const data={};for(const k of ['name','icao','callsign','awbPrefix','logoUrl'])data[k]=$(k).value.trim();data.representatives=[...$('representatives').children].map(box=>Object.fromEntries(Object.entries(box.fields).map(([k,v])=>[k,v.value.trim()])));data.services={};for(const block of $('services').children)data.services[block.dataset.service]=Object.fromEntries(Object.entries(block.fields).map(([k,v])=>[k,v.value.trim()]));try{render(await request('/api/airline-directory/'+encodeURIComponent(code),{method:'PUT',body:JSON.stringify(data)}));await list();$('airlines').value=code;$('alert').classList.add('d-none');alert('Airline saved');}catch(err){message(err.message);}}
$('save').onclick=save;$('form').onsubmit=save;render();list().then(()=>{const code=new URLSearchParams(location.search).get('iata');if(code){$('iata').value=code;open();}}).catch(e=>message(e.message));

async function resizedLogo(file){
 if(!file||!['image/png','image/jpeg','image/webp'].includes(file.type))throw Error('Select a PNG, JPG or WebP image');
 if(file.size>5*1024*1024)throw Error('Original image must be under 5 MB');
 const img=await createImageBitmap(file);
 try{
  const scale=Math.min(1,600/img.width,300/img.height);
  const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.width*scale));canvas.height=Math.max(1,Math.round(img.height*scale));
  canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
  const data=canvas.toDataURL('image/webp',0.82);
  if(!data.startsWith('data:image/webp;'))throw Error('WebP encoding unavailable');
  if(data.length>240000)throw Error('Logo is too large after resizing; use a smaller image');
  return data;
 }finally{img.close();}
}
$('uploadLogo').onclick=async()=>{
 const code=$('iata').value.trim().toUpperCase();
 if(!current?._id){message('Save the airline first, then upload the logo');return;}
 try{
  const data=await resizedLogo($('logoFile').files[0]);
  await request('/api/airline-directory/'+encodeURIComponent(code)+'/logo',{method:'PUT',body:JSON.stringify({image:data})});
  $('logoFile').value='';await open();$('alert').classList.add('d-none');
 }catch(e){message(e.message);}
};
$('removeLogo').onclick=async()=>{
 if(!current?._id)return message('Save the airline first');
 try{await request('/api/airline-directory/'+encodeURIComponent($('iata').value.trim())+'/logo',{method:'DELETE'});await open();$('alert').classList.add('d-none');}
 catch(e){message(e.message);}
};

async function loadInstructions(iata){
 const target=$('instructions');
 if(!/^[A-Z0-9]{2,3}$/.test(iata||'')){target.replaceChildren();return;}
 try{
  const data=await request('/api/airline-directory/'+encodeURIComponent(iata)+'/instructions');
  if(($('iata').value||'').toUpperCase()!==iata)return;
  target.replaceChildren();
  for(const item of data.items){
   const box=document.createElement('div');box.className='col-12 border-bottom pb-2';
   const h=document.createElement('strong');h.textContent=item.title+' · '+item.operation+' · '+item.aircraftType;
   const meta=document.createElement('div');meta.className='small text-muted';meta.textContent=item.department+' / '+item.role+' / '+item.type;
   const body=document.createElement('div');body.style.whiteSpace='pre-wrap';body.textContent=item.body||'';
   box.append(h,meta,body);
   if(item.steps?.length){const ul=document.createElement('ul');for(const step of item.steps){const li=document.createElement('li');li.textContent=step;ul.append(li);}box.append(ul);}
   target.append(box);
  }
  const legacy=Object.entries(data.legacy||{}).filter(([,v])=>typeof v==='string'&&v.trim());
  if(legacy.length){
   const heading=document.createElement('div');heading.className='col-12 text-warning-emphasis fw-semibold';heading.textContent='Legacy Airline Directory notes (read-only; not yet migrated)';target.append(heading);
   for(const [key,value] of legacy){const div=document.createElement('div');div.className='col-md-6';const strong=document.createElement('strong');strong.textContent=key.toUpperCase();const body=document.createElement('div');body.style.whiteSpace='pre-wrap';body.textContent=value;div.append(strong,body);target.append(div);}
  }
  if(!data.items.length&&!legacy.length)target.textContent='No handling instructions configured.';
  const link=document.createElement('a');link.href='handling-instructions.html';link.className='col-12 small';link.textContent='Manage instructions in Administration';target.append(link);
 }catch(e){target.textContent='Unable to load instructions: '+e.message;}
}
