import { createD1Store, type D1Database, type R2Bucket } from "../lib/d1.ts";
import type { AuthEnv } from "../lib/types.ts";

interface Env extends AuthEnv {
  DB?: D1Database;
  MEDIA?: R2Bucket;
  ASSETS: { fetch(input: Request | URL): Promise<Response> };
}

/**
 * Legacy plate URLs were /c/:id. Public plates now live at /p/:id.
 * 301 when the id is a known creation so seed links and old sitemap entries keep working.
 * Categories are client filters only — do not invent /c/ category indexes here.
 */
export const onRequest = async (context: {
  request: Request;
  env: Env;
  params: { id?: string };
}) => {
  const id = String(context.params.id || "").trim();
  const url = new URL(context.request.url);

  if (!id) {
    return new Response("Not found", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
  }

  // Prefer confirming the id is a creation; if DB is missing, still migrate the path
  // because /c/:id was only used for plates (not category pages).
  let isCreation = !context.env.DB;
  if (context.env.DB) {
    try {
      const store = createD1Store(context.env.DB, context.env.MEDIA);
      await store.ready();
      const creation = await store.getCreation(id);
      isCreation = Boolean(creation);
    } catch {
      isCreation = true; // fail open toward migration for known seed links
    }
  }

  if (!isCreation) {
    return new Response("Not found", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=60" },
    });
  }

  const dest = new URL(`/p/${encodeURIComponent(id)}`, url);
  dest.search = url.search;
  return Response.redirect(dest.toString(), 301);
};
