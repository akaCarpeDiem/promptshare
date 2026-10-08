# PromptShare must-fix report

Deployed to Cloudflare Pages project `promptshare` (latest peek host `https://83bbf319.promptshare-6is.pages.dev`, which 301s to canonical). Live: https://promptshare.fun. Timezone notes in PT.

## Inspect answers (1–9)

1. **Public routes:** Static `/`, `/about/`, `/privacy/`, `/terms/`, `/contact/`, `/cookies/`, `/robots.txt`, `/sitemap.xml`, `/ads.txt`; SPA `/creators/`, `/search/`, `/upload/`, `/me/`, `/archive/`, `/u/:handle`, `/c/:id`; API under `/api/*` (health, feed, creators, auth, me, creations, social). Functions: `api/[[path]].ts`, `c/[id].ts`, `_middleware.ts`.
2. **Plate storage / URL:** Creator plates in D1 (+ R2 media). Stable URL **`https://promptshare.fun/c/:id`** (example `https://promptshare.fun/c/seed_burger`, OG via `functions/c/[id].ts`). Archive study plates: static `/media/*` + notes in GalleryApp JS; deep links `?plate=&study=&category=&model=` on `/archive/`.
3. **Homepage without JS:** Previously empty `#root`. Now crawlable H1 + pitch + disclaimer + links inside `#root` (React replaces on load) and matching `noscript`.
4. **robots / sitemap:** robots now Allow `/`, Allow `/ads.txt`, Sitemap `https://promptshare.fun/sitemap.xml`. Sitemap locs all `https://promptshare.fun` (expanded with verified 200 studio profiles + seed creations).
5. **ads.txt:** Was SPA HTML. Now `text/plain` comment only: `# ads.txt reserved — publisher ID not yet published` (no google.com pub line).
6. **Auth / uploads:** Google, Microsoft, magic-link (Resend). Live secrets unset (`google/microsoft/email: false`). Images only, 8 MB, 20/user/hour.
7. **Breakdown notes:** Archive: curated `{note: {n,kind,means}}` in GalleryApp bundle. Uploads: optional step `note` in D1 (no auto generator).
8. **NSFW / report / hide:** No NSFW flag. Report (auth) → `reports` table, no admin UI. Hide (owner) → `hidden=1`.
9. **Leftovers:** Removed pages.dev from legal “applies to” copy. Replaced `support@promptshare.fun` with `support@promptshare.fun`. Old unused `index-DGwNeZiL.js` still contains “PromptGallery” string (not linked from current shell). Canonical middleware added for pages.dev + www.

## What changed

- `functions/_middleware.ts` — 301 `*.pages.dev` and `www.promptshare.fun` → `https://promptshare.fun` + path/query; assets HTML soft-404 guard
- `dist/robots.txt`, `dist/ads.txt`, `dist/sitemap.xml`, `dist/_redirects`, `dist/_headers`
- Crawlable homepage shell in `dist/index.html` (+ disclaimer)
- Contact email → **`support@promptshare.fun`** on contact/about/privacy/terms/cookies (and overlay), wrapped in `<!--email_off-->` so CF does not show `[email protected]`
- `PUBLIC_EMAIL` file + `functions/lib/publicContact.ts` constant
- SPA bare paths `/creators` etc. now **301 → trailing-slash** then 200 shell (fixed prior 308→`/`)

## Public routes (live status)

| Path | Status |
|------|--------|
| `/` | 200 |
| `/robots.txt` | 200 text/plain |
| `/sitemap.xml` | 200 |
| `/ads.txt` | 200 text/plain |
| `/about/`, `/contact/`, `/privacy/`, `/terms/`, `/cookies/` | 200 |
| `/creators/`, `/archive/`, `/search/`, `/upload/` | 200 |
| `/creators`, `/archive` (no slash) | 301 → trailing-slash form |
| `/u/mira` (also jonah, noor) | 200 |
| `/c/seed_burger` (and other seeds) | 200 |
| `https://promptshare-6is.pages.dev/*` | **301** → `https://promptshare.fun/*` |
| `https://www.promptshare.fun/*` | **301** → `https://promptshare.fun/*` |

## Canonical behavior

`pages.dev` (project + per-deploy) and `www` → **301** to matching path on `https://promptshare.fun`.

## Individual plate URLs

- Creator network: **`https://promptshare.fun/c/<id>`** — example **`https://promptshare.fun/c/seed_burger`**
- Archive: **`https://promptshare.fun/archive/?plate=<id>`** (client/query; not separate static HTML files)

## ads.txt

- Body: `# ads.txt reserved — publisher ID not yet published`
- Content-Type: `text/plain; charset=utf-8`

## Contact email used

**`support@promptshare.fun`** (mailto + visible text on /contact /about /privacy /terms /cookies). akaCarpeDiem address removed from public pages.

## Blockers left untouched

- Auth secrets still unset on production: `GOOGLE_CLIENT_*`, `MICROSOFT_CLIENT_*`, `RESEND_API_KEY` (and optional `MAIL_FROM` / `PUBLIC_ORIGIN`). Sign-in buttons/API report not configured; browsing works.
- No admin report queue (reports stored only).
- AdSense still off (intentional; no fake pub id).
- Unused legacy JS asset still mentions PromptGallery (not referenced by live `index.html`).
