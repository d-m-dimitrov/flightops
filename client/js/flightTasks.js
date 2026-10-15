(function(root){
function closed(f){return ['CANCELLED','DEPARTED','AIRBORNE'].includes(f.status)||Boolean(f.departure?.atd||f.departure?.airborne||f.departure?.pushback);}
function actions(f){
 if(closed(f))return [];
 const tasks=f.assignments.filter(a=>!a.acceptedAt).map(a=>`Accept ${label(a.role)} assignment`);
 const roles=f.assignments.map(a=>a.role);
 if(roles.includes('CHECKIN')){
  const mine=f.assignments.find(a=>a.role==='CHECKIN');
  if(!f.handover || String(f.handover.assignmentId)!==String(mine._id))tasks.push('Send Check-in → Gate handover');
 }
 if(roles.includes('GATE')&&f.handover&&!f.handover.received)tasks.push(`Read / acknowledge handover v${f.handover.revision}`);
 if(roles.includes('RAMP')&&f.lir){if(!f.lir.received)tasks.push(`Read / acknowledge LIR v${f.lir.revision}`);else if(f.lir.status!=='COMPLETED')tasks.push('Complete LIR');}
 if(roles.includes('RAMP')&&f.gateItems){
  if(f.gateItems.received<f.gateItems.total)tasks.push(`Receive ${f.gateItems.total-f.gateItems.received} gate item(s)`);
  if(f.gateItems.loaded<f.gateItems.received)tasks.push(`Load ${f.gateItems.received-f.gateItems.loaded} gate item(s)`);
 }
 return tasks;
}
function target(f){const arrival=f.assignments.length>0&&f.assignments.every(a=>['ARRIVAL','ARRIVAL_DISPATCH'].includes(a.role));return {label:arrival?(f.arrival?.eta?'ETA':'STA'):(f.departure?.etd?'ETD':'STD'),value:arrival?(f.arrival?.eta||f.arrival?.staAt):(f.departure?.etd||f.departure?.stdAt)};}
function sort(flights){return [...flights].sort((a,b)=>Number(closed(a))-Number(closed(b))||Number(actions(b).length>0)-Number(actions(a).length>0)||(Date.parse(target(a).value)||Infinity)-(Date.parse(target(b).value)||Infinity));}
function label(role){return {DISPATCH:'Departure Dispatcher',ARRIVAL_DISPATCH:'Arrival Dispatcher',ARRIVAL:'Arrival Agent'}[role]||role;}
const api={label,actions,closed,target,sort};if(typeof module==='object')module.exports=api;else root.FlightTasks=api;
})(globalThis);
