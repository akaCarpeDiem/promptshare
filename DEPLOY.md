# PromptShare deploy notes

**Canonical:** https://promptshare.co/
**Pages project:** `promptshare` (D1 `DB`, R2 `MEDIA`, Workers AI `AI`; see `wrangler.toml`)
**Preview alias:** `promptshare-6is.pages.dev` must stay **301 → promptshare.co** (`functions/_middleware.ts`)

The front end was rebuilt in October 2026. How it is put together is in `FRONTEND.md`.
Notes from before the rebuild are kept in `docs/DEPLOY-before-2026-10-rebuild.md`; the parts of
that file about media, video rules and game identity still apply, the parts about `assets/ps-*.js`,
the React bundle and the old header do not.

## Positioning (locked)

Educational **curated gallery**: operator content only. No public uploads, no accounts to browse.
Since the rebuild the site no longer shows like counts, studio/creator pages or sign-in. On 2026-10-12 the
sign-in/account/Resend API code was removed too (D1 data untouched); those pages have no front end (`/creators`, `/u/*`, `/me` → 301 `/`).

## Deploy

```bash
cd /workspace/promptshare-deploy

# 1. Rebuild the HTML if overlay/app, overlay/data, content/ or scripts/build-site.mjs changed.
#    The result is committed, so this is only needed after an edit.
node scripts/build-site.mjs                 # new home page at /
# node scripts/build-site.mjs --home panels # or: three-panel home page at /

# 2. FIRST deploy of the rebuild only: clear the old front end out of dist/.
#    Keep dist/media and dist/fonts. Everything else in dist/ comes from overlay/.
find dist -mindepth 1 -maxdepth 1 ! -name media ! -name fonts -exec rm -rf {} +

# 3. Sync and deploy, as before.
cp -a overlay/. dist/
rm -f dist/sitemap.xml   # /sitemap.xml is served by functions/sitemap.xml.ts
export WRANGLER_CACHE_DIR=/tmp/wrangler-cache
npx wrangler pages deploy dist --project-name=promptshare
```

Keep `functions/` beside `dist/`. This deploy changes three functions: `functions/lib/handler.ts`
(new `GET /api/catalog`), `functions/p/[id].ts` (plate page markup) and `functions/sitemap.xml.ts`.
No D1 migration and no new secret.

## Check after deploy

- `/` loads, the example on the right reads a prompt out phrase by phrase, and the theme button switches light/dark.
- `/api/catalog` returns `{ plates: [...], total }` with every public image and video (472 at the time of writing).
- `/images/`, `/videos/`: cards show, a category chip filters, opening a card and pressing Back returns to the same scroll position.
- `/p/<any id>`: view-source shows the plate's own `<title>` and the prompt inside `#root`; the page then shows marked phrases and notes.
- `/words/?w=golden%20hour` lists the prompts that use the phrase.
- `/p/seed_landscapes_sand_dunes` lists five written notes under "What each part does".
- `node scripts/check-notes.mjs` ends with "0 without, 0 phrases that do not match".
- `/games/paper-moths/`: game runs, Top 10 loads, "Set name" opens the rename dialog.
- `/panels/` shows the three-panel home with the snake in the Games triangle; `/start/` shows the new home.
- `/creators/` and `/u/mira` redirect to `/`.

## Roll back

The site as it was before the rebuild is the branch `backup/pre-redesign-2026-10-10`.
Check it out, rebuild `dist/` the old way (`cp -a overlay/. dist/`) and deploy.

## Local preview (no wrangler, no network)

```bash
node scripts/dev-server.mjs            # http://127.0.0.1:4173, needs Node 22.18+ and ffmpeg
```

It runs the real functions against an in-memory SQLite database seeded from `functions/lib/seed.ts`
and serves `overlay/media`. Clips that exist only in R2 get a generated colour-gradient stand-in.

## Still true from the old notes

- Media lives in R2 (`promptshare-media`), not in the Pages bundle.
- Browse thumbnails: `/media/thumbs/images/*.webp` and `/media/thumbs/posters/*.webp` (`scripts/generate-thumbs.mjs`). A missing thumbnail falls back to the full picture.
- Every video is ≥30 fps, and every new video needs its 720p copy at `/media/video-preview/<name>.mp4`
  (`scripts/make-video-previews.py`). The front end derives that URL in `overlay/app/data.js` (`previewOf`) and
  falls back to the full clip if it is missing. `scripts/make-hd-keyframes.py` is no longer needed.
- Games: player identity, rename and the name filter are unchanged (`functions/lib/scores.ts`, `overlay/games/play/ps-score.js`).
