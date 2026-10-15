(function(root){
function normalize(rows){
 if(!Array.isArray(rows)||rows.length>200)throw Error('VIP baggage: maximum 200 bags');
 const seen=new Set();return rows.map(row=>{
  if(!row||typeof row.bagTag!=='string')throw Error('Enter a tag for each VIP bag');
  const bagTag=row.bagTag.trim().toUpperCase();
  if(!/^[A-Z0-9-]{1,24}$/.test(bagTag))throw Error('VIP baggage tags must contain 1–24 letters, digits or hyphens');
  if(seen.has(bagTag))throw Error(`Duplicate VIP baggage tag: ${bagTag}`);seen.add(bagTag);return {bagTag};
 });
}
if(typeof module==='object')module.exports={normalize};else root.VipBaggage={normalize};
})(globalThis);
