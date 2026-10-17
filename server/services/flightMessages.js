const types=['MVT','CPM','LDM','UCM'],directions=['ARRIVAL','DEPARTURE'];
function canAdd(user){return Boolean(user?.active && (user.role==='ADMIN'||user.department==='OPERATIONS'));}
function validate(body){
  if(!types.includes(body?.type)||!directions.includes(body?.direction))throw Error('Select a message type and Arrival / Departure');
  if(typeof body.text!=='string'||!body.text.trim()||body.text.length>30000)throw Error('Enter message text (maximum 30,000 characters)');
  if(typeof body.requestId!=='string'||!/^[a-f\d-]{36}$/i.test(body.requestId))throw Error('Invalid submission ID. Reload and try again.');
  // Preserve the pasted text exactly; never interpret Type B content as HTML or flight updates.
  return {type:body.type,direction:body.direction,text:body.text,requestId:body.requestId};
}
module.exports={types,directions,canAdd,validate};
