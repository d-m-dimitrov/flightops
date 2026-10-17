const test=require('node:test'),assert=require('node:assert/strict');
const planning=require('../server/services/rosterPlanning');
test('individual six-day patterns respect cycle anchor, including dates before anchor',()=>{
 const early={pattern:'EELL00',startDate:'2026-10-05'};
 assert.deepEqual(['2026-10-05','2026-10-06','2026-10-07','2026-10-08','2026-10-09','2026-10-10'].map(d=>planning.patternOn(early,d)),['EARLY','EARLY','LATE','LATE','OFF','OFF']);
 assert.equal(planning.patternOn(early,'2026-10-04'),'OFF');
 assert.equal(planning.patternOn({pattern:'LLLL00',startDate:'2026-10-05'},'2026-10-08'),'LATE');
});
test('draft generation does not choose start times or overwrite existing shifts/absence',()=>{
 const users=[{_id:'a',name:'A'},{_id:'b',name:'B'}],cycles=[{userId:'a',pattern:'EELL00',startDate:'2026-10-01'},{userId:'b',pattern:'LLLL00',startDate:'2026-10-02'}];
 const existing=[{userId:'a',date:'2026-10-01',status:'ABSENT'},{userId:'b',date:'2026-10-03',status:'WORKING'}];
 const output=planning.initialEntries(users,cycles,existing,'2026-10');
 assert.equal(output.entries.length,60);
 assert.ok(output.entries.every(e=>e.startTime===null));
 assert.ok(!output.entries.some(e=>e.userId==='a'&&e.date==='2026-10-01'));
 assert.ok(!output.entries.some(e=>e.userId==='b'&&e.date==='2026-10-03'));
});
test('validates every 30-minute start slot and calculates 8h30 in London',()=>{
 for(const [type,first,last] of [['EARLY','04:30','06:00'],['DAY','08:00','11:30'],['LATE','12:00','15:00']]){
 assert.equal(planning.validateStart(type,first),first);
 assert.equal(planning.validateStart(type,last),last);
 }
 assert.throws(()=>planning.validateStart('EARLY','06:30'),/outside/);
 assert.throws(()=>planning.validateStart('LATE','12:15'),/30-minute/);
 assert.equal(planning.times('2026-10-17','04:30').end,'2026-10-17T13:00');
 assert.equal(planning.times('2026-03-29','04:30').end,'2026-03-29T13:00');
 assert.equal(planning.days('2026-02').length,28);
});
