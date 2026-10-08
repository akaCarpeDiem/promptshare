# PromptShare LIMITS_FIX_REPORT

Deployed: Cloudflare Pages project `promptshare`  
Peek: `https://b1cad8ab.promptshare-6is.pages.dev` (301 → canonical)  
Live: https://promptshare.fun  
Synced overlay → dist (media/ + fonts/ untouched).  
`npx wrangler pages deploy dist --project-name=promptshare`  
No product redesign / brand repositioning. Contact email unchanged. Times in PT.

## What changed

1. **Dynamic sitemap** — `functions/sitemap.xml.ts` serves `/sitemap.xml` from D1. Removed static `dist/sitemap.xml` / `overlay/sitemap.xml` so the Function wins. `robots.txt` still: `Sitemap: https://promptshare.fun/sitemap.xml`.
2. **PromptGallery scrub** — Deleted orphan unused bundles (including `index-DGwNeZiL.js` with hundreds of PromptGallery / promptgallery.fun strings). Live linked assets are PromptShare-only.
3. **Client 8 MB precheck** — Upload UI JS rejects before submit when `file.size > 8 * 1024 * 1024` with `Images are limited to 8 MB.` (onChange + submit + FileReader helper). Server check kept. Bundle renamed to `index-a11c6771.js` to bust immutable CDN cache.
4. **Optional Sightengine NSFW gate** — Server `takeMedia` calls Sightengine when both env secrets are set; otherwise skips (honest). Text `prohibitedContent` blocklist unchanged. Privacy documents the optional scan. Notes in `BUILD_REPORT.md` + `SETUP.md`.
5. **SSR plate Report** — Public `/p/{id}` SSR body now has “Report this plate” (interactive view / sign-in) plus mailto triage link. No new admin UI.

## How dynamic sitemap works

- Route: Pages Function `functions/sitemap.xml.ts` → `GET /sitemap.xml`.
- Always emits fixed https://promptshare.fun static paths: `/`, `/about/`, `/privacy/`, `/terms/`, `/contact/`, `/cookies/`, `/creators/`, `/archive/`.
- If D1 `DB` is bound: queries public `hidden=0`, `visibility='public'`, `media_kind='image'` creations → `/p/{id}`; distinct user handles with ≥1 such plate → `/u/{handle}`.
- Unlisted/hidden excluded. Non-`.fun` hosts filtered out.
- `Cache-Control: public, max-age=300`. No publish hook required — every request regenerates from live D1.

## NSFW — how to enable

Set **both** Pages secrets (Production; Preview if needed):

| Secret | Role |
| --- | --- |
| `SIGHTENGINE_API_USER` | Sightengine API user |
| `SIGHTENGINE_API_SECRET` | Sightengine API secret |

Behavior when both set: POST image bytes to `https://api.sightengine.com/1.0/check.json` with models `nudity-2.0,face-attributes`. Reject (conservative thresholds) on strong sexual/nudity scores **or** any meaningful minors-related face signal. User message: `This image was flagged by our safety check and can’t be published.`

If either secret is missing: vision check is **not** run (no fake scan). Text blocklist still runs. Vendor/network failure: fail-open (skip vision reject). Not claimed 100% accurate — privacy says so.

See `SETUP.md` and `BUILD_REPORT.md` bindings table.

## Leftover PromptGallery count

After scrub (live trees: `dist/`, `overlay/`, `functions/`, excluding historical `*.md` / `base*`):

**0** matches for `PromptGallery` / `promptgallery.fun`.

Live linked assets verified on https://promptshare.fun: `index.html` → `index-a11c6771.js` + `index-c49d2620.css` + `GalleryApp-7604d406.js` → **0** PromptGallery hits.

## Verify (live)

| Check | Result |
| --- | --- |
| `GET /sitemap.xml` | 200 `application/xml`; includes `/p/seed_*` + `/u/{mira,jonah,noor}`; hosts = `promptshare.fun` only |
| PromptGallery in linked assets | 0 |
| Upload JS size check | `size>8*1024*1024` ×3 + message `Images are limited to 8 MB.` |
| NSFW path | `checkSightengineNsfw` in `functions/lib/handler.ts` behind env |
| `GET /api/health` | `{"ok":true,"store":"d1","media":"r2",...}` |

## Files touched (high level)

- `functions/sitemap.xml.ts` (new)
- `functions/lib/handler.ts`, `functions/lib/types.ts`
- `functions/p/[id].ts` (Report link)
- `overlay/` + `dist/` assets, `index.html`, privacy, OVERLAY_README
- Removed static sitemaps + orphan asset bundles
- `BUILD_REPORT.md`, `SETUP.md`, this report
