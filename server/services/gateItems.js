const {roleAssignment,permissions:teamPermissions}=require('./handoverAccess');
const types=['BAG','STROLLER','WHEELCHAIR'];
function permissions(assignments,user){return {view:teamPermissions(assignments,user).view,submit:Boolean(roleAssignment(assignments,'GATE',user)),handle:Boolean(roleAssignment(assignments,'RAMP',user))};}
function batch(groups,existing=[]){
 if(!Array.isArray(groups)||groups.length<1||groups.length>3)throw Error('Enter counts and tags for at least one item type');
 const usedTypes=new Set(),tags=new Set(existing.filter(i=>i.status!=='CANCELLED').map(i=>i.tag)),items=[];
 for(const group of groups){
  if(!group||!types.includes(group.type)||usedTypes.has(group.type))throw Error('Invalid or repeated item type');usedTypes.add(group.type);
  if(!Number.isInteger(group.count)||group.count<1||group.count>200||!Array.isArray(group.tags)||group.tags.length!==group.count)throw Error('Each count must match the number of tags (1–200)');
  for(const input of group.tags){
   if(typeof input!=='string')throw Error('Invalid tag');const tag=input.trim().toUpperCase();
   if(!/^[A-Z0-9-]{1,24}$/.test(tag))throw Error('Tags must contain 1–24 letters, digits or hyphens');
   if(tags.has(tag))throw Error(`Tag ${tag} is already listed`);tags.add(tag);items.push({type:group.type,tag});
  }
 }
 if(items.length>200||existing.filter(i=>i.status!=='CANCELLED').length+items.length>1000)throw Error('Maximum 200 items per submission and 1,000 active items per flight');
 return items;
}
function transition(status,action){
 const rules={receive:{from:'SUBMITTED',to:'RECEIVED'},load:{from:'RECEIVED',to:'LOADED'},cancel:{from:'SUBMITTED',to:'CANCELLED'}};
 const rule=rules[action];if(!rule||status!==rule.from)throw Error('Item status changed or this action is not allowed. Refresh first.');return rule.to;
}
function summary(items=[]){return Object.fromEntries(types.map(type=>{const rows=items.filter(i=>i.type===type&&i.status!=='CANCELLED');return [type,{submitted:rows.length,received:rows.filter(i=>['RECEIVED','LOADED'].includes(i.status)).length,loaded:rows.filter(i=>i.status==='LOADED').length}];}));}
module.exports={permissions,batch,transition,summary};
