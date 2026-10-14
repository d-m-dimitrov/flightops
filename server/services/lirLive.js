const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Lir = require('../models/Lir');
const Turnaround = require('../models/Turnaround');
const validate = require('./lirValidation');
const instances = new WeakMap();
const validId = id => typeof id === 'string' && /^[a-f\d]{24}$/i.test(id);
const room = id => `document:${id}`;

function attach(io) {
  const namespace = io.of('/lir-live');
  const drafts = new Map();
  function clear(id) {
    if (!drafts.delete(id)) return;
    namespace.to(room(id)).emit('draftCleared', { documentId:id });
  }
  instances.set(io, { drafts, clear });
  namespace.use(async (socket, next) => {
    try {
      const claims = jwt.verify(socket.handshake.auth?.token, process.env.JWT_SECRET);
      if (!validId(claims.id)) throw new Error();
      const user = await User.findById(claims.id).select('-passwordHash');
      if (!user?.active || !validate.permissions(user).view) throw new Error();
      socket.data.userId = claims.id;
      socket.data.expiresAt = claims.exp * 1000;
      if (!Number.isFinite(socket.data.expiresAt)) throw new Error();
      next();
    } catch { next(new Error('Sign in with an active OPS or RAMP account for live LIR')); }
  });
  namespace.on('connection', socket => {
    let joined = null, chain = Promise.resolve(), lastUpdate = 0;
    const expiry = setTimeout(() => socket.disconnect(true), Math.min(2147483647, Math.max(0,socket.data.expiresAt-Date.now())));
    expiry.unref?.();
    function release() { if (joined && drafts.get(joined)?.owner === socket.id) clear(joined); }
    function on(name, handler) {
      socket.on(name, (body, ack) => {
        chain = chain.then(async () => {
          if (!socket.connected) return;
          try { const result = await handler(body || {}); if (typeof ack === 'function') ack({ ok:true, ...result }); }
          catch (error) { if (typeof ack === 'function') ack({ ok:false, error:error.message }); }
        });
      });
    }
    async function user() {
      if (Date.now() >= socket.data.expiresAt) throw new Error('Session expired');
      const current = await User.findById(socket.data.userId).select('-passwordHash');
      if (!current?.active || !validate.permissions(current).view) throw new Error('LIR access denied');
      return current;
    }
    on('watch', async body => {
      await user();
      if (!validId(body.documentId)) throw new Error('Invalid document');
      const doc = await Lir.findById(body.documentId).select('turnaroundId');
      if (!doc || !await Turnaround.exists({ _id:doc.turnaroundId, deleted:{ $ne:true } })) throw new Error('LIR not found');
      release(); if (joined) await socket.leave(room(joined));
      joined = body.documentId;
      await socket.join(room(joined));
      const draft = drafts.get(joined);
      if (draft && draft.expires > Date.now()) socket.emit('draft',draft.payload);
      else clear(joined);
    });
    on('leave', async () => { release(); if (joined) await socket.leave(room(joined)); joined=null; });
    on('draft', async body => {
      if (!joined || body.documentId !== joined) throw new Error('Open this LIR before sharing');
      if (Date.now()-lastUpdate < 100) return { retry:true }; // Bound database work for pointer bursts.
      lastUpdate = Date.now();
      const currentUser = await user();
      if (!validate.permissions(currentUser).annotate) throw new Error('Only RAMP can share annotations');
      const clean = validate.annotations({ expectedVersion:body.expectedVersion, complete:false, annotations:body.annotations, signature:[] });
      const doc = await Lir.findById(joined).select('turnaroundId annotationVersion status');
      if (!doc || doc.status === 'COMPLETED' || doc.annotationVersion !== body.expectedVersion) throw new Error('Saved LIR changed. Export your local draft, then refresh.');
      const latest = await Lir.findOne({ turnaroundId:doc.turnaroundId }).sort({ revision:-1 }).select('_id');
      if (String(latest?._id) !== joined || !await Turnaround.exists({ _id:doc.turnaroundId, deleted:{ $ne:true } })) throw new Error('LIR was replaced or removed');
      if (!socket.connected) return;
      if (drafts.get(joined)?.payload.expectedVersion !== doc.annotationVersion) clear(joined);
      const existing = drafts.get(joined);
      if (existing && existing.expires > Date.now() && existing.owner !== socket.id) throw new Error('Another RAMP operator is editing live. Export your local draft, then refresh.');
      const payload = { documentId:joined, expectedVersion:body.expectedVersion, author:currentUser.name,
        owner:socket.id, annotations:clean.annotations };
      drafts.set(joined, { owner:socket.id, flightId:String(doc.turnaroundId), expires:Date.now()+30000, payload });
      socket.to(room(joined)).emit('draft',payload);
    });
    on('release', async () => release());
    socket.on('disconnect', () => { clearTimeout(expiry); release(); });
  });
  const timer = setInterval(() => { for (const [id,draft] of drafts) if (draft.expires <= Date.now()) clear(id); }, 5000);
  timer.unref?.();
  return () => clearInterval(timer);
}
function clearFlight(io, flightId) {
  const instance = instances.get(io);
  if (instance) for (const [id,draft] of instance.drafts) if (draft.flightId === String(flightId)) instance.clear(id);
}
module.exports = { attach, clearFlight };
