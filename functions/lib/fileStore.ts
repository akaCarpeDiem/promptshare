import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { seedBundle } from "./seed.ts";
import type { ChainStep, Creation, PublicUser, Store, User } from "./types.ts";


const LOGIN_CODE_TTL_MS = 1000 * 60 * 15;
const LOGIN_CODE_MAX_ATTEMPTS = 5;

function bytesToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

async function hashLoginCode(email: string, code: string): Promise<string> {
  const data = new TextEncoder().encode(`ps-otp:${email}:${code}`);
  return bytesToHex(await crypto.subtle.digest("SHA-256", data));
}

function randomDigits(n: number): string {
  const bytes = new Uint8Array(n);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < n; i++) out += String(bytes[i]! % 10);
  return out;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i)! ^ b.charCodeAt(i)!;
  return diff === 0;
}


interface SessionRow { id: string; userId: string; expiresAt: number }
interface LoginCodeRow { email: string; codeHash: string; expiresAt: number; attempts: number }
interface OauthRow { state: string; provider: string; expiresAt: number }
interface FollowRow { followerId: string; followeeId: string }
interface MarkRow { userId: string; creationId: string }
interface ReportRow { id: string; creationId: string; reporterId: string; reason: string; createdAt: string }
interface RateRow { key: string; at: number }
interface StoredCreation extends Omit<Creation, "likeCount" | "saveCount" | "liked" | "saved"> {}

interface Db {
  users: User[];
  sessions: SessionRow[];
  loginCodes: LoginCodeRow[];
  oauth: OauthRow[];
  creations: StoredCreation[];
  follows: FollowRow[];
  likes: MarkRow[];
  saves: MarkRow[];
  reports: ReportRow[];
  rates: RateRow[];
}

const root = path.resolve(process.cwd(), ".data");
const dbPath = path.join(root, "db.json");
const mediaDir = path.join(root, "media");

let queue: Promise<void> = Promise.resolve();

function emptyDb(): Db {
  const seed = seedBundle();
  const creations: StoredCreation[] = seed.creations.map((item) => ({
    ...item,
    steps: item.steps.map((step, index) => ({ ...step, id: `step_${item.id}_${index}` })),
  }));
  return {
    users: seed.users,
    sessions: [],
    loginCodes: [],
    oauth: [],
    creations,
    follows: [],
    likes: [],
    saves: [],
    reports: [],
    rates: [],
  };
}

function reconcile(db: Db) {
  let changed = db.creations.some((item) => item.mediaKind !== "image");
  db.creations = db.creations.filter((item) => item.mediaKind === "image");
  const seed = seedBundle();
  for (const user of seed.users) {
    const current = db.users.find((item) => item.id === user.id);
    if (!current) {
      db.users.push(user);
      changed = true;
      continue;
    }
    if (current.bio !== user.bio) {
      current.bio = user.bio;
      changed = true;
    }
  }
  const byId = new Map(db.creations.map((item) => [item.id, item]));
  const bundleIds = new Set(seed.creations.map((item) => item.id));
  for (const item of seed.creations) {
    const prior = byId.get(item.id);
    if (prior) {
      const nextTags = JSON.stringify(item.tags);
      const priorTags = JSON.stringify(prior.tags);
      if (
        priorTags !== nextTags ||
        prior.title !== item.title ||
        prior.prompt !== item.prompt ||
        prior.mediaUrl !== item.mediaUrl ||
        prior.hidden !== item.hidden ||
        prior.featured !== item.featured
      ) {
        prior.tags = item.tags;
        prior.title = item.title;
        prior.prompt = item.prompt;
        prior.mediaUrl = item.mediaUrl;
        prior.hidden = item.hidden;
        prior.featured = item.featured;
        changed = true;
      }
      continue;
    }
    db.creations.push({
      ...item,
      steps: item.steps.map((step, index) => ({ ...step, id: `step_${item.id}_${index}` })),
    });
    changed = true;
  }
  // Drop renamed/retired studio seeds (mirror D1 prune).
  const before = db.creations.length;
  db.creations = db.creations.filter((item) => !item.id.startsWith("seed_") || bundleIds.has(item.id));
  if (db.creations.length !== before) changed = true;
  const live = new Set(db.creations.map((item) => item.id));
  const likes = db.likes.filter((row) => live.has(row.creationId));
  const saves = db.saves.filter((row) => live.has(row.creationId));
  if (likes.length !== db.likes.length || saves.length !== db.saves.length) changed = true;
  db.likes = likes;
  db.saves = saves;
  return changed;
}

