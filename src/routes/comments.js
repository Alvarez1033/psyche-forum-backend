const express = require('express');
const router = express.Router();
const { query } = require('../db/pool');
const { authenticate, optionalAuth } = require('../middleware/auth');

router.get('/post/:postId', async (req, res) => {
  try {
    const result = await query(`
      SELECT c.*, u.username, u.name, u.avatar_color, u.role
      FROM comments c JOIN users u ON c.author_id = u.id
      WHERE c.post_id = $1 ORDER BY c.created_at ASC
    `, [req.params.postId]);
    res.json({ comments: result.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', authenticate, async (req, res) => {
  try {
    const { post_id, body, parent_id } = req.body;
    if (!body?.trim()) return res.status(400).json({ error: 'Comment body required' });
    const result = await query(`
      INSERT INTO comments (post_id, author_id, body, parent_id)
      VALUES ($1, $2, $3, $4) RETURNING *
    `, [post_id, req.user.id, body.trim(), parent_id || null]);
    await query('UPDATE posts SET comment_count = comment_count + 1 WHERE id = $1', [post_id]);
    res.status(201).json({ comment: result.rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', authenticate, async (req, res) => {
  try {
    const c = await query('SELECT * FROM comments WHERE id = $1', [req.params.id]);
    if (!c.rows[0]) return res.status(404).json({ error: 'Not found' });
    if (c.rows[0].author_id !== req.user.id && !['admin','superadmin','moderator'].includes(req.user.role))
      return res.status(403).json({ error: 'Forbidden' });
    await query('DELETE FROM comments WHERE id = $1', [req.params.id]);
    await query('UPDATE posts SET comment_count = GREATEST(comment_count - 1, 0) WHERE id = $1', [c.rows[0].post_id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
