checkAuth();
const $=id=>document.getElementById(id),token=localStorage.getItem('token'),flightId=new URLSearchParams(location.search).get('id'),base=`/api/handovers/${encodeURIComponent(flightId||'')}`;
let data=null,dirty=false,busy=false,sequence=0,assignmentId=null,generation=0;
$('flightLink').href=`dashboard.html?id=${encodeURIComponent(flightId||'')}`;
function el(tag,text,cls){const n=document.createElement(tag);n.textContent=text;if(cls)n.className=cls;return n;}
function time(value){return new Date(value).toLocaleString('en-GB',{timeZone:'Europe/London',timeZoneName:'short'});}
async function request(url,options={}){if(localStorage.getItem('token')!==token)throw Error('Account changed. Reload this page.');const r=await fetch(url,{...options,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'}});if(localStorage.getItem('token')!==token)throw Error('Account changed. Reload this page.');if(!r.ok)throw Error((await r.json()).error||'Unable to load handover');const body=await r.json();if(localStorage.getItem('token')!==token)throw Error('Account changed. Reload this page.');return body;}
function controls(){const valid=localStorage.getItem('token')===token;$('send').disabled=busy||!valid||!data?.permissions.send||sequence!==data.sequence||assignmentId!==data.checkinAssignmentId;$('receive').disabled=busy||!valid||!data?.permissions.receive;$('refresh').disabled=busy;}
function render(){
 $('flightTitle').textContent=`${data.flight.display} · ${data.flight.operatingDate}`;
 $('latest').replaceChildren();$('history').replaceChildren();const latest=data.versions[0];
 if(!latest)$('latest').textContent='Awaiting Check-in handover';
 else{
  $('latest').append(el('p',`v${latest.revision} · ${latest.sentByName} · ${time(latest.createdAt)}`),el('p',`Checked-in: ${latest.checkedIn} · Infants: ${latest.infants} · Bags: ${latest.bags}`),el('p',latest.notes||'No additional notes','notes'),el('p',data.receipt?`✓ Received by ${data.receipt.name} · ${time(data.receipt.receivedAt)}`:'Awaiting receipt by current Gate agent'));
 }
 for(const version of data.versions){const box=el('details','','border-top py-2');box.append(el('summary',`v${version.revision} · ${version.sentByName} · ${time(version.createdAt)}`),el('p',`Checked-in ${version.checkedIn} · Infants ${version.infants} · Bags ${version.bags}`),el('p',version.notes,'notes'));for(const receipt of version.receipts||[])box.append(el('p',`Received by ${receipt.name} · ${time(receipt.receivedAt)}`,'small'));$('history').append(box);}
 $('receive').hidden=!data.permissions.receive||!latest||Boolean(data.receipt);
 $('sendSection').hidden=!data.permissions.send&&!dirty;
 if(!dirty){sequence=data.sequence;assignmentId=data.checkinAssignmentId;for(const field of ['checkedIn','infants','bags','notes'])$(field).value=latest?.[field]??'';}
 if(dirty&&(sequence!==data.sequence||assignmentId!==data.checkinAssignmentId))$('message').textContent='Handover or assignment changed. Your draft is preserved. Copy any notes you need, then Reload latest.';
 else if(!dirty)$('message').textContent=data.permissions.send?'Assigned Check-in: review the figures and send to Gate.':data.permissions.receive?'Assigned Gate: read the latest handover and confirm receipt.':'Read-only view for the flight team.';
 controls();
}
async function refresh(){const check=++generation;try{const next=await request(base);if(check!==generation)return;data=next;render();}catch(error){if(check!==generation)return;$('message').textContent=error.message;if(data)data.permissions={};controls();}}
$('refresh').onclick=()=>{if(dirty&&!confirm('Discard this unsent draft and reload the latest handover?'))return;dirty=false;refresh();};
$('sendForm').addEventListener('input',()=>{dirty=true;});
$('sendForm').onsubmit=async event=>{
 event.preventDefault();if(!data?.permissions.send||busy)return;
 if(!confirm('Send these figures and notes to Gate as a new handover version?'))return;
 busy=true;controls();try{await request(base,{method:'POST',body:JSON.stringify({assignmentId,expectedSequence:sequence,checkedIn:Number($('checkedIn').value),infants:Number($('infants').value),bags:Number($('bags').value),notes:$('notes').value})});dirty=false;await refresh();}catch(error){$('message').textContent=error.message;}finally{busy=false;controls();}
};
$('receive').onclick=async()=>{if(!data?.permissions.receive||busy||!data.versions[0])return;busy=true;controls();try{await request(base+'/receive',{method:'POST',body:JSON.stringify({assignmentId:data.gateAssignmentId,handoverId:data.versions[0]._id})});await refresh();}catch(error){$('message').textContent=error.message;}finally{busy=false;controls();}};
const timer=setInterval(()=>{if(!busy&&!document.hidden)refresh();},10000);
window.addEventListener('pagehide',()=>{clearInterval(timer);generation++;});window.addEventListener('pageshow',e=>{if(e.persisted)location.reload();});
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
window.addEventListener('storage',()=>{if(localStorage.getItem('token')!==token){$('message').textContent='Account changed. Copy your draft if needed, then reload.';controls();}});
refresh();
