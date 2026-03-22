const express = require('express');
const router = express.Router();
router.get('/posts', async (req, res) => { res.json({ posts: [] }); });
module.exports = router;
