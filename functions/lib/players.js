// Player identity shared by PromptArcade and PromptShare games.
// A player is created on first name entry and gets { playerId, playerToken }. Only a SHA-256
// hash of the token is stored. Scores reference player_id; boards JOIN players to show the
// current display_name, so a rename updates every row at once. Old names stay in player_names.
import { moderateName, MODERATION_SQL } from "./namemod.js";

export const RENAMES_PER_DAY = 5;         // per player, rolling 24 h
export const RENAMES_PER_IP_DAY = 20;     // per client hash, rolling 24 h
export const CREATES_PER_IP_DAY = 10;     // per client hash, rolling 24 h
const DAY = 86400000;
const ID_RE = /^p_[a-f0-9]{20}$/;
const TOKEN_RE = /^[a-f0-9]{64}$/;

export const IDENTITY_SQL = [
  `CREATE TABLE IF NOT EXISTS players (
     id           TEXT PRIMARY KEY,
     display_name TEXT NOT NULL,
     token_hash   TEXT NOT NULL,
     created_at   INTEGER NOT NULL,
     updated_at   INTEGER NOT NULL,
     rename_count INTEGER NOT NULL DEFAULT 0,
     ip_hash      TEXT,
     hidden       INTEGER NOT NULL DEFAULT 0
   )`,
  `CREATE TABLE IF NOT EXISTS player_names (
     id           INTEGER PRIMARY KEY AUTOINCREMENT,
     player_id    TEXT NOT NULL,
     display_name TEXT NOT NULL,
     kind         TEXT NOT NULL,      -- create | rename
     ip_hash      TEXT,
     created_at   INTEGER NOT NULL
   )`,
  `CREATE INDEX IF NOT EXISTS idx_player_names_player ON player_names (player_id, created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_player_names_ip ON player_names (ip_hash, kind, created_at)`,
  ...MODERATION_SQL,
];

let ready = false;
export async function ensureIdentityTables(DB) {
  if (ready) return;
  await DB.batch(IDENTITY_SQL.map((sql) => DB.prepare(sql)));
  ready = true;
}

function hex(bytes) {
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
export async function sha256Hex(text) {
  return hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
}
function randomHex(n) {
  const a = new Uint8Array(n);
  crypto.getRandomValues(a);
  return hex(a);
}
function sameHex(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

/** Salted, daily-rotating hash of the client IP (never the raw IP). */
export async function clientHash(request, env) {
  const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "local";
  const day = new Date().toISOString().slice(0, 10);
  const salt = (env && (env.SCORE_SALT || env.SCORES_SALT)) || "promptgames";
  return (await sha256Hex(`${salt}|${day}|${ip}`)).slice(0, 24);
}

/** The player row for a valid id + token, else null. */
export async function authPlayer(DB, id, token) {
  if (!ID_RE.test(String(id || "")) || !TOKEN_RE.test(String(token || ""))) return null;
  const row = await DB.prepare("SELECT id, display_name, token_hash, hidden, rename_count FROM players WHERE id = ?1").bind(id).first();
  if (!row) return null;
  return sameHex(row.token_hash, await sha256Hex(token)) ? row : null;
}

const err = (status, error, message) => ({ ok: false, status, error, message });

export async function createPlayer(env, DB, { name, ipHash }) {
  await ensureIdentityTables(DB);
  const now = Date.now();
  const made = await DB.prepare("SELECT COUNT(*) AS n FROM player_names WHERE ip_hash = ?1 AND kind = 'create' AND created_at > ?2")
    .bind(ipHash, now - DAY).first();
  if (made && made.n >= CREATES_PER_IP_DAY) return err(429, "slow-down", "Too many new players from here today — try again tomorrow.");
  const mod = await moderateName(env, DB, name, { ipHash });
  if (!mod.ok) return mod;
  const id = "p_" + randomHex(10);
  const token = randomHex(32);
  await DB.batch([
    DB.prepare("INSERT INTO players (id, display_name, token_hash, created_at, updated_at, rename_count, ip_hash) VALUES (?1, ?2, ?3, ?4, ?4, 0, ?5)")
      .bind(id, mod.name, await sha256Hex(token), now, ipHash),
    DB.prepare("INSERT INTO player_names (player_id, display_name, kind, ip_hash, created_at) VALUES (?1, ?2, 'create', ?3, ?4)")
      .bind(id, mod.name, ipHash, now),
  ]);
  return { ok: true, status: 201, playerId: id, playerToken: token, name: mod.name, moderation: mod.source };
}

export async function renamePlayer(env, DB, { id, token, name, ipHash }) {
  await ensureIdentityTables(DB);
  const player = await authPlayer(DB, id, token);
  if (!player) return err(401, "bad-player", "This browser's player key isn't valid any more.");
  const now = Date.now();
  const pre = String(name ?? "").normalize("NFC").replace(/\s+/g, " ").trim();
  if (pre === player.display_name) return { ok: true, status: 200, name: player.display_name, unchanged: true };
  const [mine, fromIp] = await Promise.all([
    DB.prepare("SELECT COUNT(*) AS n FROM player_names WHERE player_id = ?1 AND kind = 'rename' AND created_at > ?2").bind(id, now - DAY).first(),
    DB.prepare("SELECT COUNT(*) AS n FROM player_names WHERE ip_hash = ?1 AND kind = 'rename' AND created_at > ?2").bind(ipHash, now - DAY).first(),
  ]);
  if ((mine && mine.n >= RENAMES_PER_DAY) || (fromIp && fromIp.n >= RENAMES_PER_IP_DAY)) {
    return err(429, "rename-limit", `You can rename ${RENAMES_PER_DAY} times a day — try again tomorrow.`);
  }
  const mod = await moderateName(env, DB, name, { ipHash });
  if (!mod.ok) return mod;
  await DB.batch([
    DB.prepare("UPDATE players SET display_name = ?2, updated_at = ?3, rename_count = rename_count + 1 WHERE id = ?1").bind(id, mod.name, now),
    DB.prepare("INSERT INTO player_names (player_id, display_name, kind, ip_hash, created_at) VALUES (?1, ?2, 'rename', ?3, ?4)").bind(id, mod.name, ipHash, now),
  ]);
  return { ok: true, status: 200, name: mod.name, previous: player.display_name, moderation: mod.source };
}

/** Parse a JSON body (≤ 2 KB, same-origin when an Origin header is present). */
export async function readJson(request) {
  if (!(request.headers.get("content-type") || "").includes("application/json")) return err(415, "json-only", "Expected JSON.");
  const origin = request.headers.get("origin");
  if (origin) {
    let host = "";
    try { host = new URL(origin).host; } catch {}
    if (host !== new URL(request.url).host) return err(403, "cross-origin", "Cross-origin request.");
  }
  const raw = await request.text();
  if (raw.length > 2048) return err(413, "too-large", "Request too large.");
  try { return { ok: true, body: JSON.parse(raw) || {} }; } catch { return err(400, "bad-json", "Expected JSON."); }
}
