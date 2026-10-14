function roleAssignment(assignments,role,user){
  const rows=assignments.filter(a=>a.role===role);
  return rows.length===1 && String(rows[0].userId)===String(user._id)?rows[0]:null;
}
function permissions(assignments,user){
  return {view:user.role==='ADMIN'||user.department==='OPERATIONS'||user.position==='PAX_DM'||assignments.some(a=>String(a.userId)===String(user._id)),
    send:Boolean(roleAssignment(assignments,'CHECKIN',user)),receive:Boolean(roleAssignment(assignments,'GATE',user))};
}
function validate(body){
  if(!Number.isInteger(body.expectedSequence)||body.expectedSequence<0)throw Error('Refresh before sending');
  for(const field of ['checkedIn','infants','bags'])if(!Number.isInteger(body[field])||body[field]<0||body[field]>(field==='bags'?3000:1000))throw Error(`Invalid ${field} count`);
  if(typeof body.notes!=='string'||body.notes.length>2000)throw Error('Notes must be at most 2,000 characters');
  return {checkedIn:body.checkedIn,infants:body.infants,bags:body.bags,notes:body.notes.trim()};
}
module.exports={roleAssignment,permissions,validate};
