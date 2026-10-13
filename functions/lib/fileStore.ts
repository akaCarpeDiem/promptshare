import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { seedBundle } from "./seed.ts";
import type { ChainStep, Creation, PublicUser, Store, User } from "./types.ts";

interface FollowRow { followerId: string; followeeId: string }
interface MarkRow { userId: string; creationId: string }
interface StoredCreation extends Omit<Creation, "likeCount" | "saveCount" | "liked" | "saved"> {}

interface Db {
  users: User[];
  creations: StoredCreation[];
  follows: FollowRow[];
  likes: MarkRow[];
  saves: MarkRow[];
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
    creations,
    follows: [],
    likes: [],
    saves: [],
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
  };
}
