const express = require('express');
const { query } = require('../db/pool');
const { authenticate } = require('../middleware/auth');
const { roleLevel } = require('../config/roles');

const router = express.Router();

// Require at least support role
router.use(authenticate, (req, res, next) => {
  if (!['support','moderator','admin','superadmin'].includes(req.user.role))
    return res.status(403).json({ error: 'Admin access required' });
  next();
});

// Dashboard stats
router.get('/stats', async (req, res) => {
  try {
    const [users, posts, tickets] = await Promise.all([
      query("SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24h') as today FROM users"),
      query("SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status='pending') as pending, COUNT(*) FILTER (WHERE status='approved') as approved FROM posts"),
      query("SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status='open') as open FROM support_tickets"),
    ]);
    res.json({ users: users.rows[0], posts: posts.rows[0], tickets: tickets.rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// User management
router.get('/users', async (req, res) => {
  try {
    const { search, role } = req.query;
    let sql = 'SELECT id, username, email, name, role, banned, post_count, created_at FROM users';
    const params = [];
    const conds = [];
    if (search) { params.push(`%${search}%`); conds.push(`(username ILIKE $${params.length} OR email ILIKE $${params.length} OR name ILIKE $${params.length})`); }
    if (role) { params.push(role); conds.push(`role = $${params.length}`); }
    if (conds.length) sql += ' WHERE ' + conds.join(' AND ');
    sql += ' ORDER BY created_at DESC LIMIT 100';
    const result = await query(sql, params);
    res.json({ users: result.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Change user role
router.patch('/users/:id/role', async (req, res) => {
  try {
    if (!['admin','superadmin'].includes(req.user.role))
      return res.status(403).json({ error: 'Only admins can change roles' });
    const { role, reason } = req.body;
    const target = await query('SELECT id, role FROM users WHERE id=$1', [req.params.id]);
    if (!target.rows[0]) return res.status(404).json({ error: 'User not found' });
    if (roleLevel(target.rows[0].role) >= roleLevel(req.user.role))
      return res.status(403).json({ error: 'Cannot modify user at or above your level' });
    await query('UPDATE users SET role=$1, updated_at=NOW() WHERE id=$2', [role, req.params.id]);
    await query('INSERT INTO role_changes (target_id, changed_by, old_role, new_role, reason) VALUES ($1,$2,$3,$4,$5)',
      [req.params.id, req.user.id, target.rows[0].role, role, reason||null]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Ban/unban user
router.patch('/users/:id/ban', async (req, res) => {
  try {
    if (!['moderator','admin','superadmin'].includes(req.user.role))
      return res.status(403).json({ error: 'Forbidden' });
    const { banned, reason } = req.body;
    await query('UPDATE users SET banned=$1, ban_reason=$2, updated_at=NOW() WHERE id=$3',
      [banned, reason||null, req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Pending posts
router.get('/posts/pending', async (req, res) => {
  try {
    const result = await query(`
      SELECT p.*, u.username, u.name FROM posts p
      JOIN users u ON p.author_id = u.id WHERE p.status='pending' ORDER BY p.created_at ASC
    `);
    res.json({ posts: result.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Moderate post
router.patch('/posts/:id/moderate', async (req, res) => {
  try {
    const { action } = req.body;
    let status;
    if (action === 'approve') status = 'approved';
    else if (action === 'reject' || action === 'ghost') status = action === 'ghost' ? 'ghosted' : 'deleted';
    else if (action === 'needs_review') status = 'needs_review';
    else return res.status(400).json({ error: 'Invalid action' });
    await query('UPDATE posts SET status=$1, approved_by=$2, approved_at=NOW(), updated_at=NOW() WHERE id=$3',
      [status, req.user.id, req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Role change history
router.get('/role-history', async (req, res) => {
  try {
    const result = await query(`
      SELECT rc.*, u1.username as target_username, u2.username as changed_by_username
      FROM role_changes rc
      JOIN users u1 ON rc.target_id = u1.id
      JOIN users u2 ON rc.changed_by = u2.id
      ORDER BY rc.created_at DESC LIMIT 50
    `);
    res.json({ history: result.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
