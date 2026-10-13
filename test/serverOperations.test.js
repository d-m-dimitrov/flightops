const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const time = require('../client/js/operationalTime');
function load(relative, mocks) {
  const filename = path.join(__dirname, '..', relative);
  const module = { exports:{} }, realRequire = createRequire(filename);
  const context = { module, exports:module.exports, require:name => name in mocks ? mocks[name] : realRequire(name), console };
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), context, { filename });
  return module.exports;
}
function response() {
  return { statusCode:200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}
function handler(router, method, route) {
  return router.stack.find(layer => layer.route?.path === route && layer.route.methods[method]).route.stack[0].handle;
}
test('MGT rule normalization, explicit fallback, invalid and duplicate rules', async () => {
  let rules = [{ _id:'rule1', airline:' sq ', aircraftType:'a359', minimumGroundTime:90 }];
  const resolve = load('server/services/getTurnaroundRule.js', { '../models/TurnaroundRule':{ find:async () => rules } });
  const result = await resolve('SQ', ' A359 ');
  assert.equal(result.mgt, 90);assert.equal(result.mgtSource, 'rule');
  rules = [];assert.equal((await resolve('SQ', 'A359')).mgtSource, 'fallback');
  rules = [{ airline:'SQ', aircraftType:'A359', minimumGroundTime:-10 }];
  await assert.rejects(resolve('SQ', 'A359'), /positive/);
  rules = [{ airline:'SQ', aircraftType:'A359', minimumGroundTime:90 },{ airline:'sq', aircraftType:'a359', minimumGroundTime:75 }];
  await assert.rejects(resolve('SQ', 'A359'), /Duplicate/);
});
test('generator uses London Monday at UTC Sunday; snapshots overnight and MGT once', async () => {
  const writes = [], existing = new Set();
  const schedule = { _id:'s1', active:true, daysOfWeek:[1], airline:'SQ', aircraftType:'A359', sta:'23:30', std:'00:45', departureDayOffset:1 };
  const generate = load('server/services/turnaroundGenerator.js', {
    '../models/FlightSchedule':{ find:async () => [schedule] },
    '../models/Turnaround':{
      exists:async key => existing.has(key.operatingDate),
      updateOne:async (key, update, options) => { writes.push({ key, update, options });existing.add(key.operatingDate); }
    }, './getTurnaroundRule':async () => ({ mgt:90, mgtSource:'rule' }), '../../client/js/operationalTime':time
  });
  await generate(new Date('2026-06-28T23:30:00Z'));
  await generate(new Date('2026-06-28T23:31:00Z'));
  assert.equal(writes.length, 1);
  assert.equal(writes[0].key.operatingDate, '2026-06-29');
  assert.equal(writes[0].update.$setOnInsert.mgt, 90);
  assert.equal(writes[0].update.$setOnInsert.departure.stdAt.toISOString(), '2026-06-29T23:45:00.000Z');
  assert.equal(writes[0].options.upsert, true);
});
test('manual creation resolves MGT and rejects same-day STD before STA', async () => {
  let saved;
  const router = load('server/routes/flights.js', {
    '../models/Turnaround':{ create:async value => (saved = value) },
    '../services/getTurnaroundRule':async () => ({ mgt:90, mgtSource:'rule' })
  });
  const create = handler(router, 'post', '/');
  const req = { body:{ operatingDate:'2026-06-29', airline:'SQ', aircraftType:'A359', sta:'23:30', std:'00:45', departureDayOffset:1 } };
  const res = response();await create(req, res);
  assert.equal(saved.mgt, 90);
  assert.equal(saved.departure.stdAt.toISOString(), '2026-06-29T23:45:00.000Z');
  req.body.departureDayOffset = 0;
  const invalid = response();await create(req, invalid);assert.equal(invalid.statusCode, 400);
});
test('aircraft swap resolves new MGT; London edit preserves unchanged ETA instant', async () => {
  const flight = { _id:'f1', airline:'SQ', aircraft:{ aircraftType:'A359' }, arrival:{ eta:'2026-06-29T09:00:47Z' }, departure:{}, save:async () => {} };
  let resolved;
  const router = load('server/routes/flights.js', {
    '../models/Turnaround':{ findById:async () => flight },
    '../services/getTurnaroundRule':async (airline, type) => { resolved = type; return { mgt:110, mgtSource:'rule' }; },
    '../services/systemMessage':async () => {}
  });
  const req = { params:{ id:'f1' }, body:{ aircraftType:'B77W', eta:'2026-06-29T10:00', ata:'', etd:'' }, app:{ get:() => ({ to:() => ({ emit:() => {} }) }) } };
  await handler(router, 'put', '/:id/details')(req, response());
  assert.equal(resolved, 'B77W');assert.equal(flight.mgt, 110);
  assert.equal(flight.arrival.eta.toISOString(), '2026-06-29T09:00:47.000Z');
});
test('AIBT edit updates derivative timestamp before notifying all clients, without status regression', async () => {
  const calls = [];
  const event = { _id:'e1', turnaroundId:'f1', eventType:'ON_BLOCKS', eventTime:'2026-06-29T09:00:00Z', save:async () => calls.push('event') };
  const router = load('server/routes/events.js', {
    '../models/Event':{ findById:async () => event },
    '../models/Turnaround':{ updateOne:async (filter, update) => { calls.push('flight');assert.equal(update.$set['arrival.onBlocks'].toISOString(), '2026-06-29T09:20:00.000Z');assert.equal(update.$set.status, undefined); } }
  });
  const req = { params:{ id:'e1' }, body:{ eventTime:'2026-06-29T10:20', notes:'Corrected AIBT' }, app:{ get:() => ({ to:() => ({ emit:name => calls.push(name) }) }) } };
  const res = response();await handler(router, 'put', '/:id')(req, res);
  assert.deepEqual(calls, ['event', 'flight', 'flightUpdated']);
  assert.equal(res.statusCode, 200);
});
test('legacy view derives London dates and missing MGT without changing the stored object', async () => {
  const view = load('server/services/turnaroundView.js', {
    './getTurnaroundRule':async () => ({ mgt:90, mgtSource:'rule' })
  });
  const old = { operatingDate:'2026-06-29', airline:'SQ', aircraft:{ aircraftType:'A359' }, arrival:{ sta:'23:30' }, departure:{ std:'00:45' } };
  const result = await view(old);
  assert.equal(result.departure.stdAt.toISOString(), '2026-06-29T23:45:00.000Z');
  assert.equal(result.mgt, 90);
  assert.equal(old.departure.stdAt, undefined);assert.equal(old.mgt, undefined);
  old.mgt = 75;assert.equal((await view(old)).mgt, 75);
});
test('unique generation index is scoped to scheduled flights', async () => {
  let index;
  const ensure = require('../server/services/ensureTurnaroundIndex');
  await ensure({ collection:{ createIndex:async (fields, options) => { index = { fields, options }; } } });
  assert.deepEqual(index.fields, { scheduleId:1, operatingDate:1 });
  assert.equal(index.options.unique, true);
  assert.equal(index.options.partialFilterExpression.scheduleId.$type, 'objectId');
});