async function load(): Promise<Db> {
  try {
    const raw = await readFile(dbPath, "utf8");
    const db = JSON.parse(raw) as Db;
    if (!Array.isArray(db.loginCodes)) db.loginCodes = [];
    let migrated = false;
    for (const user of db.users) {
      if (typeof (user as User).usernameSet !== "boolean") { (user as User).usernameSet = true; migrated = true; }
      if (typeof (user as User).passwordHash !== "string") { (user as User).passwordHash = ""; migrated = true; }
      if (typeof (user as User).passwordSalt !== "string") { (user as User).passwordSalt = ""; migrated = true; }
      if (typeof (user as User).passwordUpdatedAt !== "string") { (user as User).passwordUpdatedAt = ""; migrated = true; }
    }
    if (reconcile(db) || migrated) await save(db);
    return db;
  } catch {
    const db = emptyDb();
    await mkdir(root, { recursive: true });
    await writeFile(dbPath, JSON.stringify(db));
    return db;
  }
}

async function save(db: Db) {
  await mkdir(root, { recursive: true });
  await writeFile(dbPath, JSON.stringify(db));
}

function withDb<T>(fn: (db: Db) => Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const db = await load();
    const result = await fn(db);
    await save(db);
    return result;
  });
  queue = run.then(() => undefined, () => undefined);
  return run;
}

function hydrate(db: Db, item: StoredCreation, viewerId?: string | null): Creation {
  const likes = db.likes.filter((row) => row.creationId === item.id);
  const saves = db.saves.filter((row) => row.creationId === item.id);
  return {
    ...item,
    steps: [...item.steps].sort((a, b) => a.position - b.position),
    likeCount: likes.length,
    saveCount: saves.length,
    liked: Boolean(viewerId && likes.some((row) => row.userId === viewerId)),
    saved: Boolean(viewerId && saves.some((row) => row.userId === viewerId)),
  };
}

function toPublic(db: Db, user: User, viewerId?: string | null): PublicUser {
  return {
    id: user.id,
    handle: user.handle,
    displayName: user.displayName,
    bio: user.bio,
    website: user.website,
    avatarUrl: user.avatarUrl,
    socials: user.socials,
    followers: db.follows.filter((row) => row.followeeId === user.id).length,
    following: db.follows.filter((row) => row.followerId === user.id).length,
    creationCount: db.creations.filter((item) => item.userId === user.id && item.mediaKind === "image" && !item.hidden && item.visibility === "public").length,
    followed: Boolean(viewerId && db.follows.some((row) => row.followerId === viewerId && row.followeeId === user.id)),
  };
}

const MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  mp4: "video/mp4",
  webm: "video/webm",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
};

