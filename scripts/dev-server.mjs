#!/usr/bin/env node
/**
 * Local PromptShare: serves a site folder and runs the real Pages Functions
 * (functions/api, functions/p, functions/sitemap.xml) under Node, with
 * SQLite standing in for D1 and the repo's media folder standing in for R2.
 * No wrangler, no network.
 *
 *   node scripts/dev-server.mjs [--site overlay] [--port 4173] [--db :memory:]
 *
 * Missing browse thumbnails, video posters and hover previews are generated
 * on first request into a cache folder, so the gallery looks like production.
 */
import { createServer } from "node:http";
import { DatabaseSync } from "node:sqlite";
import { readFile, stat, mkdir, access, rename } from "node:fs/promises";
import { createReadStream, existsSync, readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { extname, join, resolve, dirname, basename } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { tmpdir } from "node:os";
import { register } from "node:module";

// A few function modules import siblings without the ".ts" suffix (fine for wrangler's bundler, not for Node).
register(
  "data:text/javascript," +
    encodeURIComponent(
      `export async function resolve(spec, ctx, next) {
         try { return await next(spec, ctx); }
         catch (e) {
           if (e.code === "ERR_MODULE_NOT_FOUND" && /^\\.{1,2}\\//.test(spec) && !/\\.[a-z]+$/.test(spec)) return next(spec + ".ts", ctx);
           throw e;
         }
       }`,
    ),
  import.meta.url,
);

const arg = (name, fallback) => {
  const i = process.argv.indexOf("--" + name);
  return i > -1 ? process.argv[i + 1] : fallback;
};
const REPO = resolve(arg("repo", join(dirname(fileURLToPath(import.meta.url)), "..")));
const SITE = resolve(REPO, arg("site", "overlay"));
const MEDIA = resolve(REPO, arg("media", "overlay/media"));
const PLACEHOLDERS = arg("placeholders", "on") !== "off"; // stand-in clips for videos that exist only in R2
const PORT = Number(arg("port", process.env.PORT || 4173));
const CACHE = resolve(arg("cache", join(tmpdir(), "promptshare-dev-cache")));
const ORIGIN = `http://127.0.0.1:${PORT}`;

const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml",
  ".png": "image/png", ".webp": "image/webp", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".avif": "image/avif",
  ".woff2": "font/woff2", ".mp4": "video/mp4", ".webm": "video/webm", ".mp3": "audio/mpeg", ".ico": "image/x-icon",
  ".xml": "application/xml; charset=utf-8", ".txt": "text/plain; charset=utf-8", ".webmanifest": "application/manifest+json",
};

/* ------------------------------------------------------------------ D1 */

const norm = (v) => (v === undefined ? null : typeof v === "boolean" ? (v ? 1 : 0) : v);
function d1(path) {
  const db = new DatabaseSync(path);
  const make = (sql, args = []) => ({
    bind: (...a) => make(sql, a.map(norm)),
    first: async (col) => {
      const row = db.prepare(sql).get(...args);
      return row == null ? null : col ? row[col] : { ...row };
    },
    all: async () => ({ results: db.prepare(sql).all(...args).map((r) => ({ ...r })), success: true, meta: {} }),
    raw: async () => db.prepare(sql).all(...args).map((r) => Object.values(r)),
    run: async () => {
      const r = db.prepare(sql).run(...args);
      return { success: true, meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } };
    },
  });
  return {
    prepare: (sql) => make(sql),
    exec: async (sql) => db.exec(sql),
    batch: async (list) => Promise.all(list.map((s) => s.run())),
    _raw: db,
  };
}

/* ------------------------------------------------------------ media */

const run = (cmd, args) =>
  new Promise((ok, fail) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    child.stderr.on("data", (d) => (err += d));
    child.on("exit", (code) => (code === 0 ? ok() : fail(new Error(err.slice(-400)))));
  });
const exists = (p) => access(p).then(() => true, () => false);
const inflight = new Map();
const once = (key, fn) => {
  if (!inflight.has(key)) inflight.set(key, fn().finally(() => inflight.delete(key)));
  return inflight.get(key);
};

