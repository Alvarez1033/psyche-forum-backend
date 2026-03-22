const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../db/pool');

function generateTokens(userId) {
  const access = jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '15m' });
  const refresh = jwt.sign({ userId }, process.env.JWT_REFRESH_SECRET, { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' });
  return { access, refresh };
}

router.post('/signup', async (req, res) => {
  try {
    const { username, email, password, name } = req.body;
    if (!username?.trim() || !email?.trim() || !password) return res.status(400).json({ error: 'All fields required' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
    const exists = await query('SELECT id FROM users WHERE email=$1 OR username=$2', [email.toLowerCase(), username.trim()]);
    if (exists.rows.length) return res.status(409).json({ error: 'Email or username already taken' });
    const hash = await bcrypt.hash(password, 10);
    const result = await query(
      'INSERT INTO users (username, email, password_hash, name) VALUES ($1,$2,$3,$4) RETURNING id, username, email, name, role, avatar_color',
      [username.trim(), email.toLowerCase(), hash, name || username]);
    const tokens = generateTokens(result.rows[0].id);
    res.status(201).json({ user: result.rows[0], accessToken: tokens.access, refreshToken: tokens.refresh });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    const result = await query('SELECT * FROM users WHERE email=$1', [email.toLowerCase()]);
    if (!result.rows[0]) return res.status(401).json({ error: 'Invalid credentials' });
    if (result.rows[0].banned) return res.status(403).json({ error: 'Account banned' });
    const valid = await bcrypt.compare(password, result.rows[0].password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
    const tokens = generateTokens(result.rows[0].id);
    const { password_hash, ...user } = result.rows[0];
    res.json({ user, accessToken: tokens.access, refreshToken: tokens.refresh });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ error: 'Refresh token required' });
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const result = await query('SELECT id, username, email, name, role FROM users WHERE id=$1', [decoded.userId]);
    if (!result.rows[0]) return res.status(401).json({ error: 'User not found' });
    const tokens = generateTokens(result.rows[0].id);
    res.json({ user: result.rows[0], accessToken: tokens.access, refreshToken: tokens.refresh });
  } catch (err) { res.status(401).json({ error: 'Invalid refresh token' }); }
});

router.post('/admin-setup', async (req, res) => {
  try {
    const { email, setupKey } = req.body;
    if (setupKey !== process.env.ADMIN_SETUP_KEY) return res.status(403).json({ error: 'Invalid setup key' });
    await query("UPDATE users SET role='superadmin' WHERE email=$1", [email]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
