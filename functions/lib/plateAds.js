/**
 * AdSense on /p/{id} plate pages.
 *
 * A plate page is the picture, the prompt, and the notes written for that plate
 * (the `means` strings in overlay/data/notes.json). On the current catalogue the
 * visible reading — prompt, notes, and the short headings around them — clusters
 * near 190 words. The part an editor can lengthen is the plate's own notes.
 *
 * Ads and indexing stay on when those notes total at least MIN_PLATE_NOTE_WORDS
 * words. Under that, the page omits the AdSense loader and is noindex,follow.
 * The prompt text and shared glossary lines do not count: the same glossary
 * sentence appears on many plates, and lengthening the prompt does not add an
 * explanation. To bring a plate back, lengthen its `means` text to the minimum
 * or more, then add https://promptshare.co/p/{id} to overlay/sitemap.xml.
 *
 * Home and the section pages (Images, Videos, Words, Games, About, policies)
 * do not use this check. 404 and /search/ omit the loader in scripts/build-site.mjs.
 */

export const MIN_PLATE_NOTE_WORDS = 40;

/** Words separated by whitespace. A hyphenated word counts as one. */
export function wordCount(text) {
  const trimmed = String(text ?? "").trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

/**
 * @param {Array<{ means?: string }> | null | undefined} notes
 */
export function plateNoteWords(notes) {
  if (!Array.isArray(notes) || !notes.length) return 0;
  return wordCount(notes.map((note) => note?.means || "").join(" "));
}

/** True when this plate is long enough to load AdSense and stay in the index. */
export function plateServesAds(notes) {
  return plateNoteWords(notes) >= MIN_PLATE_NOTE_WORDS;
}

// The loader scripts/build-site.mjs writes into <head>. Match the tag if the
// line break or quotes shift a little. Analytics (gtag) is a different host.
const ADSENSE_SCRIPT =
  /[ \t]*<script\b[^>]*\bsrc=["']https:\/\/pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js[^"']*["'][^>]*>\s*<\/script>\s*/gi;

/** Remove the AdSense loader. Other scripts, including Analytics, stay. */
export function stripAdSense(html) {
  return String(html).replace(ADSENSE_SCRIPT, "");
}
