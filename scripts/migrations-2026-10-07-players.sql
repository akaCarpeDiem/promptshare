-- 2026-10-07: game player identity + rename. Apply once:
--   npx wrangler d1 execute promptshare --remote --file=scripts/migrations-2026-10-07-players.sql
ALTER TABLE game_scores ADD COLUMN player_id TEXT;
ALTER TABLE game_scores ADD COLUMN hidden INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS game_scores_player ON game_scores (player_id);
CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY, display_name TEXT NOT NULL, token_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, rename_count INTEGER NOT NULL DEFAULT 0,
  ip_hash TEXT, hidden INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS player_names (
  id INTEGER PRIMARY KEY AUTOINCREMENT, player_id TEXT NOT NULL, display_name TEXT NOT NULL,
  kind TEXT NOT NULL, ip_hash TEXT, created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_player_names_player ON player_names (player_id, created_at);
CREATE INDEX IF NOT EXISTS idx_player_names_ip ON player_names (ip_hash, kind, created_at);
CREATE TABLE IF NOT EXISTS name_verdicts (
  name_key TEXT PRIMARY KEY, verdict TEXT NOT NULL, source TEXT NOT NULL, model TEXT, created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS name_checks (ip_hash TEXT NOT NULL, at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_name_checks ON name_checks (ip_hash, at);
