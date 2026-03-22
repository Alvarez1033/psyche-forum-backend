require('dotenv').config();
const { pool } = require('./pool');

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('🗄️  Running Psyche Forum migrations...');
    await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(100),
        bio TEXT DEFAULT '',
        avatar_color VARCHAR(20) DEFAULT '#6366f1',
        role VARCHAR(30) DEFAULT 'member' CHECK (role IN ('guest','member','verified','contributor','author','editor','moderator','support','admin','superadmin')),
        interests TEXT[] DEFAULT '{}',
        banned BOOLEAN DEFAULT FALSE,
        ban_reason TEXT,
        post_count INT DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS topics (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(100) UNIQUE NOT NULL,
        slug VARCHAR(100) UNIQUE NOT NULL,
        category VARCHAR(50),
        color VARCHAR(20) DEFAULT '#6366f1',
        post_count INT DEFAULT 0
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS posts (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(500) NOT NULL,
        body TEXT NOT NULL,
        topic VARCHAR(100),
        post_type VARCHAR(20) DEFAULT 'discussion' CHECK (post_type IN ('discussion','article','question','resource','support')),
        post_kind VARCHAR(10) DEFAULT 'forum' CHECK (post_kind IN ('blog','forum')),
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','approved','needs_review','ghosted','temp_removed','deleted')),
        sections JSONB,
        cover_image TEXT,
        upvotes INT DEFAULT 0,
        downvotes INT DEFAULT 0,
        comment_count INT DEFAULT 0,
        pinned BOOLEAN DEFAULT FALSE,
        flagged BOOLEAN DEFAULT FALSE,
        flag_count INT DEFAULT 0,
        approved_by UUID REFERENCES users(id),
        approved_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS comments (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
        author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        parent_id UUID REFERENCES comments(id) ON DELETE CASCADE,
        body TEXT NOT NULL,
        upvotes INT DEFAULT 0,
        downvotes INT DEFAULT 0,
        flagged BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS votes (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        target_id UUID NOT NULL,
        target_type VARCHAR(10) NOT NULL CHECK (target_type IN ('post','comment')),
        vote_type VARCHAR(10) NOT NULL CHECK (vote_type IN ('up','down')),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, target_id, target_type)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS support_tickets (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        assigned_to UUID REFERENCES users(id),
        subject VARCHAR(300) NOT NULL,
        body TEXT NOT NULL,
        status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open','in_progress','resolved','closed')),
        priority VARCHAR(10) DEFAULT 'medium' CHECK (priority IN ('low','medium','high','urgent')),
        category VARCHAR(50),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS ticket_replies (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
        author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        body TEXT NOT NULL,
        is_internal BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS role_changes (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        target_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        changed_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        old_role TEXT NOT NULL,
        new_role TEXT NOT NULL,
        reason TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS user_badges (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        badge_key VARCHAR(50) NOT NULL,
        badge_label VARCHAR(100) NOT NULL,
        badge_icon VARCHAR(10),
        awarded_by UUID REFERENCES users(id),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, badge_key)
      )
    `);

    console.log('✅ Migrations complete!');
  } catch (err) {
    console.error('❌ Migration error:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}
migrate().catch(() => process.exit(1));
