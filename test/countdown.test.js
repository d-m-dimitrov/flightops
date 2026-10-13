const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const time = require('../client/js/operationalTime');
const source = fs.readFileSync(require('node:path').join(__dirname, '../client/js/dashboard.js'), 'utf8');
function harness() {
  const elements = Object.fromEntries(['countdownValue','countdownTitle','countdownInfo','predictionPanel'].map(id => [id, { textContent:'' }]));
  const intervals = new Map(), listeners = {}, socketListeners = {};
  let id = 0;
  const ctx = { OperationalTime:time, currentFlight:null, currentEvents:[], countdownInterval:null,
    dashboardActive:true, refreshVersion:0, flightId:'f1', loadFlight:() => {},
    document:{ getElementById:id => elements[id] },
    window:{ addEventListener:(name, callback) => listeners[name] = callback },
    socket:{ on:(name, callback) => socketListeners[name] = callback, emit:() => {} },
    setInterval:callback => { intervals.set(++id, callback); return id; },
    clearInterval:id => intervals.delete(id), Date:class extends Date { static now() { return Date.parse('2026-06-29T10:00:00Z'); } }
  };
  vm.createContext(ctx);
  vm.runInContext(source.slice(source.indexOf('function stopCountdown()'), source.indexOf('\nloadFlight();', source.indexOf('function stopCountdown()'))), ctx);
  return { ctx, elements, intervals, listeners };
}
test('LANDED starts taxi-in; ON_BLOCKS transitions to departure; pushback stops interval', () => {
  const { ctx:c, elements:e, intervals } = harness();
  c.currentFlight = { status:'ARRIVING', departure:{ stdAt:'2026-06-29T12:00:00Z' }, mgt:75 };
  c.currentEvents = [{ eventType:'LANDED', eventTime:'2026-06-29T09:53:00Z' }];
  c.startCountdown();
  assert.equal(e.countdownTitle.textContent, 'Taxi In');
  assert.equal(e.countdownValue.textContent, '00:07:00');
  c.currentEvents.push({ eventType:'ON_BLOCKS', eventTime:'2026-06-29T10:00:00Z' });
  c.startCountdown();c.startCountdown();
  assert.equal(intervals.size, 1);
  assert.equal(e.countdownValue.textContent, '02:00:00');
  assert.match(e.predictionPanel.textContent, /Buffer 45/);
  c.currentEvents.push({ eventType:'PUSHBACK' });
  [...intervals.values()][0]();
  assert.equal(intervals.size, 0);
  assert.equal(e.countdownValue.textContent, 'Pushback');
  assert.equal(e.predictionPanel.textContent, '');
});
test('cancel, missing DOM, invalid time, and pagehide leave no interval', () => {
  const { ctx:c, elements:e, intervals, listeners } = harness();
  c.currentFlight = { status:'CANCELLED' };
  c.startCountdown();assert.equal(intervals.size, 0);
  c.currentFlight = { arrival:{ eta:'bad-time' } };
  c.startCountdown();assert.equal(intervals.size, 0);
  c.currentFlight.arrival.eta = '2026-06-29T11:00:00Z';
  c.startCountdown();assert.equal(intervals.size, 1);
  listeners.pagehide();assert.equal(intervals.size, 0);
  c.dashboardActive = true;delete e.countdownValue;
  c.startCountdown();assert.equal(intervals.size, 0);
});
test('late older refresh cannot overwrite a newer snapshot', async () => {
  const { ctx:c } = harness();
  const pending = [];
  c.fetch = () => new Promise(resolve => pending.push(resolve));
  c.stopCountdown = () => {};
  // Execute real request/sequence logic with a minimal render body.
  const prefix = source.slice(source.indexOf('async function loadFlight()'), source.indexOf('let readinessClass', source.indexOf('async function loadFlight()')));
  vm.runInContext(prefix + '\n}', c);
  const first = c.loadFlight(), second = c.loadFlight();
  pending[1]({ ok:true, json:async () => ({ flight:{ _id:'new' }, events:[{ eventType:'ON_BLOCKS' }] }) });
  await second;
  pending[0]({ ok:true, json:async () => ({ flight:{ _id:'old' }, events:[] }) });
  await first;
  assert.equal(c.currentFlight._id, 'new');
  assert.equal(c.currentEvents.length, 1);
});
