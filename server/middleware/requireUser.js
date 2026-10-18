const jwt = require('jsonwebtoken');
const User = require('../models/User');
module.exports = async function requireUser(req, res, next) {
  const match = /^Bearer (.+)$/.exec(req.headers.authorization || '');
  if (!match) return res.status(401).json({ error:'Please sign in again' });
  let claims;
  try { claims = jwt.verify(match[1], process.env.JWT_SECRET); }
  catch { return res.status(401).json({ error:'Session expired. Please sign in again' }); }
  if (!/^[a-f\d]{24}$/i.test(String(claims.id || ''))) return res.status(401).json({ error:'Invalid session' });
  try {
    const user = await User.findById(claims.id).select('-passwordHash');
    if (!user || !user.active) return res.status(403).json({ error:'Account is inactive' });
    if ((claims.sessionVersion || 0) !== (user.sessionVersion || 0)) return res.status(401).json({error:'Session expired. Please sign in again'});
    req.user = user;
    next();
  } catch (error) { next(error); }
};
