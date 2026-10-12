/** Anonymous thumbs-up (gallery visitors, no account). Persists in D1. */

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(): Promise<T | null>;
  run(): Promise<unknown>;
  all<T = unknown>(): Promise<{ results: T[] }>;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

const VOTER_COOKIE = "ps_voter";
const VOTER_MAX_AGE = 60 * 60 * 24 * 400; // ~13 months
const ID_RE = /^[a-zA-Z0-9_.:-]{1,128}$/;

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

function newVoter() {
  return crypto.randomUUID().replace(/-/g, "");
}

export async function ensureThumbsTable(db: D1Database) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS thumbs (
    creation_id TEXT NOT NULL,
    voter_key TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (creation_id, voter_key)
  )`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS thumbs_creation ON thumbs (creation_id)`).run();
}

/**
 * Handle /api/thumbs and /api/thumbs/:id.
 * Returns null if the path is not a thumbs route.
 */
export async function handleThumbs(request: Request, db: D1Database): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";
  const parts = path.split("/").filter(Boolean);
  if (parts[0] !== "api" || parts[1] !== "thumbs") return null;

  await ensureThumbsTable(db);

  let voter = voterCookieValue(request);
  let setCookie: string | undefined;
  if (!voter) {
    voter = newVoter();
    setCookie = setVoterCookie(voter, request);
  }
  const headers: Record<string, string> = {};
  if (setCookie) headers["set-cookie"] = setCookie;

  // GET /api/thumbs?ids=a,b,c
  if (request.method === "GET" && !parts[2]) {
    const ids = String(url.searchParams.get("ids") || "")
      .split(",")
      .map((s) => s.trim())
      .filter((s) => ID_RE.test(s))
      .slice(0, 80);
    const counts: Record<string, number> = {};
    const voted: Record<string, boolean> = {};
    for (const id of ids) {
      counts[id] = 0;
      voted[id] = false;
    }
    if (ids.length) {
      // D1 has no great IN binding helper for dynamic lists — query per id (bounded ≤80).
      await Promise.all(
        ids.map(async (id) => {
          const row = await db
            .prepare("SELECT COUNT(*) AS n FROM thumbs WHERE creation_id = ?")
            .bind(id)
            .first<{ n: number }>();
          counts[id] = Number(row?.n || 0);
          const mine = await db
            .prepare("SELECT 1 AS n FROM thumbs WHERE creation_id = ? AND voter_key = ?")
            .bind(id, voter)
            .first<{ n: number }>();
          voted[id] = Boolean(mine);
        })
      );
    }
    return json({ counts, voted }, 200, headers);
  }

  // POST /api/thumbs/:id  — toggle thumbs-up for this browser
  if (request.method === "POST" && parts[2] && !parts[3]) {
    const creationId = parts[2];
    if (!ID_RE.test(creationId)) return json({ error: "Invalid id." }, 400, headers);

    const gameThumb = /^game_[a-z0-9-]{1,64}$/.test(creationId);
    if (!gameThumb) {
      const exists = await db
        .prepare("SELECT id FROM creations WHERE id = ? AND hidden = 0")
        .bind(creationId)
        .first<{ id: string }>();
      if (!exists) return json({ error: "Not found." }, 404, headers);
    }

    const existing = await db
      .prepare("SELECT 1 AS n FROM thumbs WHERE creation_id = ? AND voter_key = ?")
      .bind(creationId, voter)
      .first<{ n: number }>();

    let thumbed: boolean;
    if (existing) {
      await db
        .prepare("DELETE FROM thumbs WHERE creation_id = ? AND voter_key = ?")
        .bind(creationId, voter)
        .run();
      thumbed = false;
    } else {
      await db
        .prepare("INSERT INTO thumbs (creation_id, voter_key, created_at) VALUES (?, ?, ?)")
        .bind(creationId, voter, new Date().toISOString())
        .run();
      thumbed = true;
    }

    const countRow = await db
      .prepare("SELECT COUNT(*) AS n FROM thumbs WHERE creation_id = ?")
      .bind(creationId)
      .first<{ n: number }>();

    return json({ id: creationId, thumbed, count: Number(countRow?.n || 0) }, 200, headers);
  }

  if (request.method === "GET" && parts[2] && !parts[3]) {
    const creationId = parts[2];
    if (!ID_RE.test(creationId)) return json({ error: "Invalid id." }, 400, headers);
    const countRow = await db
      .prepare("SELECT COUNT(*) AS n FROM thumbs WHERE creation_id = ?")
      .bind(creationId)
      .first<{ n: number }>();
    const mine = await db
      .prepare("SELECT 1 AS n FROM thumbs WHERE creation_id = ? AND voter_key = ?")
      .bind(creationId, voter)
      .first<{ n: number }>();
    return json(
      { id: creationId, count: Number(countRow?.n || 0), thumbed: Boolean(mine) },
      200,
      headers
    );
  }

  return json({ error: "Not found" }, 404, headers);
}