/** Map a /media/... URL to a file, generating derived files (thumbs, posters, previews) when missing. */
async function mediaFile(pathname) {
  const rel = decodeURIComponent(pathname.replace(/^\/media\//, ""));
  if (rel.includes("..")) return null;
  const direct = join(MEDIA, rel);
  if (await exists(direct)) return direct;
  const cached = join(CACHE, rel);
  if (await exists(cached)) return cached;
  let m;
  const build = async (src, args) => {
    if (!(await exists(src))) return null;
    await mkdir(dirname(cached), { recursive: true });
    await once(cached, () => make(["-i", src, ...args]));
    return cached;
  };
  // Write beside the target and rename, so a second request never reads a half-written file.
  const make = async (args) => {
    const part = join(dirname(cached), `.part-${process.pid}-${Date.now()}-${basename(cached)}`);
    await run("ffmpeg", ["-y", "-loglevel", "error", ...args, part]);
    await rename(part, cached);
  };
  if ((m = rel.match(/^thumbs\/images\/(.+)\.webp$/))) return build(join(MEDIA, "images", m[1] + ".webp"), ["-vf", "scale=640:-2", "-frames:v", "1", "-quality", "74"]);
  if ((m = rel.match(/^thumbs\/posters\/(.+)\.webp$/))) {
    const poster = await mediaFile(`/media/posters/${m[1]}.jpg`);
    return poster ? build(poster, ["-vf", "scale=640:-2", "-frames:v", "1", "-quality", "74"]) : null;
  }
  if ((m = rel.match(/^posters\/(.+)\.jpg$/))) {
    const master = await mediaFile(`/media/video/${m[1]}.mp4`);
    return master ? build(master, ["-ss", "0.6", "-frames:v", "1", "-q:v", "3"]) : null;
  }
  if ((m = rel.match(/^video-preview\/(.+\.mp4)$/))) return mediaFile(`/media/video/${m[1]}`); // the master stands in for the 720p proxy locally
  if (PLACEHOLDERS && (m = rel.match(/^video\/(.+)\.mp4$/))) {
    // Most clips live only in R2. A generated stand-in keeps layouts testable offline; it is plainly not the real clip.
    // VP9 so that it also plays in open-source Chromium builds (Playwright), which ship without H.264.
    let seed = 0;
    for (const ch of m[1]) seed = (seed * 31 + ch.charCodeAt(0)) % 100000;
    await mkdir(dirname(cached), { recursive: true });
    await once(cached, () => make(["-f", "lavfi", "-i", `gradients=s=1280x720:d=4:speed=0.02:seed=${seed}:n=4`, "-vf", "eq=brightness=-0.12:saturation=0.8", "-c:v", "libvpx-vp9", "-crf", "42", "-b:v", "0", "-deadline", "realtime", "-cpu-used", "8", "-pix_fmt", "yuv420p", "-movflags", "+faststart"]));
    return cached;
  }
  return null;
}

async function sendFile(req, res, file, extraHeaders = {}) {
  const info = await stat(file);
  const type = TYPES[extname(file).toLowerCase()] || "application/octet-stream";
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || "");
  if (range && info.size) {
    const start = range[1] ? Number(range[1]) : Math.max(0, info.size - Number(range[2]));
    const end = range[1] && range[2] ? Math.min(Number(range[2]), info.size - 1) : info.size - 1;
    res.writeHead(206, { "content-type": type, "accept-ranges": "bytes", "content-range": `bytes ${start}-${end}/${info.size}`, "content-length": end - start + 1, ...extraHeaders });
    return createReadStream(file, { start, end }).pipe(res);
  }
  res.writeHead(200, { "content-type": type, "content-length": info.size, "accept-ranges": "bytes", "cache-control": "no-store", ...extraHeaders });
  if (req.method === "HEAD") return res.end();
  createReadStream(file).pipe(res);
}

/* ---------------------------------------------------------- static */

function loadRedirects() {
  const file = join(SITE, "_redirects");
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf8").split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#")).map((l) => {
    const [from, to, status = "301"] = l.split(/\s+/);
    return { from, to, status: Number(status) };
  });
}
const matchRule = (rule, path) => {
  if (rule.from.endsWith("/*")) return path.startsWith(rule.from.slice(0, -1)) ? path.slice(rule.from.length - 1) : null;
  return rule.from === path ? "" : null;
};

