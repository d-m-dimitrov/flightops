(() => {
 const form=document.getElementById('loginForm');
 const email=document.getElementById('email');
 const password=document.getElementById('password');
 const error=document.getElementById('loginError');
 const button=document.getElementById('loginButton');
 const buttonText=document.getElementById('loginButtonText');
 const spinner=document.getElementById('loginSpinner');
 const toggle=document.getElementById('togglePassword');
 let busy=false;
 function showError(message){error.textContent=message;error.hidden=false;}
 function clearError(){error.textContent='';error.hidden=true;}
 function loading(on){busy=on;button.disabled=on;buttonText.textContent=on?'Signing in…':'Sign in';spinner.hidden=!on;form.setAttribute('aria-busy',String(on));}
 toggle.addEventListener('click',()=>{
  const show=password.type==='password';password.type=show?'text':'password';
  toggle.textContent=show?'Hide':'Show';toggle.setAttribute('aria-label',show?'Hide password':'Show password');toggle.setAttribute('aria-pressed',String(show));
 });
 form.addEventListener('submit',async event=>{
  event.preventDefault();if(busy)return;clearError();
  const loginEmail=email.value.trim(),loginPassword=password.value;
  if(!loginEmail){showError('Enter your email address.');email.focus();return;}
  if(!loginPassword){showError('Enter your password.');password.focus();return;}
  loading(true);
  try{
   const response=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:loginEmail,password:loginPassword})});
   if(!response.ok){showError(response.status===429?'Too many attempts. Please try again later.':'Unable to sign in. Check your email and password.');return;}
   const data=await response.json();
   if(!data.token||!data.user)throw Error('Invalid login response');
   localStorage.setItem('token',data.token);
   localStorage.setItem('user',JSON.stringify(data.user));
   window.location.assign('flights.html');
  }catch(e){showError(e.message==='Invalid login response'?'Sign-in response was incomplete. Please try again.':'Unable to connect. Please check your connection and try again.');}
  finally{loading(false);}
 });
 email.focus();
})();
