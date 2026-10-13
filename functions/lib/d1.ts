import { seedBundle } from "./seed.ts";
import { modelMatches } from "./modelLabel.ts";
import type { ChainStep, Creation, PublicUser, Store, User } from "./types.ts";

interface D1Prepared {
  bind(...args: unknown[]): D1Prepared;
  first<T>(): Promise<T | null>;
  all<T>(): Promise<{ results: T[] }>;
  run(): Promise<unknown>;
}

export interface D1Database {
  prepare(sql: string): D1Prepared;
  exec?(sql: string): Promise<unknown>;
}

export interface R2Bucket {
  put(key: string, value: Uint8Array, options?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
  get(key: string): Promise<{ arrayBuffer(): Promise<ArrayBuffer>; httpMetadata?: { contentType?: string } } | null>;
}

/** Bump only when seed catalog content (seed.ts) changes. */
// HARD LOCK: every published video plate must be >=30fps (prefer 60) before it goes to R2.
// New US Cities and Street clips are not publishable below 30fps. Do not re-add culled 24fps plates.
const SEED_REVISION = "20261006-mjnotes1";

declare const globalThis: {
  __psSeedEnsure?: { revision: string; done: boolean };
};

interface UserRow {
  id: string; email: string; handle: string; display_name: string; bio: string; website: string; avatar_url: string; socials: string; created_at: string;
  username_set?: number | null; password_hash?: string | null; password_salt?: string | null; password_updated_at?: string | null;
}
interface CreationRow {
  id: string; user_id: string; title: string; prompt: string; model: string; tags: string; visibility: string; media_url: string; media_kind: string; featured: number; hidden: number; created_at: string;
}

function parseTags(raw: string): string[] {
  try {
    const value = JSON.parse(raw || "[]");
    if (!Array.isArray(value)) return [];
    return value.map((item) => String(item || "")).filter(Boolean);
  } catch {
    return [];
  }
}

function parseSocials(raw: string): User["socials"] {
  try {
    const value = JSON.parse(raw || "[]");
    if (!Array.isArray(value)) return [];
    return value.filter((item) => item && typeof item === "object") as User["socials"];
  } catch {
    return [];
  }
}

function sanitizeLikeNeedle(value: string): string {
  return value.replace(/[%_\\]/g, "");
}

function userFrom(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    handle: row.handle,
    displayName: row.display_name,
    bio: row.bio,
    website: row.website,
    avatarUrl: row.avatar_url,
    socials: parseSocials(row.socials),
    createdAt: row.created_at,
    usernameSet: row.username_set == null ? true : Boolean(row.username_set),
    passwordHash: row.password_hash || "",
    passwordSalt: row.password_salt || "",
    passwordUpdatedAt: row.password_updated_at || "",
  };
}

