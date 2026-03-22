const express = require('express');
const router = express.Router();
const { query } = require('../db/pool');
const { authenticate } = require('../middleware/auth');

router.get('/me', authenticate, async (req, res) => {
  try {
    const result = await query(
      'SELECT id, username, email, name, bio, avatar_color, role, interests, banned, post_count, created_at FROM users WHERE id=$1',
      [req.user.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'User not found' });
    res.json({ user: result.rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:username', async (req, res) => {
  try {
    const result = await query(
      'SELECT id, username, name, bio, avatar_color, role, interests, post_count, created_at FROM users WHERE username=$1',
      [req.params.username]);
    if (!result.rows[0]) return res.status(404).json({ error: 'User not found' });
    const posts = await query(
      "SELECT id, title, topic, post_type, upvotes, comment_count, created_at FROM posts WHERE author_id=$1 AND status='approved' ORDER BY created_at DESC LIMIT 20",
      [result.rows[0].id]);
    res.json({ user: result.rows[0], posts: posts.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/me', authenticate, async (req, res) => {
  try {
    const { name, bio, avatar_color, interests } = req.body;
    const result = await query(`
      UPDATE users SET name=COALESCE($2,name), bio=COALESCE($3,bio),
        avatar_color=COALESCE($4,avatar_color), interests=COALESCE($5,interests), updated_at=NOW()
      WHERE id=$1 RETURNING id, username, name, bio, avatar_color, role, interests
    `, [req.user.id, name, bio, avatar_color, interests]);
    res.json({ user: result.rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
