const time=require('../../client/js/operationalTime');
const qualifications=require('../../client/js/airlineQualifications');
const patterns={EELL00:['EARLY','EARLY','LATE','LATE','OFF','OFF'],LLLL00:['LATE','LATE','LATE','LATE','OFF','OFF']};
const ranges={EARLY:[270,360],DAY:[480,690],LATE:[720,900]};
function validMonth(month){return /^\d{4}-(0[1-9]|1[0-2])$/.test(month||'');}
function validDay(date){return qualifications.date(date);}
function days(month){if(!validMonth(month))throw Error('Invalid roster month');const d=new Date(month+'-01T12:00:00Z');const result=[];while(d.toISOString().slice(0,7)===month){result.push(d.toISOString().slice(0,10));d.setUTCDate(d.getUTCDate()+1);}return result;}
function diffDays(a,b){return Math.round((Date.parse(a+'T12:00:00Z')-Date.parse(b+'T12:00:00Z'))/86400000);}
function patternOn(cycle,date){if(!cycle||!patterns[cycle.pattern]||!validDay(cycle.startDate))return null;return patterns[cycle.pattern][((diffDays(date,cycle.startDate)%6)+6)%6];}
function validateStart(status,start){if(status==='OFF')return start==null||start===''?null:invalid('Off days cannot have a start time');const range=ranges[status];if(!range)throw Error('Invalid shift type');if(start==null||start==='')return null;if(!/^([01]\d|2[0-3]):(00|30)$/.test(start))throw Error('Start time must use 30-minute increments');const [h,m]=start.split(':').map(Number),minutes=h*60+m;if(minutes<range[0]||minutes>range[1])throw Error('Start time is outside the '+status+' range');return start;}
function invalid(message){throw Error(message);}
function times(date,clock){const start=time.fromLocal(date+'T'+clock);const end=new Date(start.getTime()+510*60000);return {start:time.localInput(start).slice(0,16),end:time.localInput(end).slice(0,16)};}
function initialEntries(users,cycles,existing,month){const byCycle=new Map(cycles.map(c=>[String(c.userId),c]));const occupied=new Set(existing.map(s=>String(s.userId)+'|'+s.date));const entries=[],skipped=[];for(const u of users){const cycle=byCycle.get(String(u._id));if(!cycle){skipped.push({userId:String(u._id),name:u.name,reason:'No cycle configured'});continue;}for(const date of days(month)){if(occupied.has(String(u._id)+'|'+date))continue;entries.push({userId:u._id,date,status:patternOn(cycle,date),startTime:null,originalRevision:0,changed:false});}}return {entries,skipped};}
module.exports={patterns,ranges,validMonth,days,diffDays,patternOn,validateStart,times,initialEntries};
