/**
 * Canonical host: 301 *.pages.dev and www → https://promptshare.fun (keep path+query)
 * Also avoid SPA HTML soft-404s under /assets/* (wrong MIME).
 */

const CANONICAL_HOST = "promptshare.fun";

export async function onRequest(context: {
  request: Request;
  next: () => Promise<Response>;
}): Promise<Response> {
  const url = new URL(context.request.url);
  const host = url.hostname.toLowerCase();

  if (host !== CANONICAL_HOST) {
    const isPagesDev = host.endsWith(".pages.dev");
    const isWww = host === `www.${CANONICAL_HOST}`;
    if (isPagesDev || isWww) {
      const dest = `https://${CANONICAL_HOST}${url.pathname}${url.search}`;
      return Response.redirect(dest, 301);
    }
  }

  if (!url.pathname.startsWith("/assets/")) {
    return context.next();
  }

  const res = await context.next();
  const ct = (res.headers.get("content-type") || "").toLowerCase();
  if (res.ok && ct.includes("text/html")) {
    return new Response("Not found", {
      status: 404,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "public, max-age=60",
        "x-content-type-options": "nosniff",
      },
    });
  }
  return res;
}
