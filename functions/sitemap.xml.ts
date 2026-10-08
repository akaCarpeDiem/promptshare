import { createD1Store, type D1Database, type R2Bucket } from "./lib/d1.ts";
import type { AuthEnv } from "./lib/types.ts";

interface Env extends AuthEnv {
  DB?: D1Database;
  MEDIA?: R2Bucket;
}

const ORIGIN = "https://promptshare.fun";

const STATIC_PATHS = [
  "/",
  "/about/",
  "/privacy/",
  "/terms/",
  "/contact/",
  "/cookies/",
  "/creators/",
  "/images/",
  "/videos/",
  "/games/",
  "/games/paper-moths/",
  "/games/gate-comet/",
  "/games/lantern-stack/",
  "/games/roofline-crane/",
  "/games/upstream-koi/",
  "/games/kiln-break/",
  "/games/orchard-serpent/",
  "/games/belt-drift/",
  "/games/pulse-lanterns/",
  "/games/pier-watch/",
  "/games/courier-of-glass/",
  "/games/moss-steps/",
  "/games/wick-line/",
  "/games/loom-shuttle/",
  "/games/tide-bell/",
  "/games/soot-lantern/",
  "/games/night-press/",
  "/games/featured/",
];


const BROWSE_CATS = [
  "landscapes",
  "cities",
  "us-cities",
  "street",
  "people",
  "portraits",
  "cyberpunk",
  "futuristic",
  "animals",
  "fictional-animals",
  "myths",
  "comic",
  "anime",
  "food",
  "architecture",
  "space",
  "fantasy",
  "vehicles",
  "nature",
];

const CAT_PAGE_SIZE = 9;

function urlEntry(loc: string, lastmod?: string | null) {
  const lm = lastmod ? `\n    <lastmod>${escapeXml(lastmod.slice(0, 10))}</lastmod>` : "";
  return `  <url>\n    <loc>${escapeXml(loc)}</loc>${lm}\n  </url>`;
}

function escapeXml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function onlyFun(loc: string) {
  try {
    const u = new URL(loc);
    return u.protocol === "https:" && u.hostname === "promptshare.fun";
  } catch {
    return false;
  }
}

export const onRequest = async (context: { request: Request; env: Env }) => {
  const entries: string[] = [];

  for (const path of STATIC_PATHS) {
    const loc = `${ORIGIN}${path}`;
    if (onlyFun(loc)) entries.push(urlEntry(loc));
  }

  if (context.env.DB) {
    try {
      const store = createD1Store(context.env.DB, context.env.MEDIA);
      await store.ready();

      const plateRows = await context.env.DB.prepare(
        `SELECT id, created_at FROM creations
         WHERE hidden = 0 AND visibility = 'public' AND media_kind = 'image'
         ORDER BY created_at DESC
         LIMIT 5000`,
      ).all<{ id: string; created_at: string }>();

      for (const row of plateRows.results || []) {
        if (!row?.id) continue;
        const loc = `${ORIGIN}/p/${encodeURIComponent(row.id)}`;
        if (onlyFun(loc)) entries.push(urlEntry(loc, row.created_at || null));
      }

      const tagRows = await context.env.DB.prepare(
        `SELECT tags, media_kind FROM creations
         WHERE hidden = 0 AND visibility = 'public' AND media_kind IN ('image', 'video')`,
      ).all<{ tags: string; media_kind: string }>();
      const counts: Record<string, { image: number; video: number }> = {};
      for (const slug of BROWSE_CATS) counts[slug] = { image: 0, video: 0 };
      for (const row of tagRows.results || []) {
        let tags: string[] = [];
        try { tags = JSON.parse(row.tags || "[]"); } catch { tags = []; }
        const kind = row.media_kind === "video" ? "video" : "image";
        for (const raw of tags) {
          const slug = String(raw || "").trim().toLowerCase();
          if (!counts[slug]) continue;
          counts[slug][kind] += 1;
        }
      }
      for (const slug of BROWSE_CATS) {
        const imagePages = Math.max(1, Math.ceil(counts[slug].image / CAT_PAGE_SIZE));
        const videoPages = Math.max(1, Math.ceil(counts[slug].video / CAT_PAGE_SIZE));
        for (let page = 1; page <= imagePages; page++) {
          const loc = page === 1
            ? `${ORIGIN}/images/?tag=${encodeURIComponent(slug)}`
            : `${ORIGIN}/images/?tag=${encodeURIComponent(slug)}&page=${page}`;
          if (onlyFun(loc)) entries.push(urlEntry(loc));
        }
        for (let page = 1; page <= videoPages; page++) {
          const loc = page === 1
            ? `${ORIGIN}/videos/?tag=${encodeURIComponent(slug)}`
            : `${ORIGIN}/videos/?tag=${encodeURIComponent(slug)}&page=${page}`;
          if (onlyFun(loc)) entries.push(urlEntry(loc));
        }
      }

      const creatorRows = await context.env.DB.prepare(
        `SELECT DISTINCT u.handle
         FROM users u
         INNER JOIN creations c ON c.user_id = u.id
         WHERE c.hidden = 0 AND c.visibility = 'public' AND c.media_kind = 'image'
         ORDER BY u.handle
         LIMIT 5000`,
      ).all<{ handle: string }>();

      for (const row of creatorRows.results || []) {
        const handle = String(row?.handle || "").trim();
        if (!handle) continue;
        const loc = `${ORIGIN}/u/${encodeURIComponent(handle)}`;
        if (onlyFun(loc)) entries.push(urlEntry(loc));
      }
    } catch {
      // Fall through with static entries only if D1 is unavailable
    }
  }

  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join("\n")}\n</urlset>\n`;

  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, max-age=300",
    },
  });
};
