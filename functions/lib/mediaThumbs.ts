/** Grid-card thumbnail URLs. Full-res stays at /media/images and /media/posters. */

const THUMB_WIDTH = 640;

export function gridThumbUrl(src: string | undefined | null): string {
  const raw = String(src || "");
  if (!raw) return raw;
  if (raw.startsWith("/media/thumbs/")) return raw;
  const m = raw.match(/^(\/media\/(images|posters)\/)([^/?#]+?)(\.[a-z0-9]+)(\?.*)?$/i);
  if (!m) return raw;
  const folder = m[2].toLowerCase();
  const name = m[3];
  const query = m[5] || "";
  return `/media/thumbs/${folder}/${name}.webp${query}`;
}

export function thumbR2Key(pathname: string): string | null {
  const path = pathname.split("?")[0];
  if (!path.startsWith("/media/thumbs/")) return null;
  const rest = path.slice("/media/".length);
  if (!/^thumbs\/(images|posters)\/[a-zA-Z0-9._-]+\.(webp|avif)$/.test(rest)) return null;
  return `media/${rest}`;
}

export { THUMB_WIDTH };
