(() => {
 const token=localStorage.getItem('token');
 const user=JSON.parse(localStorage.getItem('user')||'null');
 if(!token||!user){location.href='login.html';return;}
 if(user.role!=='ADMIN'){document.querySelector('main').textContent='Super Admin access required';return;}
 const el=id=>document.getElementById(id);
 const fields=['airline','aircraftType','operation','department','role','type','title','body','active'];
 let items=[];
 function notice(message,error=false){el('notice').textContent=message;el('notice').className='alert '+(error?'alert-danger':'alert-success');}
 async function api(url,options={}){const response=await fetch(url,{...options,headers:{'Content-Type':'application/json','Authorization':'Bearer '+token,...options.headers}});const data=await response.json();if(!response.ok)throw Error(data.error||'Request failed');return data;}
 function clear(){el('editor').reset();el('editingId').value='';el('revision').value='';el('aircraftType').value='ALL';el('active').checked=false;}
 function edit(item){for(const key of fields)el(key)[key==='active'?'checked':'value']=item[key]??'';el('editingId').value=item._id;el('revision').value=item.revision;window.scrollTo({top:0,behavior:'smooth'});}
 function render(){const tbody=el('rows');tbody.replaceChildren();for(const item of items){const tr=document.createElement('tr');for(const value of [item.airline+' / '+item.aircraftType,item.operation+' / '+item.department+' / '+item.role,item.type,item.title,item.active?'Active':'Draft']){const td=document.createElement('td');td.textContent=value;tr.append(td);}const td=document.createElement('td');const button=document.createElement('button');button.type='button';button.className='btn btn-sm btn-outline-primary';button.textContent='Edit';button.addEventListener('click',()=>edit(item));td.append(button);tr.append(td);tbody.append(tr);}}
 async function load(){items=await api('/api/handling-instructions');render();}
 el('new').addEventListener('click',clear);
 el('editor').addEventListener('submit',async event=>{event.preventDefault();const data={};for(const key of fields)data[key]=key==='active'?el(key).checked:el(key).value;const id=el('editingId').value;try{if(id)data.revision=Number(el('revision').value);await api('/api/handling-instructions'+(id?'/'+id:''),{method:id?'PATCH':'POST',body:JSON.stringify(data)});notice(id?'Instruction updated':'Draft instruction created');clear();await load();}catch(e){notice(e.message,true);}});
 load().catch(e=>notice(e.message,true));
})();
