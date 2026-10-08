#!/usr/bin/env node
/**
 * Serve overlay/ and proxy API + media from the live site.
 * Generates missing /media/thumbs/* on the fly with ffmpeg for local perf checks.
 */
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { readFile, mkdir, stat } from "node:fs/promises";
import { extname, join } from "node:path";
import { tmpdir } from "node:os";

const ROOT = new URL("../overlay/", import.meta.url).pathname;
const LIVE = process.env.LIVE_ORIGIN || "https://promptshare.fun";
const PORT = Number(process.env.PORT || 4173);
const THUMB_DIR = join(tmpdir(), "ps-browse-thumbs");
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".woff2": "font/woff2",
  ".json": "application/json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
};

function send(res, status, body, headers) {
  res.writeHead(status, headers);
  res.end(body);
}

async function proxy(req, res, url) {
  const upstream = await fetch(url, {
    method: req.method,
    headers: { accept: req.headers.accept || "*/*" },
  });
  const buf = Buffer.from(await upstream.arrayBuffer());
  const headers = {};
  upstream.headers.forEach((v, k) => {
    if (["content-encoding", "transfer-encoding", "content-length"].includes(k)) return;
    headers[k] = v;
  });
  send(res, upstream.status, buf, headers);
}

async function makeThumb(srcBuf, destPath) {
  await mkdir(join(destPath, ".."), { recursive: true });
  await new Promise((resolve, reject) => {
    const child = spawn(
      "ffmpeg",
      ["-y", "-i", "pipe:0", "-vf", "scale=640:-2", "-frames:v", "1", "-c:v", "libwebp", "-quality", "72", destPath],
      { stdio: ["pipe", "ignore", "pipe"] },
    );
    let err = "";
    child.stderr.on("data", (d) => {
      err += d;
    });
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(err || "ffmpeg failed"))));
    child.stdin.end(srcBuf);
  });
}

function thumbSourcePath(pathname) {
  const m = pathname.match(/^\/media\/thumbs\/(images|posters)\/([^/?#]+)\.(webp|avif)$/i);
  if (!m) return null;
  const folder = m[1];
  const name = m[2];
  if (folder === "posters") return `/media/posters/${name}.jpg`;
  return `/media/images/${name}.webp`;
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://127.0.0.1:${PORT}`);
    const path = url.pathname;

    if (path === "/api/feed") {
      const liveUrl = new URL(LIVE + path);
      url.searchParams.forEach((v, k) => {
        if (k !== "offset" && k !== "page") liveUrl.searchParams.set(k, v);
      });
      if (!liveUrl.searchParams.get("limit") || Number(liveUrl.searchParams.get("limit")) < 40) {
        liveUrl.searchParams.set("limit", "120");
      }
      const upstream = await fetch(liveUrl, { headers: { accept: "application/json" } });
      const data = await upstream.json();
      const all = Array.isArray(data.creations) ? data.creations : [];
      const limit = Math.min(120, Math.max(1, Number(url.searchParams.get("limit") || 40) || 40));
      const pageRaw = Number(url.searchParams.get("page") || 0);
      const offset = url.searchParams.get("offset") != null && url.searchParams.get("offset") !== ""
        ? Math.max(0, Number(url.searchParams.get("offset")) || 0)
        : pageRaw > 1
          ? (Math.floor(pageRaw) - 1) * limit
          : 0;
      const page = Math.floor(offset / limit) + 1;
      const creations = all.slice(offset, offset + limit).map((c) => {
        const model = String((c && c.model) || "");
        const fam = /^grok$/i.test(model.trim()) ? "grok" : /^midjourney$/i.test(model.trim()) ? "midjourney" : null;
        let displayModel = model || "Grok";
        if (fam === "midjourney") displayModel = "Midjourney V7";
        else if (fam === "grok") displayModel = c.mediaKind === "video" ? "Grok Imagine Video 1.5" : "Grok Imagine 2.0";
        return { ...c, model, displayModel };
      });
      const body = JSON.stringify({
        ...data,
        creations,
        total: typeof data.total === "number" ? data.total : all.length,
        limit,
        offset,
        page,
      });
      return send(res, 200, body, {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
      });
    }

    if (path.startsWith("/api/") || path.startsWith("/p/") || path.startsWith("/fonts/")) {
      return proxy(req, res, LIVE + path + url.search);
    }

    if (path.startsWith("/media/thumbs/")) {
      const dest = join(THUMB_DIR, path.replace(/^\/media\/thumbs\//, ""));
      try {
        const existing = await readFile(dest);
        return send(res, 200, existing, {
          "content-type": "image/webp",
          "cache-control": "public, max-age=86400",
        });
      } catch {
        /* generate */
      }
      const sourcePath = thumbSourcePath(path);
      if (!sourcePath) return send(res, 404, "not found");
      const up = await fetch(LIVE + sourcePath + url.search);
      if (!up.ok) {
        const fallback = await fetch(LIVE + sourcePath);
        if (!fallback.ok) return send(res, 404, "not found");
        const buf = Buffer.from(await fallback.arrayBuffer());
        await makeThumb(buf, dest);
      } else {
        const buf = Buffer.from(await up.arrayBuffer());
        await makeThumb(buf, dest);
      }
      const out = await readFile(dest);
      return send(res, 200, out, {
        "content-type": "image/webp",
        "cache-control": "public, max-age=86400",
      });
    }

    if (path.startsWith("/media/") || path.startsWith("/games/")) {
      return proxy(req, res, LIVE + path + url.search);
    }

    let file = path;
    if (file.endsWith("/")) file += "index.html";
    const abs = join(ROOT, file.replace(/^\/+/, ""));
    try {
      const st = await stat(abs);
      if (st.isFile()) {
        const body = await readFile(abs);
        return send(res, 200, body, { "content-type": TYPES[extname(abs)] || "application/octet-stream" });
      }
    } catch {
      /* fall through */
    }
    const fallback = await readFile(join(ROOT, "index.html"));
    return send(res, 200, fallback, { "content-type": "text/html; charset=utf-8" });
  } catch (err) {
    send(res, 500, String(err && err.message ? err.message : err));
  }
});

await mkdir(THUMB_DIR, { recursive: true });
server.listen(PORT, "127.0.0.1", () => {
  console.log(`local preview http://127.0.0.1:${PORT}  (overlay + live API/media, generated thumbs)`);
});
