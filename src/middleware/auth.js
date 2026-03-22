const jwt = require('jsonwebtoken');
const { query } = require('../db/pool');
const { roleLevel } = require('../config/roles');

async function authenticate(req, res, next) {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '') || req.cookies?.access_token;
    if (!token) return res.status(401).json({ error: 'Authentication required' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const result = await query('SELECT id, username, email, name, role, banned FROM users WHERE id=$1', [decoded.userId]);
    if (!result.rows[0]) return res.status(401).json({ error: 'User not found' });
    if (result.rows[0].banned) return res.status(403).json({ error: 'Account banned' });
    req.user = result.rows[0];
    next();
  } catch (err) { res.status(401).json({ error: 'Invalid token' }); }
}

async function optionalAuth(req, res, next) {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const result = await query('SELECT id, username, role FROM users WHERE id=$1', [decoded.userId]);
      if (result.rows[0]) req.user = result.rows[0];
    }
  } catch {}
  next();
}

function requireMod(req, res, next) { roleLevel(req.user?.role) >= 6 ? next() : res.status(403).json({ error: 'Moderator access required' }); }
function requireAdmin(req, res, next) { roleLevel(req.user?.role) >= 8 ? next() : res.status(403).json({ error: 'Admin access required' }); }
function requireSupport(req, res, next) { roleLevel(req.user?.role) >= 7 ? next() : res.status(403).json({ error: 'Staff access required' }); }
function requireAuth(req, res, next) { req.user ? next() : res.status(401).json({ error: 'Authentication required' }); }

module.exports = { authenticate, optionalAuth, requireAuth, requireMod, requireAdmin, requireSupport };
