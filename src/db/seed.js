require('dotenv').config();
const { pool } = require('./pool');
const bcrypt = require('bcryptjs');

async function seed() {
  const client = await pool.connect();
  try {
    console.log('🌱 Seeding Psyche Forum...');
    const hash = await bcrypt.hash('admin123', 10);
    const userHash = await bcrypt.hash('password123', 10);

    // Admin
    await client.query(`
      INSERT INTO users (username, email, password_hash, name, bio, role, avatar_color)
      VALUES ('admin', 'admin@psycheforum.com', $1, 'Psyche Admin', 'Platform administrator', 'superadmin', '#6366f1')
      ON CONFLICT (email) DO NOTHING
    `, [hash]);

    // Sample users
    const users = [
      { u:'DrMayaCBT', e:'maya@example.com', n:'Dr. Maya Chen', b:'Clinical psychologist specializing in CBT and anxiety disorders.', r:'verified', c:'#0ea5e9', i:'{CBT,Anxiety,Depression}' },
      { u:'NeuroNate', e:'nate@example.com', n:'Nathan Torres, PhD', b:'Neuroscience researcher studying memory and cognition.', r:'contributor', c:'#8b5cf6', i:'{Neuroscience,Cognition,Memory}' },
      { u:'MindfulSara', e:'sara@example.com', n:'Sara Williams', b:'Mindfulness practitioner and mental health advocate.', r:'member', c:'#10b981', i:'{Mindfulness,Self-Esteem,Meditation}' },
      { u:'TraumaDoc', e:'james@example.com', n:'Dr. James Park', b:'Trauma specialist and EMDR therapist.', r:'author', c:'#f59e0b', i:'{Trauma,PTSD,EMDR}' },
      { u:'PsychStudent', e:'lily@example.com', n:'Lily Andersson', b:'Graduate student in clinical psychology.', r:'member', c:'#ec4899', i:'{Depression,Relationships,Self-Esteem}' },
    ];

    for (const u of users) {
      await client.query(`
        INSERT INTO users (username, email, password_hash, name, bio, role, avatar_color, interests)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (email) DO NOTHING
      `, [u.u, u.e, userHash, u.n, u.b, u.r, u.c, u.i]);
    }

    // Topics
    const topics = [
      ['Anxiety','anxiety','Mental Health','#ef4444'],
      ['Depression','depression','Mental Health','#3b82f6'],
      ['Trauma & PTSD','trauma-ptsd','Mental Health','#f59e0b'],
      ['Mindfulness','mindfulness','Wellness','#10b981'],
      ['CBT','cbt','Therapy','#8b5cf6'],
      ['Relationships','relationships','Social','#ec4899'],
      ['Neuroscience','neuroscience','Science','#6366f1'],
      ['Self-Esteem','self-esteem','Wellness','#f97316'],
      ['Grief','grief','Mental Health','#64748b'],
    ];
    for (const [name, slug, cat, color] of topics) {
      await client.query(`
        INSERT INTO topics (name, slug, category, color)
        VALUES ($1, $2, $3, $4) ON CONFLICT (slug) DO NOTHING
      `, [name, slug, cat, color]);
    }

    // Sample posts
    const maya = await client.query(`SELECT id FROM users WHERE username='DrMayaCBT'`);
    const nate = await client.query(`SELECT id FROM users WHERE username='NeuroNate'`);
    const trauma = await client.query(`SELECT id FROM users WHERE username='TraumaDoc'`);

    if (maya.rows[0] && nate.rows[0] && trauma.rows[0]) {
      const posts = [
        [maya.rows[0].id, '5 CBT Techniques That Actually Work for Anxiety', 'Cognitive Behavioral Therapy offers practical, evidence-based tools for managing anxiety. Here are five techniques I use daily with my patients that show consistent results...', 'CBT', 'article', 'blog', 'approved'],
        [nate.rows[0].id, 'New fMRI Study: Default Mode Network and Depression', 'Fascinating new findings on how the default mode network behaves differently in patients with major depressive disorder. The implications for treatment are significant...', 'Neuroscience', 'discussion', 'forum', 'approved'],
        [trauma.rows[0].id, 'EMDR vs. Prolonged Exposure: What the Research Shows', 'Both EMDR and prolonged exposure therapy are gold-standard treatments for PTSD. But how do they compare? A meta-analysis of recent studies reveals...', 'Trauma & PTSD', 'article', 'blog', 'approved'],
        [maya.rows[0].id, 'How do you explain CBT to skeptical clients?', 'I often encounter clients who are skeptical about CBT, thinking it oversimplifies their problems. What approaches have worked for you?', 'CBT', 'question', 'forum', 'approved'],
        [nate.rows[0].id, 'The Neuroscience of Mindfulness Meditation', 'Recent studies show measurable changes in gray matter density after just 8 weeks of mindfulness practice. Here is what the science says...', 'Mindfulness', 'article', 'blog', 'approved'],
      ];
      for (const [aid, title, body, topic, ptype, pkind, status] of posts) {
        await client.query(`
          INSERT INTO posts (author_id, title, body, topic, post_type, post_kind, status, approved_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
          ON CONFLICT DO NOTHING
        `, [aid, title, body, topic, ptype, pkind, status]);
      }
    }

    console.log('✅ Seed complete!');
    console.log('\n📋 Test accounts:');
    console.log('   Admin:  admin@psycheforum.com / admin123');
    console.log('   User:   maya@example.com / password123');
    console.log('   (all sample users use password: password123)');
  } catch (err) {
    console.error('❌ Seed error:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}
seed().catch(() => process.exit(1));
