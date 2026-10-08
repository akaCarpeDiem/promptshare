# Plate permalink migration report

Deployed: Cloudflare Pages project `promptshare` (peek `https://27cb6b5d.promptshare-6is.pages.dev` → 301 to canonical). Live: **https://promptshare.fun**. Verified Sunday Sep 27, 2026 (PT).

## 1. URL scheme summary

| Pattern | Role |
|--------|------|
| `/p/{id}` | Public plate permalink (crawlable HTML via Pages Function) |
| `/u/{handle}` | Creator profile (unchanged SPA) |
| `/c/{id}` | **Legacy only** — 301 → `/p/{id}` when `{id}` is a creation id |
| `/archive/`, `/creators/` | Public indexes (unchanged) |
| `/c/{category}` category indexes | **Not added** — categories remain client-side filters only |

Canonical host only: `https://promptshare.fun` (existing middleware still 301s `*.pages.dev` and `www`).

API under `/api/*` unchanged.

## 2. How plate HTML is rendered

**Pages Function template** at `functions/p/[id].ts` (not a static prerender build).

- Loads D1 creation (+ author), returns **404** if missing/hidden.
- Unlisted: served with `noindex,nofollow`, excluded from sitemap.
- Fetches `index.html` from ASSETS (keeps AdSense + app JS/CSS), strips homepage title/meta, injects plate title, description, robots, canonical, Open Graph, Twitter, and **JSON-LD `CreativeWork`** (with `ImageObject` associatedMedia, author, `text` prompt).
- Replaces `#root` / `noscript` with a crawlable article: image (`alt` from title), full prompt in a `<pre>`, model, breakdown notes/steps, creator credit, and sharing controls (Copy prompt / Copy link / Open breakdown).
- React SPA still boots from the same shell and takes over the interactive plate view.

Legacy `functions/c/[id].ts` now only **301-redirects** known creation ids to `/p/{id}` (no longer OG-injects the SPA shell).

Client routes/links in `dist/assets/index-B-6coSuG.js` updated from `/c/` → `/p/` (gallery cards, upload redirect, route parse). Gallery card **styling** unchanged.

## 3. Five example live plate URLs

1. https://promptshare.fun/p/seed_burger  
2. https://promptshare.fun/p/seed_lake  
3. https://promptshare.fun/p/seed_astronaut  
4. https://promptshare.fun/p/seed_city  
5. https://promptshare.fun/p/seed_blossoms  

(Also live: `/p/seed_ice`. Old `/c/seed_burger` → **301** `Location: https://promptshare.fun/p/seed_burger`.)

## 4. Sitemap public URL counts

Single `sitemap.xml` urlset (plate count small; also shipped `sitemap-plates.xml` for future index split). `robots.txt` Sitemap line unchanged: `https://promptshare.fun/sitemap.xml`.

| Bucket | Count |
|--------|------:|
| Static (`/`, `/about/`, `/privacy/`, `/terms/`, `/contact/`, `/cookies/`, `/creators/`, `/archive/`) | 8 |
| Public plates (`/p/{id}`) | 6 |
| Public creators (`/u/{handle}`) | 3 |
| **Total** | **17** |

No unlisted/hidden plates, no `/upload` `/me`, no pages.dev URLs. Generated from live `/api/feed` + `/api/creators` (D1 CLI remote execute lacked token permission; API reflects production D1 seeds).

## 5. Sharing UX added / adjusted

On crawlable SSR plate HTML (works without account):

- **Copy prompt** (clipboard from prompt block)
- **Copy link** (clipboard of canonical `/p/{id}`)
- **Open breakdown** (anchor to breakdown section; steps/notes when present)

In the interactive SPA plate view:

- Existing **Copy prompt** kept
- **Share** label → **Copy link** (always copies URL; still may invoke `navigator.share` afterward)
- Chain `<details>` summary → **Open breakdown (N)** when earlier steps exist

## 6. Live verification (post-deploy)

| Check | Result |
|-------|--------|
| `GET /p/seed_burger` | 200; title, prompt, image alt, canonical, og:image, JSON-LD, model, creator in HTML |
| `GET /c/seed_burger` | **301** → `/p/seed_burger` |
| Other seeds `/p/seed_*` | 200 |
| Unknown `/p/...` | 404 |
| Unknown `/c/...` | 404 |
| Sitemap `/p/...` counts | 6 plate locs |
| AdSense script | Present (`ca-pub-4059575347806121`) |
| `ads.txt` | Intact (`google.com, pub-4059575347806121, DIRECT, f08c47fec0942fa0`) |
| Contact email | `support@promptshare.fun` untouched |

## 7. Blockers

- **None for permalinks / crawlability / redirects / sitemap.**
- Pre-existing: auth secrets may still be unset (sign-in); unrelated to this change.
- `wrangler d1 execute --remote` returned auth error with current token; sitemap used live API instead (accurate for current public set).

## Files touched

- `functions/p/[id].ts` (new)
- `functions/c/[id].ts` (301 migration)
- `dist/assets/index-B-6coSuG.js` (routes + share labels)
- `dist/_redirects`, `dist/sitemap.xml`, `dist/sitemap-plates.xml`, `dist/robots.txt`, `dist/OVERLAY_README.txt`
- Overlay mirrored per OVERLAY_README (`overlay/` copies of the above)

Constraints honored: no gallery card restyle; no blog network; no marketplace/generator/crypto/chatbot pivot; public browse needs no account; design kept; no invented `/c/` category pages.
