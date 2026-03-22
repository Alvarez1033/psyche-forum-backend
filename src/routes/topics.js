const express = require('express');
const router = express.Router();
const { query } = require('../db/pool');

router.get('/', async (req, res) => {
  try {
    const result = await query('SELECT * FROM topics ORDER BY name ASC');
    res.json({ topics: result.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
