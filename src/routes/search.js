const express = require('express');
const router = express.Router();
const { query } = require('../db/pool');

router.get('/', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q?.trim()) return res.json({ posts: [], users: [] });
    const term = `%${q.trim()}%`;
    const posts = await query(`
      SELECT p.*, u.username, u.name, u.avatar_color FROM posts p
      JOIN users u ON p.author_id = u.id
      WHERE p.status='approved' AND (p.title ILIKE $1 OR p.body ILIKE $1 OR p.topic ILIKE $1)
      ORDER BY p.created_at DESC LIMIT 20
    `, [term]);
    const users = await query(`
      SELECT id, username, name, bio, avatar_color, role FROM users
      WHERE username ILIKE $1 OR name ILIKE $1 LIMIT 10
    `, [term]);
    res.json({ posts: posts.rows, users: users.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
