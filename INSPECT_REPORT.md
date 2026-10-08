# PromptShare inspect report

Inspected `/workspace/promptshare-deploy` (dist + functions + overlay) and live https://promptshare.fun on 2026-09-27 PT.

## 1. Public routes

**Static HTML (crawlable):**
- `/` — SPA shell (`dist/index.html`); empty `#root`, light `noscript`
- `/about/`, `/privacy/`, `/terms/`, `/contact/`, `/cookies/` — static legal pages
- `/robots.txt`, `/sitemap.xml`
- `/ads.txt` — **missing**; live returns SPA HTML (`text/html`)
- Assets: `/assets/*`, `/fonts/*`, `/media/*`, icons, `og.png`, `sw.js`, `site.webmanifest`

**SPA client routes** (`_redirects` → `/index.html` 200; Functions own `/api/*` and `/c/:id`):
- `/creators/`, `/search/`, `/upload/`, `/me`, `/archive/`, `/archive/*`, `/u/:handle`, `/c/:id`
- Live quirk: bare `/creators`, `/archive`, `/search`, `/upload`, `/me` (no trailing slash) return **308 → `/`** (query preserved). Trailing-slash forms and `/u/*`, `/c/*` return 200.

**API (matter for product):**
- `GET /api/health`, `/api/feed`, `/api/creators`, `/api/users/:handle`, `/api/creations/:id`, `/api/media/:id`
- Auth: `POST /api/auth/magic`, `GET /api/auth/verify`, Google/Microsoft start+callback, `POST /api/auth/logout`, `GET|PATCH /api/me`, `POST /api/me/avatar`
- Social: create/hide/feature/like/save/report creations; follow users

## 2. Plate / permalink storage

**Creator network “creations” (D1 + R2):**
- Row in `creations` (+ optional `steps`); media in R2 (`MEDIA`)
- Stable public URL: **`https://promptshare.fun/c/:id`**
- Example: `https://promptshare.fun/c/seed_burger` (OG title injected by `functions/c/[id].ts`)
- Also profile: `/u/:handle`

**Archive study gallery (~194 plates):**
- Static files under `/media/*`; metadata + influential-word notes baked into `GalleryApp-*.js`
- Deep links via query: `plate`, `study`, `category`, `model` (and `q`) on the archive app
- Intended surface: `/archive/`; BUILD_REPORT says `/?plate=` etc. should redirect into archive (client)

## 3. Homepage HTML without JS

- `#root` is **empty**; no plate markup in the document
- `noscript` has a short paragraph + links to about/privacy/terms/contact/cookies — **no H1**, no “not a generator” pitch, no archive/creators links
- React mounts into `#root` after JS loads

## 4. robots.txt / sitemap.xml

**robots.txt (live + dist):**
```
User-agent: *
Allow: /

Sitemap: https://promptshare.fun/sitemap.xml
```
Missing required `Allow: /ads.txt`.

**sitemap.xml:** locs already use `https://promptshare.fun` only (/, /creators, /archive, /about/, /privacy/, /terms/, /contact/, /cookies/). Overlay copy is a shorter older set. Bare `/creators` and `/archive` currently 308→`/`; trailing-slash / folder forms are the reliable 200s.

## 5. `/ads.txt`

- No `dist/ads.txt`
- Live: **200 `text/html`** — full SPA `index.html` (must not)

## 6. Auth providers and upload limits

- Providers: **Google OAuth**, **Microsoft OAuth**, **email magic link** (Resend)
- Live `/api/health` auth: `google:false`, `microsoft:false`, `email:false`, `devLink:false` (secrets not set)
- Uploads: **images only** JPEG/PNG/WebP/GIF, **8 MB**, **20/user/hour**; base64 JSON body; video/audio rejected
- Prompt chain: up to 8 earlier steps; handle 3–20 `[a-z0-9_]`; 3 social links
- Session: HttpOnly `ps_session` 30d

## 7. Prompt breakdown notes

- **Archive:** curated in the GalleryApp bundle; prompt tokens carry `{note: {n, kind, means}}`; UI underline + “Prompt breakdown” ordered list. Not in D1. Interpretations, not creator commentary (stated on About/Terms).
- **Creator uploads:** optional per-step `note` (max 200 chars) stored in D1 `steps.note`. No automatic influential-word breakdown generator.

## 8. NSFW / report / hide

- **No NSFW flag**, blur-for-NSFW, or age gate in schema/API
- **Report:** `POST /api/creations/:id/report` (auth); stored in `reports`; no admin queue
- **Hide:** `POST /api/creations/:id/hide` (owner); sets `hidden=1`, drops from Discover/profile
- Unlisted still reachable by link

## 9. pages.dev / TODOs / leftover names

- Legal meta still lists **`https://promptshare-6is.pages.dev/`** beside promptshare.fun; cookies page mentions clearing data for pages.dev
- **No** canonical host redirect: pages.dev and **www.promptshare.fun** both serve 200 (duplicate)
- Contact email was **`support@promptshare.fun`** (akaCarpeDiem) on contact/about/cookies; privacy/terms Contact sections only linked `/contact/` with no mailto
- Unused old bundle `assets/index-DGwNeZiL.js` still contains **“PromptGallery”** string (not referenced by current `index.html`)
- No Market Check / LearnPokémon product copy in active shell; project sits beside those deploys on the box only
- AdSense intentionally off until real `ca-pub-` id (BUILD_REPORT)

## Deploy path

`cd /workspace/promptshare-deploy && npx wrangler pages deploy dist --project-name=promptshare` (functions/ beside dist; `pages_build_output_dir = "dist"`).
