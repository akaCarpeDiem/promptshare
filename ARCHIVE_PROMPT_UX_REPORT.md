# Archive removal + prompt-under-media UX

Deployed Sunday Sep 27, 2026 (PT) to Cloudflare Pages project `promptshare`.

- Peek: https://09b27721.promptshare-6is.pages.dev (301 → canonical)
- Live: https://promptshare.fun
- Assets: `/assets/index-22c3e0bq.js`, `/assets/index-c49d2632.css`
- SW cache: `promptshare-shell-v14`
- Prior live (identity): `index-22c3e0bp.js` / `index-c49d2631.css` / `promptshare-shell-v13`

## Removed (Archive surface)

| Surface | Change |
| --- | --- |
| Primary nav | Dropped `Archive` link (Discover / Creators / Upload only) |
| Footer / legal chrome | Unchanged (never had Archive); SSR `/p/:id` footer no longer links Archive |
| `index.html` noscript + boot | Archive links removed |
| About / Terms / Privacy | Marketing copy no longer steers users into “the archive” |
| Upload limits copy | “use the archive for video…” → image-only publishing |
| `_redirects` | `/archive`, `/archive/`, `/archive/*` → **301 /** (no SPA shell) |
| `functions/sitemap.xml.ts` | `/archive/` removed from static paths |
| SPA router | Stopped lazy-loading `GalleryApp-*.js`; legacy `/?plate|study|…` and `/archive` rewrite to `/p/{seed}` or Discover/Search |

Deep-link map (Gallery id → network plate): `astronaut→seed_astronaut`, `mountain-lake→seed_lake`, `cyberpunk-city→seed_city`, `ice-volcano→seed_ice`, `cherry-blossoms→seed_blossoms`, `burger→seed_burger` (plus `seed_*` passthrough). `?category|model|q` on `/` goes to `/search?q=…`.

`GalleryApp-f8a8436f.js` remains on disk for reference / media study data but is **not** linked from chrome or the SPA entry.

## Prompt UX restored

Ported GalleryApp patterns (`phrase` / `phrase-btn` / `tip-card`, segmenter, kind labels, means/effect/why/craft) into the main SPA:

1. **Discover cards** — `PsPromptText` under media; influential phrases underlined when word-notes exist; hover/focus/tap tips; empty notes → plain prompt (no crash).
2. **`/p/:id`** — prompt under the stage with the same hover sheet; **Prompt breakdown →** scrolls to `#ps-breakdown`; marks mode + numbered note list; Copy prompt kept; chain-step `<details>` still present for multi-step seeds.
3. **Notes source** — client map `PS_SEED_NOTES` for the six studio seeds (lifted from GalleryApp curated notes). Also accepts future `creation.wordNotes` from the API. Notes are labeled **PromptShare interpretations**, not creator commentary / vendor docs.

CSS: extended `index-c49d2632.css` (card overflow for tips, `.ps-breakdown`, `.ps-word-notes`, `.prompt-actions`). Phrase/tip base styles were already in the identity CSS.

## Verify

- `node --check` on `index-22c3e0bq.js` — OK (local + live)
- `GET /api/health` — `ok: true` (d1/r2)
- Homepage script/link → `bq` / `2632`; SW → `v14`
- `/archive` and `/archive/` → 301 `/`
- Live sitemap — no `/archive/`

## Remaining gaps / risks

1. **Word-notes backfill** — User uploads and non-seed plates have empty word-notes (graceful empty state only). Need authoring/backfill (DB `wordNotes` or curation pipeline) beyond the six seeds.
2. **SSR `/p/:id`** — Crawlable HTML still shows plain `<pre>` prompt + chain notes; interactive underlines are SPA-only after hydrate.
3. **Gallery media kinds** — Video/audio/animation study plates are no longer reachable via Archive chrome. Files remain under `/media/`; product is image-network focused.
4. **Identity/auth** — Untouched paths (username onboard, password login, OTP). Risk is low; smoke-test sign-in after hard refresh if anything looks stale (SW bumped to v14).
5. **Tip vs card link** — Phrase controls `stopPropagation` inside Discover `<a class="card">`; still worth a quick mobile tap check.
6. **Old asset litter** — Prior `index-22c3e0b*.js` / css hashes still in `dist/assets/` (immutable cache). Safe to prune later; live HTML only references `bq`/`2632`.

## Files touched

- `dist/` + `overlay/`: `assets/index-22c3e0bq.js`, `assets/index-c49d2632.css`, `index.html`, `sw.js`, `_redirects`, about/terms/privacy
- `functions/sitemap.xml.ts`, `functions/p/[id].ts`
