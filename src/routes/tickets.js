const express = require('express');
const router = express.Router();
const { query } = require('../db/pool');
const { authenticate } = require('../middleware/auth');

router.get('/', authenticate, async (req, res) => {
  try {
    const isStaff = ['support','moderator','admin','superadmin'].includes(req.user.role);
    const result = isStaff
      ? await query('SELECT t.*, u.username FROM support_tickets t JOIN users u ON t.user_id = u.id ORDER BY t.created_at DESC')
      : await query('SELECT * FROM support_tickets WHERE user_id = $1 ORDER BY created_at DESC', [req.user.id]);
    res.json({ tickets: result.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', authenticate, async (req, res) => {
  try {
    const { subject, body, category, priority } = req.body;
    if (!subject?.trim() || !body?.trim()) return res.status(400).json({ error: 'Subject and body required' });
    const result = await query(`
      INSERT INTO support_tickets (user_id, subject, body, category, priority)
      VALUES ($1, $2, $3, $4, $5) RETURNING *
    `, [req.user.id, subject.trim(), body.trim(), category || null, priority || 'medium']);
    res.status(201).json({ ticket: result.rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/:id/status', authenticate, async (req, res) => {
  try {
    if (!['support','moderator','admin','superadmin'].includes(req.user.role))
      return res.status(403).json({ error: 'Forbidden' });
    const { status } = req.body;
    const result = await query('UPDATE support_tickets SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *', [status, req.params.id]);
    res.json({ ticket: result.rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/:id/assign', authenticate, async (req, res) => {
  try {
    if (!['support','moderator','admin','superadmin'].includes(req.user.role))
      return res.status(403).json({ error: 'Forbidden' });
    const result = await query('UPDATE support_tickets SET assigned_to = $1, status = \'in_progress\', updated_at = NOW() WHERE id = $2 RETURNING *',
      [req.user.id, req.params.id]);
    res.json({ ticket: result.rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id/replies', authenticate, async (req, res) => {
  try {
    const result = await query(`
      SELECT r.*, u.username, u.role FROM ticket_replies r
      JOIN users u ON r.author_id = u.id WHERE r.ticket_id = $1 ORDER BY r.created_at ASC
    `, [req.params.id]);
    res.json({ replies: result.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/replies', authenticate, async (req, res) => {
  try {
    const { body, is_internal } = req.body;
    const result = await query(`
      INSERT INTO ticket_replies (ticket_id, author_id, body, is_internal)
      VALUES ($1, $2, $3, $4) RETURNING *
    `, [req.params.id, req.user.id, body, is_internal || false]);
    res.status(201).json({ reply: result.rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
