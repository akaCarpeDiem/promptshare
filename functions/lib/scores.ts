/** Shared high scores for curated games. D1-backed.
 *
 * Player identity (2026-10-07): the first name entry creates a player ({playerId, playerToken},
 * kept in that browser's localStorage). Scores carry player_id and boards JOIN players, so a
 * rename shows on every row at once. Names are moderated server-side (regex + Workers AI).
 * Legacy rows (no player_id) keep their typed name; a browser can claim only the legacy rows it
 * posted itself (matched by its HttpOnly ps_voter cookie + the same name) when it registers.
 */

import type { D1Database } from "./thumbs.ts";
// @ts-ignore -- plain JS module shared with PromptArcade
import { createPlayer, renamePlayer, authPlayer, ensureIdentityTables, clientHash, readJson } from "./players.js";
// @ts-ignore
import { moderateName } from "./namemod.js";

const VOTER_COOKIE = "ps_voter";
const VOTER_MAX_AGE = 60 * 60 * 24 * 400;
const ID_RE = /^[a-zA-Z0-9_.:-]{1,128}$/;
const GAME_RE = /^[a-z0-9-]{1,64}$/;

const GAMES = new Set([
  "paper-moths",
  "gate-comet",
  "lantern-stack",
  "moss-steps",
  "wick-line",
  "roofline-crane",
  "upstream-koi",
  "kiln-break",
  "orchard-serpent",
  "belt-drift",
  "pulse-lanterns",
  "loom-shuttle",
  "tide-bell",
  "pier-watch",
  "courier-of-glass",
  "soot-lantern",
  "night-press",
]);

function json(data: unknown, status = 200, extraHeaders?: Record<string, string>) {
  const headers = new Headers(extraHeaders);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  return new Response(JSON.stringify(data), { status, headers });
}

function voterCookieValue(request: Request) {
  const raw = request.headers.get("cookie") || "";
  const match = raw.match(/(?:^|; )ps_voter=([^;]+)/);
  if (!match) return null;
  try {
    const v = decodeURIComponent(match[1]).trim();
    return ID_RE.test(v) ? v : null;
  } catch {
    return null;
  }
}

