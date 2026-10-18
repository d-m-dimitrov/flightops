if(checkAuth()){
const user=getCurrentUser()||{};
for(const [id,value] of [['profileName',user.name],['profileEmail',user.email],['profileDepartment',user.department],['profilePosition',user.position]])document.getElementById(id).textContent=value||'—';
const londonTime=value=>value?new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',hour:'2-digit',minute:'2-digit'}).format(new Date(value)):'—';
const showEmpty=(tbody,message,colspan)=>{const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=colspan;td.className='text-muted py-3';td.textContent=message;tr.append(td);tbody.append(tr);};
const addRow=(tbody,values)=>{const tr=document.createElement('tr');for(const value of values){const td=document.createElement('td');td.textContent=value;tr.append(td);}tbody.append(tr);};
async function loadProfile(){
 const notice=document.getElementById('profileMessage');
 try{
  const response=await fetch('/api/auth/me',{headers:{Authorization:'Bearer '+(localStorage.getItem('token')||'')},cache:'no-store'});
  if(!response.ok)throw Error((await response.json()).error||'Could not load profile');
  const {profile,shifts}=await response.json();
  for(const [id,value] of [['profileName',profile.name],['profileEmail',profile.email],['profileDepartment',profile.department],['profilePosition',profile.position],['profilePhone',profile.phone],['profileLastLogin',profile.lastLoginAt?new Date(profile.lastLoginAt).toLocaleString('en-GB',{timeZone:'Europe/London'}):null]])document.getElementById(id).textContent=value||'—';
  const qualifications=document.getElementById('qualificationRows');qualifications.replaceChildren();
  const today=new Date().toLocaleDateString('en-CA',{timeZone:'Europe/London'});
  const soon=new Date(today+'T12:00:00Z');soon.setUTCDate(soon.getUTCDate()+30);
  const cutoff=soon.toISOString().slice(0,10);
  for(const q of profile.airlineQualifications||[]){
   const expiry=q.validUntil||null;
   const status=!expiry?'No expiry':expiry<today?'Expired':expiry<=cutoff?'Expires soon':'Valid';
   addRow(qualifications,[q.airline||'—',q.role||'—',expiry||'No expiry',status]);
  }
  if(!qualifications.children.length)showEmpty(qualifications,'No airline qualifications recorded.',4);
  const roster=document.getElementById('shiftRows');roster.replaceChildren();
  for(const shift of shifts||[])addRow(roster,[shift.date,shift.status,londonTime(shift.start),londonTime(shift.end)]);
  if(!roster.children.length)showEmpty(roster,'No shifts recorded for the next 14 days.',4);
 }catch(error){notice.className='alert alert-danger';notice.textContent=error.message;}
}
loadProfile();
document.getElementById('passwordForm').addEventListener('submit',async event=>{
 event.preventDefault();
 const button=document.getElementById('savePassword'),message=document.getElementById('message');
 const currentPassword=document.getElementById('currentPassword').value,newPassword=document.getElementById('newPassword').value,confirmPassword=document.getElementById('confirmPassword').value;
 if(newPassword!==confirmPassword){message.className='alert alert-danger';message.textContent='New passwords do not match';return;}
 button.disabled=true;message.textContent='';
 try{
  const response=await fetch('/api/auth/change-password',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+(localStorage.getItem('token')||'')},body:JSON.stringify({currentPassword,newPassword,confirmPassword})});
  const result=await response.json();
  if(!response.ok)throw Error(result.error||'Unable to change password');
  document.getElementById('passwordForm').reset();
  message.className='alert alert-success';message.textContent=result.message;
  localStorage.removeItem('token');localStorage.removeItem('user');
  setTimeout(()=>location.replace('login.html'),1500);
 }catch(error){message.className='alert alert-danger';message.textContent=error.message;button.disabled=false;}
});
}