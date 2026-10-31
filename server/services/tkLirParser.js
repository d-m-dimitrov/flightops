'use strict';
function parse(text) {
 const rows=[], warnings=[];
 const lines=String(text).split('\n');
 for(let i=0;i<lines.length;i++){
  const line=lines[i];
  const positions=[...line.matchAll(/:(\d{2}[LPR]?)\s+([A-Z]{3}\d{5,8}[A-Z0-9]{2,3})/g)];
  if(!positions.length)continue;
  const next=lines.slice(i+1,i+4).find(x=>x.includes(':ONLOAD'))||'';
  const loads=[...next.matchAll(/:ONLOAD\s+([A-Z]{3})\s+([^:]+)/g)];
  positions.forEach((match,j)=>{
   const id=match[2],raw=loads[j]?.[2]||'';
   const entries=[...raw.matchAll(/\b([A-Z]{1,3})\/([A-Z0-9-]+)/g)].map(x=>({type:x[1],value:x[2],weightKg:/^\d+$/.test(x[2])?Number(x[2]):null}));
   rows.push({position:match[1],plannedUld:/^[A-Z]{3}0{5,8}[A-Z]{2,3}$/.test(id)?null:id,uldType:id.slice(0,3),placeholder:/^[A-Z]{3}0{5,8}[A-Z]{2,3}$/.test(id),load:entries,needsReview:loads.length!==positions.length||!entries.length||entries.some(x=>x.weightKg===null)});
  });
 }
 if(!rows.length)warnings.push('No supported TK rows found');
 return {format:'TK_TEXT_V1',rows,warnings};
}
module.exports={parse};