function setVoterCookie(voter: string, request: Request) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${VOTER_COOKIE}=${encodeURIComponent(voter)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${VOTER_MAX_AGE}${secure}`;
}

let scoresReady = false;
export async function ensureGameScoresTable(db: D1Database) {
  if (scoresReady) return;
  // Existing databases get player_id/hidden from scripts/migrations-2026-10-07-players.sql.
  await db.prepare(`CREATE TABLE IF NOT EXISTS game_scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id TEXT NOT NULL,
    score INTEGER NOT NULL,
    player_name TEXT NOT NULL,
    voter_key TEXT NOT NULL,
    created_at TEXT NOT NULL,
    player_id TEXT,
    hidden INTEGER NOT NULL DEFAULT 0
  )`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS game_scores_board ON game_scores (game_id, score)`).run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS rate_limits (
    bucket TEXT NOT NULL,
    at INTEGER NOT NULL
  )`).run();
  scoresReady = true;
}

function cleanName(raw: unknown) {
  let s = String(raw ?? "").replace(/[\u0000-\u001f]/g, "").replace(/\s+/g, " ").trim().slice(0, 16);
  s = s.replace(/[^\p{L}\p{N} .'_-]/gu, "").trim().slice(0, 16);
  return s || "Guest";
}

function cleanScore(raw: unknown) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(1_000_000, Math.round(n)));
}

async function topTen(db: D1Database, gameId: string) {
  const rows = await db
    .prepare(
      `SELECT s.player_id AS pid, COALESCE(p.display_name, s.player_name) AS name, s.score, s.created_at AS at
       FROM game_scores s LEFT JOIN players p ON p.id = s.player_id
       WHERE s.game_id = ? AND s.hidden = 0 AND (p.hidden IS NULL OR p.hidden = 0)
       ORDER BY s.score DESC, s.created_at ASC
       LIMIT 10`
    )
    .bind(gameId)
    .all<{ pid: string | null; name: string; score: number; at: string }>();
  return (rows.results || []).map((row) => ({
    name: row.name,
    score: Number(row.score) || 0,
    at: row.at,
    ...(row.pid ? { pid: row.pid } : {}),
  }));
}

async function limited(db: D1Database, bucket: string) {
  const now = Date.now();
  const windowMs = 60_000;
  await db.prepare("DELETE FROM rate_limits WHERE bucket = ? AND at < ?").bind(bucket, now - windowMs).run();
  const count = await db.prepare("SELECT COUNT(*) AS n FROM rate_limits WHERE bucket = ?").bind(bucket).first<{ n: number }>();
  if (Number(count?.n || 0) >= 8) return true;
  await db.prepare("INSERT INTO rate_limits (bucket, at) VALUES (?, ?)").bind(bucket, now).run();
  return false;
}

/**
 * GET/POST /api/games/:slug/scores
 * Returns null when the path is not a scores route.
 */
export async function handleScores(request: Request, db: D1Database, env: any = {}): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";
  const parts = path.split("/").filter(Boolean);
  if (parts[0] === "api" && parts[1] === "games" && parts[2] === "players" && !parts[4]) {
    return handlePlayers(request, db, env, parts[3] || "");
  }
  if (parts[0] !== "api" || parts[1] !== "games" || parts[3] !== "scores" || parts[4]) return null;

  await ensureGameScoresTable(db);
  await ensureIdentityTables(db);

  const gameId = parts[2] || "";
  if (!GAME_RE.test(gameId) || !GAMES.has(gameId)) return json({ error: "Not found." }, 404);

  let voter = voterCookieValue(request);
  let setCookie: string | undefined;
  if (!voter) {
    voter = crypto.randomUUID().replace(/-/g, "");
    setCookie = setVoterCookie(voter, request);
  }
  const headers: Record<string, string> = {};
  if (setCookie) headers["set-cookie"] = setCookie;

  if (request.method === "GET") {
    return json({ game: gameId, top: await topTen(db, gameId) }, 200, headers);
  }

  if (request.method === "POST") {
    if (await limited(db, `gscore:${gameId}:${voter}`)) {
      return json({ error: "Slow down — a few scores a minute is enough." }, 429, headers);
    }
    let body: { score?: unknown; name?: unknown; playerId?: unknown; playerToken?: unknown } = {};
    try {
      body = await request.json();
    } catch {
      return json({ error: "Expected JSON." }, 400, headers);
    }
    const score = cleanScore(body.score);
    if (score === null) return json({ error: "Score must be a number." }, 400, headers);
    let name: string;
    let playerId: string | null = null;
    let hidden = 0;
    if (body.playerId) {
      const player = await authPlayer(db, body.playerId, body.playerToken);
      if (!player) return json({ ok: false, error: "bad-player" }, 401, headers);
      name = player.display_name;
      playerId = player.id;
      hidden = player.hidden ? 1 : 0;
    } else {
      // Older cached clients: no identity, but the typed name is still moderated.
      const mod = await moderateName(env, db, cleanName(body.name), { ipHash: await clientHash(request, env) });
      if (!mod.ok) return json({ ok: false, error: mod.error, message: mod.message }, mod.status, headers);
      name = mod.name;
    }
    await db
      .prepare(
        "INSERT INTO game_scores (game_id, score, player_name, voter_key, created_at, player_id, hidden) VALUES (?, ?, ?, ?, ?, ?, ?)"
      )
      .bind(gameId, score, name, voter, new Date().toISOString(), playerId, hidden)
      .run();
    return json({ ok: true, game: gameId, score, name, pid: playerId || undefined, top: await topTen(db, gameId) }, 200, headers);
  }

  return json({ error: "Method not allowed" }, 405, headers);
}

/**
 * POST /api/games/players          { name, previousName? } → 201 { ok, playerId, playerToken, name, claimed }
 * POST /api/games/players/rename   { playerId, playerToken, name } → { ok, name, previous }
 * POST /api/games/players/me       { playerId, playerToken } → { ok, playerId, name } | 401
 */
async function handlePlayers(request: Request, db: D1Database, env: any, action: string): Promise<Response> {
  if (request.method !== "POST") return json({ ok: false, error: "method-not-allowed" }, 405, { allow: "POST" });
  await ensureGameScoresTable(db);
  await ensureIdentityTables(db);
  const parsed = await readJson(request);
  if (!parsed.ok) return json({ ok: false, error: parsed.error, message: parsed.message }, parsed.status);
  const body = parsed.body || {};
  const ipHash = await clientHash(request, env);

  if (action === "") {
    const r = await createPlayer(env, db, { name: body.name, ipHash });
    if (!r.ok) return json({ ok: false, error: r.error, message: r.message }, r.status);
    // Claim legacy rows this browser posted itself: same HttpOnly ps_voter cookie AND the same
    // name (new name, or the name this browser used before identities existed).
    let claimed = 0;
    const voter = voterCookieValue(request);
    if (voter) {
      const names = [r.name, cleanName(body.previousName)].map((n) => String(n).toLowerCase());
      const res = await db
        .prepare(
          `UPDATE game_scores SET player_id = ? WHERE player_id IS NULL AND voter_key = ?
           AND lower(player_name) IN (?, ?) AND lower(player_name) <> 'guest'`
        )
        .bind(r.playerId, voter, names[0], names[1])
        .run();
      claimed = Number((res as any)?.meta?.changes || 0);
    }
    return json({ ok: true, playerId: r.playerId, playerToken: r.playerToken, name: r.name, claimed }, 201);
  }
  if (action === "rename") {
    const r = await renamePlayer(env, db, { id: body.playerId, token: body.playerToken, name: body.name, ipHash });
    if (!r.ok) return json({ ok: false, error: r.error, message: r.message }, r.status);
    return json({ ok: true, name: r.name, previous: r.previous || r.name, unchanged: !!r.unchanged });
  }
  if (action === "me") {
    const p = await authPlayer(db, body.playerId, body.playerToken);
    if (!p) return json({ ok: false, error: "bad-player" }, 401);
    return json({ ok: true, playerId: p.id, name: p.display_name });
  }
  return json({ ok: false, error: "not-found" }, 404);
}
