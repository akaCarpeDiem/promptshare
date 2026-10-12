import { createD1Store, type D1Database, type R2Bucket } from "./lib/d1.ts";
import type { AuthEnv } from "./lib/types.ts";

interface Env extends AuthEnv {
  DB?: D1Database;
  MEDIA?: R2Bucket;
}

const ORIGIN = "https://promptshare.co";

const STATIC_PATHS = [
  "/",
  "/about/",
  "/privacy/",
  "/terms/",
  "/contact/",
  "/cookies/",
  "/images/",
  "/videos/",
  "/words/",
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
    return u.protocol === "https:" && u.hostname === "promptshare.co";
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
         WHERE hidden = 0 AND visibility = 'public' AND media_kind IN ('image', 'video')
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
      // One URL per category that has anything in it. The galleries load more as you scroll, so there are no page numbers.
      for (const slug of BROWSE_CATS) {
        for (const [kind, base] of [["image", "/images/"], ["video", "/videos/"]] as const) {
          if (!counts[slug][kind]) continue;
          const loc = `${ORIGIN}${base}?tag=${encodeURIComponent(slug)}`;
          if (onlyFun(loc)) entries.push(urlEntry(loc));
        }
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