export function createD1Store(db: D1Database, media?: R2Bucket): Store {
  let seeded = false;
  async function ensure() {
    const gate = globalThis.__psSeedEnsure;
    if (gate?.done && gate.revision === SEED_REVISION) return;
    if (seeded && gate?.revision === SEED_REVISION) return;

    await db.prepare(`CREATE TABLE IF NOT EXISTS thumbs (
      creation_id TEXT NOT NULL,
      voter_key TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (creation_id, voter_key)
    )`).run();
    try { await db.prepare("CREATE INDEX IF NOT EXISTS thumbs_creation ON thumbs (creation_id)").run(); } catch { /* ok */ }
    await db.prepare(`CREATE TABLE IF NOT EXISTS ps_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )`).run();
    for (const sql of [
      "ALTER TABLE users ADD COLUMN username_set INTEGER NOT NULL DEFAULT 1",
      "ALTER TABLE users ADD COLUMN password_hash TEXT NOT NULL DEFAULT ''",
      "ALTER TABLE users ADD COLUMN password_salt TEXT NOT NULL DEFAULT ''",
      "ALTER TABLE users ADD COLUMN password_updated_at TEXT NOT NULL DEFAULT ''",
    ]) {
      try { await db.prepare(sql).run(); } catch { /* column may already exist */ }
    }

    // Cheap path: DB already at this seed revision — skip heavy reconcile/deletes/steps rewrite.
    // Still INSERT OR IGNORE any brand-new seed ids (append-only), once per meta flag.
    try {
      const revRow = await db.prepare("SELECT value FROM ps_meta WHERE key = 'seed_revision'").first<{ value: string }>();
      if (revRow?.value === SEED_REVISION) {
        // Always cheap INSERT OR IGNORE for brand-new seed ids only (no updates/deletes/steps).
        const bundle = seedBundle();
        const haveRows = await db.prepare("SELECT id FROM creations WHERE id LIKE 'seed_%'").all<{ id: string }>();
        const have = new Set((haveRows.results || []).map((r) => r.id));
        for (const item of bundle.creations) {
          if (have.has(item.id)) continue;
          await db.prepare("INSERT OR IGNORE INTO creations (id, user_id, title, prompt, model, tags, visibility, media_url, media_kind, featured, hidden, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
            .bind(item.id, item.userId, item.title, item.prompt, item.model, JSON.stringify(item.tags), item.visibility, item.mediaUrl, item.mediaKind, item.featured ? 1 : 0, item.hidden ? 1 : 0, item.createdAt)
            .run();
        }
        seeded = true;
        globalThis.__psSeedEnsure = { revision: SEED_REVISION, done: true };
        return;
      }
    } catch { /* ps_meta may be brand new; fall through */ }

    const row = await db.prepare("SELECT COUNT(*) AS n FROM users").first<{ n: number }>();
    const bundle = seedBundle();
    if ((row?.n || 0) > 0) {
      // Keep curated image + video plates. Only purge legacy audio/other kinds.
      await db.prepare("DELETE FROM steps WHERE creation_id IN (SELECT id FROM creations WHERE media_kind NOT IN ('image', 'video'))").run();
      await db.prepare("DELETE FROM likes WHERE creation_id IN (SELECT id FROM creations WHERE media_kind NOT IN ('image', 'video'))").run();
      await db.prepare("DELETE FROM saves WHERE creation_id IN (SELECT id FROM creations WHERE media_kind NOT IN ('image', 'video'))").run();
      await db.prepare("DELETE FROM creations WHERE media_kind NOT IN ('image', 'video')").run();
      for (const user of bundle.users) {
        const existing = await db.prepare("SELECT id FROM users WHERE id = ?").bind(user.id).first();
        if (existing) {
          await db.prepare("UPDATE users SET bio = ? WHERE id = ?").bind(user.bio, user.id).run();
          continue;
        }
        await db.prepare("INSERT INTO users (id, email, handle, display_name, bio, website, avatar_url, socials, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
          .bind(user.id, user.email, user.handle, user.displayName, user.bio, user.website, user.avatarUrl, JSON.stringify(user.socials), user.createdAt)
          .run();
      }
      // One lookup for existing seed ids (avoids N round-trips on every cold start).
      const seedRows = await db.prepare("SELECT id, tags, title, prompt, media_url, hidden, featured FROM creations WHERE id LIKE 'seed_%'").all<{ id: string; tags: string; title: string; prompt: string; media_url: string; hidden: number; featured: number }>();
      const existingSeeds = new Map((seedRows.results || []).map((row) => [row.id, row]));
      const bundleIds = new Set(bundle.creations.map((c) => c.id));
      for (const item of bundle.creations) {
        const prior = existingSeeds.get(item.id);
        if (prior !== undefined) {
          const nextTags = JSON.stringify(item.tags);
          const nextHidden = item.hidden ? 1 : 0;
          const nextFeatured = item.featured ? 1 : 0;
          const needsUpdate =
            prior.tags !== nextTags ||
            prior.title !== item.title ||
            prior.prompt !== item.prompt ||
            prior.media_url !== item.mediaUrl ||
            Number(prior.hidden) !== nextHidden ||
            Number(prior.featured) !== nextFeatured;
          if (needsUpdate) {
            await db.prepare("UPDATE creations SET tags = ?, title = ?, prompt = ?, media_url = ?, hidden = ?, featured = ? WHERE id = ?")
              .bind(nextTags, item.title, item.prompt, item.mediaUrl, nextHidden, nextFeatured, item.id)
              .run();
          }
          continue;
        }
        await db.prepare("INSERT INTO creations (id, user_id, title, prompt, model, tags, visibility, media_url, media_kind, featured, hidden, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
          .bind(item.id, item.userId, item.title, item.prompt, item.model, JSON.stringify(item.tags), item.visibility, item.mediaUrl, item.mediaKind, item.featured ? 1 : 0, item.hidden ? 1 : 0, item.createdAt)
          .run();
        for (const [index, step] of item.steps.entries()) {
          await db.prepare("INSERT INTO steps (id, creation_id, position, prompt, model, note) VALUES (?, ?, ?, ?, ?, ?)")
            .bind(`step_${item.id}_${index}`, item.id, index, step.prompt, step.model, step.note)
            .run();
        }
      }
      // Drop renamed/retired studio seeds so Discover tags stay accurate.
      for (const oldId of existingSeeds.keys()) {
        if (!bundleIds.has(oldId)) {
          await db.prepare("DELETE FROM steps WHERE creation_id = ?").bind(oldId).run();
          await db.prepare("DELETE FROM likes WHERE creation_id = ?").bind(oldId).run();
          await db.prepare("DELETE FROM saves WHERE creation_id = ?").bind(oldId).run();
          try { await db.prepare("DELETE FROM thumbs WHERE creation_id = ?").bind(oldId).run(); } catch { /* table may not exist yet */ }
          await db.prepare("DELETE FROM creations WHERE id = ?").bind(oldId).run();
        }
      }
      await db.prepare("INSERT OR REPLACE INTO ps_meta (key, value) VALUES ('seed_revision', ?)").bind(SEED_REVISION).run();
      seeded = true;
      globalThis.__psSeedEnsure = { revision: SEED_REVISION, done: true };
      return;
    }
    for (const user of bundle.users) {
      await db.prepare("INSERT INTO users (id, email, handle, display_name, bio, website, avatar_url, socials, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(user.id, user.email, user.handle, user.displayName, user.bio, user.website, user.avatarUrl, JSON.stringify(user.socials), user.createdAt)
        .run();
    }
    for (const item of bundle.creations) {
      await db.prepare("INSERT INTO creations (id, user_id, title, prompt, model, tags, visibility, media_url, media_kind, featured, hidden, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(item.id, item.userId, item.title, item.prompt, item.model, JSON.stringify(item.tags), item.visibility, item.mediaUrl, item.mediaKind, item.featured ? 1 : 0, item.hidden ? 1 : 0, item.createdAt)
        .run();
      for (const [index, step] of item.steps.entries()) {
        await db.prepare("INSERT INTO steps (id, creation_id, position, prompt, model, note) VALUES (?, ?, ?, ?, ?, ?)")
          .bind(`step_${item.id}_${index}`, item.id, index, step.prompt, step.model, step.note)
          .run();
      }
    }
    await db.prepare("INSERT OR REPLACE INTO ps_meta (key, value) VALUES ('seed_revision', ?)").bind(SEED_REVISION).run();
    seeded = true;
    globalThis.__psSeedEnsure = { revision: SEED_REVISION, done: true };
  }

  async function stepsFor(id: string): Promise<ChainStep[]> {
    const rows = await db.prepare("SELECT id, position, prompt, model, note FROM steps WHERE creation_id = ? ORDER BY position").bind(id).all<ChainStep>();
    return rows.results || [];
  }

  async function hydrate(row: CreationRow, viewerId?: string | null, opts?: { light?: boolean }): Promise<Creation> {
    const light = Boolean(opts?.light);
    let likeCount = 0;
    let saveCount = 0;
    let liked = false;
    let saved = false;
    if (!light) {
      const likes = await db.prepare("SELECT COUNT(*) AS n FROM likes WHERE creation_id = ?").bind(row.id).first<{ n: number }>();
      const saves = await db.prepare("SELECT COUNT(*) AS n FROM saves WHERE creation_id = ?").bind(row.id).first<{ n: number }>();
      likeCount = likes?.n || 0;
      saveCount = saves?.n || 0;
      if (viewerId) {
        const likedRow = await db.prepare("SELECT 1 AS n FROM likes WHERE creation_id = ? AND user_id = ?").bind(row.id, viewerId).first<{ n: number }>();
        const savedRow = await db.prepare("SELECT 1 AS n FROM saves WHERE creation_id = ? AND user_id = ?").bind(row.id, viewerId).first<{ n: number }>();
        liked = Boolean(likedRow);
        saved = Boolean(savedRow);
      }
    } else if (viewerId) {
      const likedRow = await db.prepare("SELECT 1 AS n FROM likes WHERE creation_id = ? AND user_id = ?").bind(row.id, viewerId).first<{ n: number }>();
      const savedRow = await db.prepare("SELECT 1 AS n FROM saves WHERE creation_id = ? AND user_id = ?").bind(row.id, viewerId).first<{ n: number }>();
      liked = Boolean(likedRow);
      saved = Boolean(savedRow);
    }
    return {
      id: row.id,
      userId: row.user_id,
      title: row.title,
      prompt: row.prompt,
      model: row.model,
      tags: parseTags(row.tags),
      visibility: row.visibility === "unlisted" ? "unlisted" : "public",
      mediaUrl: row.media_url,
      mediaKind: row.media_kind as Creation["mediaKind"],
      featured: Boolean(row.featured),
      hidden: Boolean(row.hidden),
      createdAt: row.created_at,
      steps: light ? [] : await stepsFor(row.id),
      likeCount,
      saveCount,
      liked,
      saved,
    };
  }

  async function toPublic(row: UserRow, viewerId?: string | null): Promise<PublicUser> {
    const followers = await db.prepare("SELECT COUNT(*) AS n FROM follows WHERE followee_id = ?").bind(row.id).first<{ n: number }>();
    const following = await db.prepare("SELECT COUNT(*) AS n FROM follows WHERE follower_id = ?").bind(row.id).first<{ n: number }>();
    const creations = await db.prepare("SELECT COUNT(*) AS n FROM creations WHERE user_id = ? AND hidden = 0 AND visibility = 'public' AND media_kind IN ('image', 'video')").bind(row.id).first<{ n: number }>();
    const followed = viewerId ? await db.prepare("SELECT 1 AS n FROM follows WHERE follower_id = ? AND followee_id = ?").bind(viewerId, row.id).first() : null;
    const user = userFrom(row);
    return {
      id: user.id,
      handle: user.handle,
      displayName: user.displayName,
      bio: user.bio,
      website: user.website,
      avatarUrl: user.avatarUrl,
      socials: user.socials,
      followers: followers?.n || 0,
      following: following?.n || 0,
      creationCount: creations?.n || 0,
      followed: Boolean(followed),
    };
  }

  return {
    kind: "d1",
    mediaKind: media ? "r2" : "file",
    ready: ensure,
    async getUserById(id) {
      const row = await db.prepare("SELECT * FROM users WHERE id = ?").bind(id).first<UserRow>();
      return row ? userFrom(row) : null;
    },
    async listFeed({ q, model, tag, following, limit, offset, viewerId, mediaKind }) {
      const needle = (q || "").trim().toLowerCase();
      const tagNeedle = (tag || "").trim().toLowerCase();
      const take = Math.min(120, Math.max(1, Number(limit) || 40));
      const skip = Math.max(0, Math.floor(Number(offset) || 0));
      const kind = mediaKind === "video" ? "video" : mediaKind === "image" ? "image" : "";
      const where: string[] = ["hidden = 0", "visibility = 'public'"];
      const binds: unknown[] = [];
      if (kind) {
        where.push("media_kind = ?");
        binds.push(kind);
      } else {
        where.push("media_kind IN ('image', 'video')");
      }
      if (tagNeedle) {
        // Quoted JSON token so "nature" does not match "nature-scape".
        where.push("lower(tags) LIKE ?");
        binds.push(`%"${sanitizeLikeNeedle(tagNeedle.replace(/"/g, ""))}"%`);
      }
      if (needle) {
        const like = `%${sanitizeLikeNeedle(needle)}%`;
        where.push(`(
          lower(title) LIKE ? OR
          lower(prompt) LIKE ? OR
          lower(model) LIKE ? OR
          lower(tags) LIKE ? OR
          user_id IN (
            SELECT id FROM users
            WHERE lower(handle) LIKE ? OR lower(display_name) LIKE ?
          )
        )`);
        binds.push(like, like, like, like, like, like);
      }
      const whereSql = where.join(" AND ");
      const bindStmt = (sql: string, values: unknown[]) => {
        const stmt = db.prepare(sql);
        return values.length ? stmt.bind(...values) : stmt;
      };
      let total = 0;
      let rows: { results?: CreationRow[] };
      try {
        // When a display-time model filter is active, fetch a wider window then filter in JS
        // (modelMatches aliases). Otherwise page in SQL.
        const modelFilter = Boolean(model);
        const fetchLimit = modelFilter || following ? Math.min(500, Math.max(take + skip, take * 5)) : take;
        const fetchOffset = modelFilter || following ? 0 : skip;
        if (!modelFilter && !following) {
          const countRow = await bindStmt(`SELECT COUNT(*) AS n FROM creations WHERE ${whereSql}`, binds).first<{ n: number }>();
          total = Number(countRow?.n) || 0;
        }
        rows = await bindStmt(
          `SELECT * FROM creations WHERE ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
          [...binds, fetchLimit, fetchOffset],
        ).all<CreationRow>();
      } catch {
        return { items: [], total: 0 };
      }
      const matched: Creation[] = [];
      for (const row of rows.results || []) {
        let creation: Creation;
        try {
          creation = await hydrate(row, viewerId, { light: true });
        } catch {
          continue;
        }
        if (kind && creation.mediaKind !== kind) continue;
        if (creation.mediaKind !== "image" && creation.mediaKind !== "video") continue;
        if (following && !viewerId) continue;
        if (following && viewerId) {
          const follow = await db.prepare("SELECT 1 AS n FROM follows WHERE follower_id = ? AND followee_id = ?").bind(viewerId, creation.userId).first();
          if (!follow) continue;
        }
        if (model && !modelMatches({ id: creation.id, model: creation.model, mediaKind: creation.mediaKind }, model)) continue;
        if (tagNeedle && !creation.tags.some((value) => value.toLowerCase() === tagNeedle)) continue;
        matched.push(creation);
      }
      if (model || following) {
        total = matched.length;
        return { items: matched.slice(skip, skip + take), total };
      }
      return { items: matched, total };
    },
    async listCreators(q) {
      const rows = await db.prepare("SELECT * FROM users ORDER BY display_name").all<UserRow>();
      const query = (q || "").trim().toLowerCase();
      const people: PublicUser[] = [];
      for (const row of rows.results || []) {
        const user = userFrom(row);
        if (!user.usernameSet) continue;
        if (query && !row.handle.includes(query) && !row.display_name.toLowerCase().includes(query) && !row.bio.toLowerCase().includes(query)) continue;
        people.push(await toPublic(row));
      }
      return people.sort((a, b) => b.creationCount - a.creationCount || a.displayName.localeCompare(b.displayName));
    },
    async publicUser(handle, viewerId) {
      const row = await db.prepare("SELECT * FROM users WHERE handle = ?").bind(handle).first<UserRow>();
      return row ? toPublic(row, viewerId) : null;
    },
    async listByUser(userId, viewerId, includeHidden) {
      const rows = await db.prepare("SELECT * FROM creations WHERE user_id = ? ORDER BY featured DESC, created_at DESC").bind(userId).all<CreationRow>();
      const items: Creation[] = [];
      for (const row of rows.results || []) {
        if (row.media_kind !== "image" && row.media_kind !== "video") continue;
        if (!includeHidden && (row.hidden || row.visibility !== "public")) continue;
        items.push(await hydrate(row, viewerId));
      }
      return items;
    },
    async getCreation(id, viewerId) {
      const row = await db.prepare("SELECT * FROM creations WHERE id = ?").bind(id).first<CreationRow>();
      if (!row || (row.media_kind !== "image" && row.media_kind !== "video")) return null;
      return hydrate(row, viewerId);
    },
    async getMedia(id) {
      if (!media || !/^[\w.-]+$/.test(id)) return null;
      const object = await media.get(id);
      if (!object) return null;
      return { bytes: new Uint8Array(await object.arrayBuffer()), contentType: object.httpMetadata?.contentType || "application/octet-stream" };
    },
  };
}

