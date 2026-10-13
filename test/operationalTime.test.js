const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const time = require('../client/js/operationalTime');

test('London winter/summer and operating date around midnight', () => {
  assert.equal(time.fromLocal('2026-06-29T12:00').toISOString(), '2026-06-29T11:00:00.000Z');
  assert.equal(time.fromLocal('2026-01-29T12:00').toISOString(), '2026-01-29T12:00:00.000Z');
  assert.equal(time.operatingDate('2026-06-28T23:30:00Z'), '2026-06-29');
});
test('reject invalid dates, spring gap and unresolved autumn fold', () => {
  for (const value of ['2026-02-30T12:00', '2026-06-29T25:00', '2026-03-29T01:30']) {
    assert.throws(() => time.fromLocal(value));
  }
  assert.throws(() => time.fromLocal('2026-10-25T01:30'), /twice/);
  assert.equal(time.fromLocal('2026-10-25T01:30', 'earlier').toISOString(), '2026-10-25T00:30:00.000Z');
  assert.equal(time.fromLocal('2026-10-25T01:30', 'later').toISOString(), '2026-10-25T01:30:00.000Z');
});
test('normal, delayed, exact-boundary and overnight turnarounds', () => {
  const std = '2026-06-29T12:00:00Z';
  const normal = time.departurePlan(std, '2026-06-29T10:00:00Z', 75);
  assert.equal(normal.ready.toISOString(), '2026-06-29T11:15:00.000Z');
  assert.equal(normal.target.toISOString(), std.replace('Z', '.000Z'));
  assert.equal(normal.buffer, 45);
  const late = time.departurePlan(std, '2026-06-29T11:10:00Z', 75);
  assert.equal(late.delay, 25);
  assert.equal(late.mode, 'GROUND');
  assert.equal(time.departurePlan(std, '2026-06-29T10:45:00Z', 75).buffer, 0);
  const night = time.scheduleTimes('2026-06-29', '23:30', '00:45', 1);
  assert.equal(night.stdAt.toISOString(), '2026-06-29T23:45:00.000Z');
  assert.equal(night.stdAt - night.staAt, 75 * 60000);
  assert.equal(time.scheduleTimes('2026-06-29', '23:30', '00:45').departureDayOffset, 1);
  assert.throws(() => time.scheduleTimes('2026-06-29', '23:30', '00:45', 0));
  for (const mgt of [-15, 0, NaN, '75', 1.5]) assert.equal(time.departurePlan(std, std, mgt), null);
});
test('MGT is elapsed time across autumn clock change', () => {
  const aibt = time.fromLocal('2026-10-25T01:30', 'earlier').toISOString();
  const plan = time.departurePlan('2026-10-25T03:00:00Z', aibt, 75);
  assert.equal(plan.ready.toISOString(), '2026-10-25T01:45:00.000Z');
  assert.equal(time.localInput(plan.ready), '2026-10-25T01:45:00');
});
test('unchanged inputs preserve exact existing instants, including the fold', () => {
  const original = '2026-10-25T01:30:47Z';
  assert.equal(time.editedTime('2026-10-25T01:30', original).toISOString(), '2026-10-25T01:30:47.000Z');
  assert.equal(time.editedTime('2026-10-25T01:30', original, 'earlier').toISOString(), '2026-10-25T00:30:00.000Z');
  assert.equal(time.editedTime('2026-06-29T12:00', '2026-06-29T10:00:00Z').toISOString(), '2026-06-29T11:00:00.000Z');
});
test('same results with UTC, London, Sofia and New York host settings', () => {
  const code = `const t=require('./client/js/operationalTime');console.log(JSON.stringify([t.scheduleTimes('2026-06-29','23:30','00:45',1),t.operatingDate('2026-06-28T23:30:00Z')]));`;
  const values = ['UTC', 'Europe/London', 'Europe/Sofia', 'America/New_York'].map(TZ =>
    execFileSync(process.execPath, ['-e', code], { cwd:require('node:path').join(__dirname, '..'), env:{ ...process.env, TZ }, encoding:'utf8' }));
  assert.ok(values.every(value => value === values[0]));
});
