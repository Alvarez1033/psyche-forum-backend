require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');

const app = express();
const server = http.createServer(app);

const allowedOrigins = process.env.CLIENT_URL
  ? process.env.CLIENT_URL.split(',').map(o => o.trim())
  : ['http://localhost:3000', 'http://localhost:4000'];

// Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: '*', credentials: false }));
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());
if (process.env.NODE_ENV !== 'production') app.use(morgan('dev'));

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200 });
app.use('/api/', limiter);

// Health
app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// Public community stats
app.get('/api/stats', async (req, res) => {
  try {
    const { query } = require('./db/pool');
    const [users, posts, topics] = await Promise.all([
      query('SELECT COUNT(*) as count FROM users'),
      query("SELECT COUNT(*) as count FROM posts WHERE status='approved'"),
      query('SELECT COUNT(*) as count FROM topics'),
    ]);
    const contributors = await query("SELECT COUNT(*) as count FROM users WHERE role IN ('contributor','author','editor','moderator','admin','superadmin')");
    res.json({
      members: parseInt(users.rows[0].count),
      discussions: parseInt(posts.rows[0].count),
      contributors: parseInt(contributors.rows[0].count),
      topics: parseInt(topics.rows[0].count),
    });
  } catch(e) { res.json({ members:0, discussions:0, contributors:0, topics:0 }); }
});

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/posts', require('./routes/posts'));
app.use('/api/comments', require('./routes/comments'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/search', require('./routes/search'));
app.use('/api/tickets', require('./routes/tickets'));
app.use('/api/topics', require('./routes/topics'));

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ error: process.env.NODE_ENV === 'development' ? err.message : 'Server error' });
});

const PORT = parseInt(process.env.PORT) || 3000;
server.listen(PORT, () => {
  console.log('\n🧠 Psyche Forum server running!');
  console.log(`   App:    http://localhost:${PORT}`);
  console.log(`   API:    http://localhost:${PORT}/api\n`);
});
