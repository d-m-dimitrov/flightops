if(checkAuth()){
const user=getCurrentUser()||{};
for(const [id,value] of [['profileName',user.name],['profileEmail',user.email],['profileDepartment',user.department],['profilePosition',user.position]])document.getElementById(id).textContent=value||'—';
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