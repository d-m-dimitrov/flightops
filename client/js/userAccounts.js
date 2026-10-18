checkAuth();
if(getCurrentUser()?.role!=='ADMIN')location.replace('flights.html');
let accounts=[],selected=null;
const $=id=>document.getElementById(id);
const modal=new bootstrap.Modal($('editor'));
function notice(message,error=false){$('alert').textContent=message;$('alert').className=message?'alert alert-'+(error?'danger':'success'):'';}
async function request(url,options={}){const response=await fetch(url,{...options,headers:{Authorization:'Bearer '+(localStorage.getItem('token')||''),...(options.body?{'Content-Type':'application/json'}:{})}});const data=await response.json();if(!response.ok)throw Error(data.error||'Request failed');return data;}
function render(){const search=$('search').value.toLowerCase(),filter=$('filter').value;const rows=$('rows');rows.replaceChildren();for(const account of accounts.filter(a=>(a.name+' '+a.email+' '+a.department).toLowerCase().includes(search)).filter(a=>filter==='all'||(filter==='enabled'&&a.active&&a.hasLogin)||(filter==='disabled'&&!a.active&&a.hasLogin)||(filter==='none'&&!a.hasLogin))){const tr=document.createElement('tr');for(const value of [account.name,account.department||'—',account.email||'—',account.hasLogin?(account.active?'Enabled':'Disabled'):'Not configured',account.lastLoginAt?new Date(account.lastLoginAt).toLocaleString():'Never']){const td=document.createElement('td');td.textContent=value;tr.append(td);}const td=document.createElement('td');if(account.role!=='ADMIN'){const button=document.createElement('button');button.className='btn btn-sm btn-outline-primary';button.textContent='Manage';button.onclick=()=>{selected=account;$('employeeName').textContent=account.name;$('email').value=account.email;$('password').value='';$('active').checked=Boolean(account.active&&account.hasLogin);modal.show();};td.append(button);}else td.textContent='Protected';tr.append(td);rows.append(tr);}}
async function load(){accounts=await request('/api/user-accounts');render();}
async function loadAudit(){
 const rows=$('auditRows');
 rows.replaceChildren();
 const status=document.createElement('tr'),cell=document.createElement('td');
 cell.colSpan=4;cell.className='text-muted py-3';cell.textContent='Loading audit log…';status.append(cell);rows.append(status);
 try{
  const audit=await request('/api/user-accounts/audit');
  rows.replaceChildren();
  if(!Array.isArray(audit))throw Error('Unexpected audit response');
  if(!audit.length){
   cell.textContent='No account changes have been recorded yet.';
   rows.append(status);
   return;
  }
  for(const item of audit){
   const tr=document.createElement('tr');
   const values=[item.at?new Date(item.at).toLocaleString('en-GB'):'—',item.actor||'Unknown',item.target||'Unknown',Array.isArray(item.changes)?item.changes.join(', '):'—'];
   for(const value of values){const td=document.createElement('td');td.textContent=value;tr.append(td);}
   rows.append(tr);
  }
 }catch(error){
  rows.replaceChildren();
  cell.textContent='Unable to load Audit Log: '+error.message;
  cell.className='text-danger py-3';
  rows.append(status);
  throw error;
 }
}

$('search').addEventListener('input',render);$('filter').addEventListener('change',render);
$('form').addEventListener('submit',async event=>{event.preventDefault();if(!selected)return;const payload={email:$('email').value,active:$('active').checked,password:$('password').value};try{await request('/api/user-accounts/'+selected._id,{method:'PATCH',body:JSON.stringify(payload)});modal.hide();notice('Account updated');await load();await loadAudit();}catch(error){notice(error.message,true);}});
$('refreshAudit').addEventListener('click',()=>loadAudit().catch(error=>notice(error.message,true)));
Promise.allSettled([load(),loadAudit()]).then(results=>{for(const result of results)if(result.status==='rejected')notice(result.reason.message,true);if(location.hash==='#audit')document.getElementById('audit')?.scrollIntoView({block:'start'});});
