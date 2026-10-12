-- PromptShare metadata. Apply with:
-- npx wrangler d1 execute promptshare --remote --file=schema.sql

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  handle TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  bio TEXT NOT NULL DEFAULT '',
  website TEXT NOT NULL DEFAULT '',
  avatar_url TEXT NOT NULL DEFAULT '',
  socials TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  username_set INTEGER NOT NULL DEFAULT 1,
  password_hash TEXT NOT NULL DEFAULT '',
  password_salt TEXT NOT NULL DEFAULT '',
  password_updated_at TEXT NOT NULL DEFAULT ''
);

-- Migrations for existing D1 databases (also run from createD1Store().ready()):
-- ALTER TABLE users ADD COLUMN username_set INTEGER NOT NULL DEFAULT 1;
-- ALTER TABLE users ADD COLUMN password_hash TEXT NOT NULL DEFAULT '';
-- ALTER TABLE users ADD COLUMN password_salt TEXT NOT NULL DEFAULT '';
-- ALTER TABLE users ADD COLUMN password_updated_at TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS magic_links (
  token TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS oauth_states (
  state TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS creations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  prompt TEXT NOT NULL,
  model TEXT NOT NULL,
  tags TEXT NOT NULL DEFAULT '[]',
  visibility TEXT NOT NULL,
  media_url TEXT NOT NULL,
  media_kind TEXT NOT NULL,
  featured INTEGER NOT NULL DEFAULT 0,
  hidden INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS steps (
  id TEXT PRIMARY KEY,
  creation_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  prompt TEXT NOT NULL,
  model TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS follows (
  follower_id TEXT NOT NULL,
  followee_id TEXT NOT NULL,
  PRIMARY KEY (follower_id, followee_id)
);

CREATE TABLE IF NOT EXISTS likes (
  user_id TEXT NOT NULL,
  creation_id TEXT NOT NULL,
  PRIMARY KEY (user_id, creation_id)
);

CREATE TABLE IF NOT EXISTS saves (
  user_id TEXT NOT NULL,
  creation_id TEXT NOT NULL,
  PRIMARY KEY (user_id, creation_id)
);

CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  creation_id TEXT NOT NULL,
  reporter_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS rate_limits (
  bucket TEXT NOT NULL,
  at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS creations_feed ON creations (hidden, visibility, created_at);
CREATE INDEX IF NOT EXISTS steps_creation ON steps (creation_id, position);

-- Email OTP login codes (replaces magic-link click flow for sign-in)
CREATE TABLE IF NOT EXISTS login_codes (
  email TEXT PRIMARY KEY,
  code_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0
);

-- Anonymous gallery thumbs (one vote per browser voter_key; no account required)
CREATE TABLE IF NOT EXISTS thumbs (
  creation_id TEXT NOT NULL,
  voter_key TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (creation_id, voter_key)
);
CREATE INDEX IF NOT EXISTS thumbs_creation ON thumbs (creation_id);

-- Curated game high scores (anonymous; one row per submitted run)
CREATE TABLE IF NOT EXISTS game_scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id TEXT NOT NULL,
  score INTEGER NOT NULL,
  player_name TEXT NOT NULL,
  voter_key TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS game_scores_board ON game_scores (game_id, score);
