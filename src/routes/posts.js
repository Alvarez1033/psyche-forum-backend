const express = require('express');
const router = express.Router();
const { query } = require('../db/pool');
const { authenticate, optionalAuth } = require('../middleware/auth');

router.get('/', async (req, res) => {
  try {
    const { topic, kind, type, status, sort } = req.query;
    let sql = `SELECT p.*, u.username, u.name, u.avatar_color, u.role as author_role
               FROM posts p JOIN users u ON p.author_id = u.id WHERE p.status = 'approved'`;
    const params = [];
    if (topic) { params.push(topic); sql += ` AND p.topic = $${params.length}`; }
    if (kind) { params.push(kind); sql += ` AND p.post_kind = $${params.length}`; }
    if (type) { params.push(type); sql += ` AND p.post_type = $${params.length}`; }
    sql += sort === 'top' ? ' ORDER BY p.upvotes DESC' : ' ORDER BY p.pinned DESC, p.created_at DESC';
    sql += ' LIMIT 50';
    const result = await query(sql, params);
    res.json({ posts: result.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/pending', authenticate, async (req, res) => {
  try {
    if (!['editor','moderator','admin','superadmin'].includes(req.user.role))
      return res.status(403).json({ error: 'Forbidden' });
    const result = await query(`
      SELECT p.*, u.username, u.name FROM posts p JOIN users u ON p.author_id = u.id
      WHERE p.status = 'pending' ORDER BY p.created_at ASC
    `);
    res.json({ posts: result.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await query(`
      SELECT p.*, u.username, u.name, u.avatar_color, u.role as author_role, u.bio as author_bio
      FROM posts p JOIN users u ON p.author_id = u.id WHERE p.id = $1
    `, [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Post not found' });
    res.json({ post: result.rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', authenticate, async (req, res) => {
  try {
    const { title, body, topic, post_type, post_kind, sections, cover_image } = req.body;
    if (!title?.trim() || !body?.trim()) return res.status(400).json({ error: 'Title and body required' });
    const autoApprove = ['editor','moderator','admin','superadmin','author','contributor'].includes(req.user.role);
    const status = autoApprove ? 'approved' : 'pending';
    const result = await query(`
      INSERT INTO posts (author_id, title, body, topic, post_type, post_kind, status, sections, cover_image, approved_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *
    `, [req.user.id, title.trim(), body.trim(), topic, post_type||'discussion', post_kind||'forum', status,
        sections ? JSON.stringify(sections) : null, cover_image, autoApprove ? new Date() : null]);
    await query('UPDATE users SET post_count = post_count + 1 WHERE id = $1', [req.user.id]);
    res.status(201).json({ post: result.rows[0], autoApproved: autoApprove });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/:id/status', authenticate, async (req, res) => {
  try {
    if (!['editor','moderator','admin','superadmin'].includes(req.user.role))
      return res.status(403).json({ error: 'Forbidden' });
    const { status } = req.body;
    const updates = { status };
    if (status === 'approved') { updates.approved_by = req.user.id; updates.approved_at = new Date(); }
    const result = await query(`
      UPDATE posts SET status=$1, approved_by=$2, approved_at=$3, updated_at=NOW() WHERE id=$4 RETURNING *
    `, [status, updates.approved_by||null, updates.approved_at||null, req.params.id]);
    res.json({ post: result.rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/vote', authenticate, async (req, res) => {
  try {
    const { vote_type } = req.body;
    const existing = await query('SELECT * FROM votes WHERE user_id=$1 AND target_id=$2 AND target_type=\'post\'', [req.user.id, req.params.id]);
    if (existing.rows[0]) {
      if (existing.rows[0].vote_type === vote_type) {
        await query('DELETE FROM votes WHERE id=$1', [existing.rows[0].id]);
        await query(`UPDATE posts SET ${vote_type === 'up' ? 'upvotes = upvotes - 1' : 'downvotes = downvotes - 1'} WHERE id=$1`, [req.params.id]);
        return res.json({ action: 'removed' });
      }
      await query('UPDATE votes SET vote_type=$1 WHERE id=$2', [vote_type, existing.rows[0].id]);
      const inc = vote_type === 'up' ? 'upvotes = upvotes+1, downvotes = downvotes-1' : 'downvotes = downvotes+1, upvotes = upvotes-1';
      await query(`UPDATE posts SET ${inc} WHERE id=$1`, [req.params.id]);
      return res.json({ action: 'changed' });
    }
    await query('INSERT INTO votes (user_id,target_id,target_type,vote_type) VALUES ($1,$2,\'post\',$3)', [req.user.id, req.params.id, vote_type]);
    await query(`UPDATE posts SET ${vote_type === 'up' ? 'upvotes=upvotes+1' : 'downvotes=downvotes+1'} WHERE id=$1`, [req.params.id]);
    res.json({ action: 'voted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', authenticate, async (req, res) => {
  try {
    const post = await query('SELECT * FROM posts WHERE id=$1', [req.params.id]);
    if (!post.rows[0]) return res.status(404).json({ error: 'Not found' });
    if (post.rows[0].author_id !== req.user.id && !['moderator','admin','superadmin'].includes(req.user.role))
      return res.status(403).json({ error: 'Forbidden' });
    await query('DELETE FROM posts WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
