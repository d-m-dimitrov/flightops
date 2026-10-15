(function(root){
const fields=['checkedIn','checkedInInfants','boarded','infants','jumpSeat'];
const count=v=>Number.isInteger(v)&&v>=0&&v<=1000;
function normalize(raw={}){
 const p={};for(const field of fields)p[field]=count(raw[field])?raw[field]:null;
 const legacy=raw.figuresVersion!==2;
 if(legacy){
  p.checkedIn=p.checkedIn??0;p.infants=p.infants??0;p.jumpSeat=p.jumpSeat??0;
  const oldTob=count(raw.tob)?raw.tob:0;
  p.boarded=oldTob>=p.infants?oldTob-p.infants:null;
 }
 p.tob=p.boarded!==null&&p.infants!==null?p.boarded+p.infants:null;
 p.remaining=p.checkedIn!==null&&p.boarded!==null?p.checkedIn-p.boarded:null;
 p.remainingInfants=p.checkedInInfants!==null&&p.infants!==null?p.checkedInInfants-p.infants:null;
 p.legacy=legacy;p.invalidLegacy=legacy&&p.boarded===null;
 return p;
}
function validate(body){
 const p={};for(const field of fields){if(!count(body[field]))throw Error(`${field}: enter a whole number from 0 to 1,000`);p[field]=body[field];}
 return {...p,tob:p.boarded+p.infants,figuresVersion:2};
}
const api={fields,normalize,validate};if(typeof module==='object')module.exports=api;else root.PassengerFigures=api;
})(globalThis);