export function createFileStore(): Store {
  return {
    kind: "file",
    mediaKind: "file",
    async ready() {
      await load();
    },
    getUserById: (id) => withDb(async (db) => db.users.find((user) => user.id === id) ?? null),
    getUserByEmail: (email) => withDb(async (db) => db.users.find((user) => user.email === email) ?? null),
    getUserByHandle: (handle) => withDb(async (db) => {
      const normalized = String(handle || "").trim().toLowerCase();
      return db.users.find((user) => user.handle.toLowerCase() === normalized) ?? null;
    }),
    createUser: (input) => withDb(async (db) => {
      const user: User = {
        id: crypto.randomUUID(),
        email: input.email,
        handle: input.handle,
        displayName: input.displayName,
        bio: "",
        website: "",
        avatarUrl: "",
        socials: [],
        createdAt: new Date().toISOString(),
        usernameSet: input.usernameSet !== false,
        passwordHash: "",
        passwordSalt: "",
        passwordUpdatedAt: "",
      };
      db.users.push(user);
      return user;
    }),
    updateUser: (id, patch) => withDb(async (db) => {
      const user = db.users.find((item) => item.id === id);
      if (!user) throw new Error("User not found");
      Object.assign(user, patch);
      return user;
    }),
    deleteAccount: (userId) => withDb(async (db) => {
      const user = db.users.find((item) => item.id === userId);
      if (!user) return;
      const creationIds = new Set(db.creations.filter((item) => item.userId === userId).map((item) => item.id));
      db.likes = db.likes.filter((item) => item.userId !== userId && !creationIds.has(item.creationId));
      db.saves = db.saves.filter((item) => item.userId !== userId && !creationIds.has(item.creationId));
      db.follows = db.follows.filter((item) => item.followerId !== userId && item.followeeId !== userId);
      db.reports = db.reports.filter((item) => item.reporterId !== userId && !creationIds.has(item.creationId));
      db.sessions = db.sessions.filter((item) => item.userId !== userId);
      db.creations = db.creations.filter((item) => item.userId !== userId);
      db.loginCodes = db.loginCodes.filter((item) => item.email !== user.email);
      db.users = db.users.filter((item) => item.id !== userId);
    }),

    handleTaken: (handle, exceptUserId) => withDb(async (db) => {
      const normalized = String(handle || "").trim().toLowerCase();
      return db.users.some((user) => user.handle.toLowerCase() === normalized && user.id !== exceptUserId);
    }),
    createSession: (userId) => withDb(async (db) => {
      const row = { id: crypto.randomUUID(), userId, expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 30 };
      db.sessions.push(row);
      return { id: row.id, expiresAt: row.expiresAt };
    }),
    userForSession: (sessionId) => withDb(async (db) => {
      const row = db.sessions.find((item) => item.id === sessionId);
      if (!row || row.expiresAt < Date.now()) return null;
      return db.users.find((user) => user.id === row.userId) ?? null;
    }),
    deleteSession: (sessionId) => withDb(async (db) => {
      db.sessions = db.sessions.filter((item) => item.id !== sessionId);
    }),
    createLoginCode: (email) => withDb(async (db) => {
      const code = randomDigits(6);
      const codeHash = await hashLoginCode(email, code);
      const expiresAt = Date.now() + LOGIN_CODE_TTL_MS;
      db.loginCodes = db.loginCodes.filter((item) => item.email !== email);
      db.loginCodes.push({ email, codeHash, expiresAt, attempts: 0 });
      return { code, expiresAt };
    }),
    verifyLoginCode: (email, code) => withDb(async (db) => {
      const trimmed = String(code || "").trim();
      if (!/^\d{6}$/.test(trimmed)) return "invalid";
      const row = db.loginCodes.find((item) => item.email === email);
      if (!row) return "invalid";
      if (row.expiresAt < Date.now()) {
        db.loginCodes = db.loginCodes.filter((item) => item.email !== email);
        return "expired";
      }
      if (row.attempts >= LOGIN_CODE_MAX_ATTEMPTS) return "locked";
      const expect = await hashLoginCode(email, trimmed);
      if (!timingSafeEqual(expect, row.codeHash)) {
        row.attempts += 1;
        if (row.attempts >= LOGIN_CODE_MAX_ATTEMPTS) return "locked";
        return "invalid";
      }
      db.loginCodes = db.loginCodes.filter((item) => item.email !== email);
      return "ok";
    }),
    createOauthState: (provider) => withDb(async (db) => {
      const state = crypto.randomUUID();
      db.oauth.push({ state, provider, expiresAt: Date.now() + 1000 * 60 * 15 });
      return state;
    }),
    consumeOauthState: (state, provider) => withDb(async (db) => {
      const row = db.oauth.find((item) => item.state === state && item.provider === provider);
      db.oauth = db.oauth.filter((item) => item.state !== state);
      return Boolean(row && row.expiresAt >= Date.now());
    }),
    listFeed: ({ q, model, tag, following, limit, offset, viewerId, mediaKind }) => withDb(async (db) => {
      const query = (q || "").trim().toLowerCase();
      const tagNeedle = (tag || "").trim().toLowerCase();
      const kind = mediaKind === "video" ? "video" : mediaKind === "image" ? "image" : "";
      const skip = Math.max(0, Number(offset) || 0);
      const pageSize = Math.min(120, Math.max(1, Number(limit) || 40));
      const matched = db.creations
        .filter((item) => item.visibility === "public" && !item.hidden)
        .filter((item) => kind ? item.mediaKind === kind : item.mediaKind === "image" || item.mediaKind === "video")
        .filter((item) => {
          if (!following) return true;
          if (!viewerId) return false;
          return db.follows.some((row) => row.followerId === viewerId && row.followeeId === item.userId);
        })
        .filter((item) => {
          if (!model) return true;
          const hay = `${item.model} ${item.modelVersion || ""}`.toLowerCase();
          return hay.includes(model.toLowerCase());
        })
        .filter((item) => !tagNeedle || item.tags.some((value) => value.toLowerCase() === tagNeedle))
        .filter((item) => {
          if (!query) return true;
          const user = db.users.find((entry) => entry.id === item.userId);
          const blob = [item.title, item.prompt, item.model, item.modelVersion || "", item.tags.join(" "), user?.handle, user?.displayName, ...(item.steps || []).map((step) => step.prompt)].join(" ").toLowerCase();
          return blob.includes(query);
        })
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      return {
        items: matched.slice(skip, skip + pageSize).map((item) => hydrate(db, item, viewerId)),
        total: matched.length,
      };
    }),
    listCreators: (q) => withDb(async (db) => {
      const query = (q || "").trim().toLowerCase();
      return db.users
        .filter((user) => user.usernameSet !== false)
        .filter((user) => !query || user.handle.includes(query) || user.displayName.toLowerCase().includes(query) || user.bio.toLowerCase().includes(query))
        .map((user) => toPublic(db, user))
        .sort((a, b) => b.creationCount - a.creationCount || a.displayName.localeCompare(b.displayName));
    }),
    publicUser: (handle, viewerId) => withDb(async (db) => {
      const user = db.users.find((item) => item.handle === handle);
      return user ? toPublic(db, user, viewerId) : null;
    }),
    listByUser: (userId, viewerId, includeHidden) => withDb(async (db) => {
      return db.creations
        .filter((item) => item.userId === userId)
        .filter((item) => item.mediaKind === "image")
        .filter((item) => includeHidden || (!item.hidden && item.visibility === "public"))
        .sort((a, b) => Number(b.featured) - Number(a.featured) || b.createdAt.localeCompare(a.createdAt))
        .map((item) => hydrate(db, item, viewerId));
    }),
    getCreation: (id, viewerId) => withDb(async (db) => {
      const item = db.creations.find((entry) => entry.id === id);
      return item && item.mediaKind === "image" ? hydrate(db, item, viewerId) : null;
    }),
    createCreation: (input) => withDb(async (db) => {
      const steps: ChainStep[] = input.steps.map((step, index) => ({ ...step, id: crypto.randomUUID(), position: index }));
      const stored: StoredCreation = { ...input, steps };
      db.creations.push(stored);
      return hydrate(db, stored, input.userId);
    }),
    setFeatured: (userId, creationId) => withDb(async (db) => {
      for (const item of db.creations) {
        if (item.userId === userId) item.featured = item.id === creationId;
      }
    }),
    hideCreation: (userId, creationId) => withDb(async (db) => {
      const item = db.creations.find((entry) => entry.id === creationId && entry.userId === userId);
      if (!item) return false;
      item.hidden = true;
      item.featured = false;
      return true;
    }),
    toggleLike: (userId, creationId) => withDb(async (db) => {
      const existing = db.likes.find((row) => row.userId === userId && row.creationId === creationId);
      if (existing) db.likes = db.likes.filter((row) => row !== existing);
      else db.likes.push({ userId, creationId });
      return { liked: !existing, likeCount: db.likes.filter((row) => row.creationId === creationId).length };
    }),
    toggleSave: (userId, creationId) => withDb(async (db) => {
      const existing = db.saves.find((row) => row.userId === userId && row.creationId === creationId);
      if (existing) db.saves = db.saves.filter((row) => row !== existing);
      else db.saves.push({ userId, creationId });
      return { saved: !existing, saveCount: db.saves.filter((row) => row.creationId === creationId).length };
    }),
    setFollow: (followerId, followeeId, follow) => withDb(async (db) => {
      db.follows = db.follows.filter((row) => !(row.followerId === followerId && row.followeeId === followeeId));
      if (follow) db.follows.push({ followerId, followeeId });
    }),
    report: (input) => withDb(async (db) => {
      db.reports.push(input);
    }),
    putMedia: async (bytes, contentType, ext) => {
      await mkdir(mediaDir, { recursive: true });
      const id = `${crypto.randomUUID()}.${ext.replace(/[^a-z0-9]/gi, "") || "bin"}`;
      await writeFile(path.join(mediaDir, id), bytes);
      await writeFile(path.join(mediaDir, `${id}.type`), contentType);
      return `/api/media/${id}`;
    },
    getMedia: async (id) => {
      if (!/^[\w.-]+$/.test(id)) return null;
      try {
        const bytes = new Uint8Array(await readFile(path.join(mediaDir, id)));
        const ext = id.split(".").pop() || "";
        let contentType = MIME[ext] || "application/octet-stream";
        try {
          contentType = (await readFile(path.join(mediaDir, `${id}.type`), "utf8")).trim() || contentType;
        } catch { /* type sidecar optional */ }
        return { bytes, contentType };
      } catch {
        return null;
      }
    },
    rateLimit: (key, limit, windowMs) => withDb(async (db) => {
      const now = Date.now();
      db.rates = db.rates.filter((row) => now - row.at < windowMs);
      const count = db.rates.filter((row) => row.key === key).length;
      if (count >= limit) return false;
      db.rates.push({ key, at: now });
      return true;
    }),
  };
}