async function staticFile(pathname) {
  const clean = decodeURIComponent(pathname);
  if (clean.includes("..")) return null;
  let file = join(SITE, clean);
  try {
    const info = await stat(file);
    if (info.isDirectory()) file = join(file, "index.html");
    await stat(file);
    return file;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------- functions */

const fn = (rel) => import(pathToFileURL(join(REPO, "functions", rel)).href);
const DB = d1(arg("db", ":memory:"));
const env = {
  DB,
  SCORE_SALT: "local-dev",
  ASSETS: {
    fetch: async (input) => {
      const url = input instanceof URL ? input : new URL(typeof input === "string" ? input : input.url);
      const file = await staticFile(url.pathname);
      return file ? new Response(await readFile(file), { headers: { "content-type": TYPES[extname(file)] || "text/plain" } }) : new Response("Not found", { status: 404 });
    },
  },
};

async function toRequest(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) if (typeof v === "string") headers.set(k, v);
  const hasBody = !["GET", "HEAD"].includes(req.method);
  return new Request(ORIGIN + req.url, { method: req.method, headers, body: hasBody ? Buffer.concat(chunks) : undefined });
}
async function sendResponse(res, response) {
  const headers = {};
  response.headers.forEach((v, k) => (headers[k] = v));
  const cookies = response.headers.getSetCookie?.() || [];
  if (cookies.length) headers["set-cookie"] = cookies;
  res.writeHead(response.status, headers);
  res.end(Buffer.from(await response.arrayBuffer()));
}

const redirects = loadRedirects();

const server = createServer(async (req, res) => {
  const url = new URL(req.url, ORIGIN);
  const path = url.pathname;
  try {
    if (path.startsWith("/api/")) {
      const { onRequest } = await fn("api/[[path]].ts");
      return sendResponse(res, await onRequest({ request: await toRequest(req), env }));
    }
    if (path === "/sitemap.xml") {
      const { onRequest } = await fn("sitemap.xml.ts");
      return sendResponse(res, await onRequest({ request: await toRequest(req), env }));
    }
    let m;
    if ((m = path.match(/^\/p\/([^/]+)\/?$/))) {
      const { onRequest } = await fn("p/[id].ts");
      return sendResponse(res, await onRequest({ request: await toRequest(req), env, params: { id: decodeURIComponent(m[1]) } }));
    }
    if ((m = path.match(/^\/c\/([^/]+)\/?$/))) {
      const { onRequest } = await fn("c/[id].ts");
      return sendResponse(res, await onRequest({ request: await toRequest(req), env, params: { id: decodeURIComponent(m[1]) } }));
    }
    if (path.startsWith("/media/")) {
      const file = await mediaFile(path);
      if (file) return sendFile(req, res, file);
      res.writeHead(404, { "content-type": "text/plain" });
      return res.end("media not in this checkout: " + path);
    }
    const direct = await staticFile(path);
    if (direct) return sendFile(req, res, direct);
    for (const rule of redirects) {
      const splat = matchRule(rule, path);
      if (splat == null) continue;
      const target = rule.to.replace(":splat", splat);
      if (rule.status === 200) {
        const file = await staticFile(target);
        if (file) return sendFile(req, res, file);
      } else {
        res.writeHead(rule.status, { location: target + url.search });
        return res.end();
      }
    }
    if (path.startsWith("/assets/")) {
      res.writeHead(404, { "content-type": "text/plain" });
      return res.end("Not found");
    }
    // Like Pages: an unknown path gets 404.html with a 404 status.
    const notFound = await staticFile("/404.html");
    res.writeHead(404, { "content-type": notFound ? "text/html; charset=utf-8" : "text/plain" });
    res.end(notFound ? await readFile(notFound) : "Not found");
  } catch (err) {
    console.error(path, err);
    res.writeHead(500, { "content-type": "text/plain" });
    res.end(String(err && err.stack || err));
  }
});

const schema = join(REPO, "schema.sql");
if (existsSync(schema)) DB._raw.exec(readFileSync(schema, "utf8"));
for (const extra of ["scripts/migrations-2026-10-07-players.sql"]) {
  const f = join(REPO, extra);
  if (existsSync(f)) { try { DB._raw.exec(readFileSync(f, "utf8")); } catch (e) { console.warn("migration skipped:", extra, e.message); } }
}
server.listen(PORT, "127.0.0.1", () => console.log(`PromptShare local: ${ORIGIN}  (site: ${SITE})`));
