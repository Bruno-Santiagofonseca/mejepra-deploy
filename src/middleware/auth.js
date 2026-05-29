const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'centro360-dev-secret-change-in-production';
const db = require('../database');

function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, terreiro_id: user.terreiro_id, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function verifyToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    db.logAudit(null, null, 'UNAUTHORIZED', 'auth', null, JSON.stringify({ reason: 'no_token', path: req.path, ip: req.ip }), null).catch(() => {});
    return res.status(401).json({ error: 'Token n\u00e3o fornecido.' });
  }

  try {
    const decoded = jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
    req.user = decoded;
    next();
  } catch (e) {
    db.logAudit(null, null, 'UNAUTHORIZED', 'auth', null, JSON.stringify({ reason: 'invalid_token', path: req.path, ip: req.ip }), null).catch(() => {});
    return res.status(401).json({ error: 'Token inv\u00e1lido ou expirado.' });
  }
}

function optionalToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      req.user = jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
    } catch (e) {}
  }
  next();
}

module.exports = { generateToken, verifyToken, optionalToken, JWT_SECRET };
