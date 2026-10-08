# PromptShare deploy notes

**Canonical:** https://promptshare.fun/  
**Pages project:** `promptshare`  
**Preview alias:** `promptshare-6is.pages.dev` must stay **301 → promptshare.fun**

## Positioning (locked)

Educational **curated gallery** — operator content only. No public visitor publishing, upload UI, or Following feed. Studio names (Mira / Jonah / Noor) are curated attribution.

## Media storage (not Pages disk)

- **Images / future video files** live in **Cloudflare R2** (`promptshare-media`, binding `MEDIA`).
- **Video delivery later:** Cloudflare **Stream** (or R2 + player), not files baked into the Pages deploy.
- The **Pages project** only hosts the site shell (HTML/JS/CSS + a small set of static assets). Keep the deploy under the Pages **~10GB** limit by uploading media to object storage instead of `dist/`.
- Operator workflow: upload media to R2 (and Stream when ready) → seed plate rows in D1 → site references `/media/...` or Stream URLs.

## Deploy from this tree

```bash
cd /workspace/promptshare-deploy
# Sync overlay onto dist (preserve media/ and fonts/ from base)
cp -a overlay/. dist/
rm -f dist/sitemap.xml   # dynamic sitemap via functions/sitemap.xml.ts
export WRANGLER_CACHE_DIR=/tmp/wrangler-cache
npx wrangler pages deploy dist --project-name=promptshare
```

Keep `functions/` beside `dist/` (Wrangler Pages picks them up from the project root).

## Browse-page thumbnails (required for fast /images and /videos)

Grid cards request `/media/thumbs/images/{name}.webp` and `/media/thumbs/posters/{name}.webp` (~640px). Full 1080p files stay at `/media/images/` and `/media/posters/` for plate pages. Generate thumbs on the box (media is not in git):

```bash
# From the box tree that already has dist/media/images and dist/media/posters
node scripts/generate-thumbs.mjs --src=dist/media --out=dist/media/thumbs
# Then upload new files to R2 (or include them in the dist/ sync before wrangler pages deploy)
# Example R2 prefix: media/thumbs/images/*.webp and media/thumbs/posters/*.webp
```

Do not commit the generated binaries. Cards fall back to the full image if a thumb is missing.


## Videos section

- URL: https://promptshare.fun/videos  
- Category chips match image `PS_CATS` (Landscapes … Nature).  
- Empty / placeholder until operator seeds one category at a time. Do not invent fake video files.

## Video fps hard lock

- Every video plate on the site must be **≥30fps** (prefer 60) before it is uploaded to R2 or added to the seed feed.
- **US Cities** and **Street** fills: do not publish a clip under 30fps. Measure with `ffprobe` (`avg_frame_rate`) on the file that will be uploaded, not on a preview.
- 24fps Grok sources stay off `/videos` and Featured. Do not unhide the 2026-10-02 fps cull. Regenerating later is fine; frame-interpolation upsampling is not required and should not be used if it looks soft.
- Landscapes shelf may sit below the old 32-plate count. New landscape fills still obey ≥30fps. Category cap for new fills remains ≤18.
- Homepage hub clip (`landscapes-alpine-lake.mp4`) stays only while it measures ≥30fps (currently 60fps, 1280×720).

## Card-hover video previews (720p @ 60fps) — REQUIRED for every new video plate

Grid / featured cards (Videos tab, home + /images IA shelves) play a lighter proxy on hover:
`/media/video-preview/<name>.mp4` (R2 key `media/video-preview/<name>.mp4`). Plate / detail /
fullscreen keep the full 1080p/60 master at `/media/video/<name>.mp4` (unchanged).

- Spec: `scale=-2:720`, `fps=60`, H.264 High, yuv420p, CRF 23, maxrate 4M / bufsize 8M, `+faststart`, no audio.
- Served by `functions/media/[[path]].ts` (`PREVIEW_RE`, 206 Range support). No OBJECTS entry needed.
- Client derives the preview URL from `mediaUrl` (`psPreviewSrc` in `ps-gallery-v1-20261006browse1.js` and
  `ps-ia-v1-20261006browse1.js`); an optional `previewUrl` field on a creation overrides it. If the preview
  404s/errors the card falls back to the full master, so a missing proxy degrades, never breaks.

Ingest step (run after the master is in R2 and before/after seeding the plate row):

```bash
cd /workspace/promptshare-deploy
export WRANGLER_CACHE_DIR=/tmp/wrangler-cache
# one new plate (local master named exactly like its /media/video/ file):
python3 scripts/make-video-previews.py --upload --verify-live path/to/<name>.mp4
# or backfill every published video from the live feed:
python3 scripts/make-video-previews.py --feed --upload --verify-live
```

## Gallery-only checks after deploy

- Primary nav shows **Discover** only (eye-O on the letter o); no Sign in / Creators / Videos in header
- `/videos` still works for seeding (not linked in top nav)
- `/creators` → `/creators/` studio directory (Mira / Jonah / Noor), not the hub
- `/upload` redirects away (no publish UI)
- Discover image gallery still loads

## Landscapes video #1 (pending media)

- Spec: `VIDEO1_LANDSCAPES_PENDING.md` + `functions/lib/videoSeeds.pending.ts`
- Scene: mossy temperate rainforest canopy / god-rays (unique vs image Landscapes)
- API: `GET /api/feed?kind=video&tag=landscapes`
- Do not merge into `seedBundle()` until `/media/video/landscapes-canopy-godrays.webm` exists in R2/dist
- Fantasy chip: present once on image `PS_CATS` and Videos `CATS` (slug `fantasy`)

## 720p default playback + fullscreen 1080p upgrade (hd1, 2026-10-07) — auto-upgrade REMOVED in q1, see below
- Plate SSR (`functions/p/[id].ts`) emits `<video src="/media/video-preview/<name>.mp4?…&pv=720a" data-ps-master="/media/video/<name>.mp4?…">`.
  JSON-LD / og:video keep the 1080p master. The gallery JS (`psPlateProxy`) also proxies any React-set `/media/video/` src and falls back to the master on error.
- On fullscreen (screen.width*dpr > 1400 or innerHeight > 800, and not saveData/2g/3g) `psHdUpgrade` swaps to the master at the next
  master keyframe from `overlay/assets/ps-hd-keyframes-v1.json`. If it's not ready within 6 s, it stays on 720p. Debug: `window.__psHdLog`.
- **After adding videos:** run `scripts/make-hd-keyframes.py` (reads `/workspace/ps-video-previews/masters`), bump the `?v=` in the
  `psKfPromise` fetch in `ps-gallery-v1-20261006browse1.js`, then redeploy. Missing entries still upgrade, just with a longer hold.
- iOS native fullscreen (webkitbeginfullscreen) intentionally stays on 720p.

## Header first paint (hd1)
- `/images/` and `/videos/` index.html ship the final glass bar statically inside `#root` (`header.net-bar[data-ps-static-bar]`),
  plus critical CSS `#ps-nav-critical-hd1` that hides non-cross-nav links. `ps-nav-v4.js` also runs a synchronous (pre-paint)
  MutationObserver scan on header/nav mutations, with a 4/frame budget, so React's legacy "Discover" bar is never painted.
- `/fonts/outfit-normal-400.woff2` is preloaded in index/images/videos HTML so the bar never paints in the fallback font.
- If you change the bar markup in ps-nav-v4.js, mirror it in the static bar in images/videos index.html (geometry must stay 14,69,1160 @1400w).

## Plate quality switch, plate fill, plate arrows (q1, 2026-10-07)
- **Playback:** 720p preview everywhere, including fullscreen (the hd1 automatic 1080p upgrade is gone).
  The plate player gets a glass pill (`.ps-q`: 720p | 1080p | fullscreen) bottom-right that shows on hover/tap, pause or focus.
  - The choice is saved in `localStorage["ps-video-quality"]` ("720" default | "1080") and applies to the next plate.
    The SSR plate (`functions/p/[id].ts`) has a tiny inline script so a 1080 pref loads the master directly.
  - Mid-play switches crossfade via a hidden `<video class="ps-q-shadow">` and hand back to the real player.
    6 s timeout → stays put, shows a note, and resets the pref to 720. Debug: `window.__psHdLog` (q-* events), `window.__psQuality.set("1080")`.
  - Fullscreen = the `.stage` wrapper (pill button, double-click). The native fullscreen button is hidden (`controlsList=nofullscreen`)
    so the pill stays reachable. iPhone (no element fullscreen) keeps its native button and the quality picked inline.
- `scripts/make-hd-keyframes.py` now also writes `preview:<name>` keyframes. They're only used when the bare `<video>` element is fullscreen.
- **Plate fill:** `assets/ps-plate-q1.css` makes plate video/image fill the rounded frame (block, 16:9, `cover`, no max-height cap,
  no inner white ring). All 81 videos are 1920x1080; a non-16:9 video would be cropped to the frame, not letterboxed.
- **Plate header:** nav-v4 turns React's [Discover, Creators, Videos] links into Images / Videos / Games on `/p/*`
  (slot attrs `data-ps-slot=a|b|c`). `assets/ps-glassbar-plate-q1.css` is a copy of `ps-glassbar-v1.css` GENERATED
  with an `html[data-ps-route^="p/"]` scope, so the plate bar matches the browse bar without touching the hub header.
  Regenerate it if `ps-glassbar-v1.css` changes.
- **Arrows:** `assets/ps-plate-nav-v1.js` is loaded by index/images/videos shells and the 17 `games/<slug>/` pages.
  - Order: the list clicked from (sessionStorage `ps-plate-ctx-v1` / `ps-game-ctx-v1`), extended by `/api/feed?kind=&tag=` or `games/catalog.json`.
  - Plates step with `history.replaceState` + popstate (SPA, no reload); games step with `location.replace`. Back returns to the grid either way.
  - Keys ←/→, swipe on media. Phones (<58px gutter) use small overlay arrows. Disabled at the ends of the list.

### q1 follow-up (22fba43d)
- c1700316 shipped `.stage video.ps-q-shadow{opacity:0}` which out-ranked `.ps-q-shadow.is-on` -> swap layer invisible (~1s freeze per switch).
  Fixed with `.stage video.ps-q-shadow.is-on{opacity:1}`; CSS bumped to `ps-plate-q1.css?v=20261007q1b` in 20 HTML files; SW -> promptshare-shell-v90.
- Plate fill / header bar (ps-glassbar-plate-q1.css, nav-v4 plate slots) / prev-next arrows (ps-plate-nav-v1.js) ship in the same deploy.

## Games: player identity, rename, AI name filter (id1/id2, 2026-10-07, deploy `a84f908d`)

Players can rename any time: "Playing as NAME · Change" on the game start screen (gate), in the plate's Top 10 panel, and a "Score saved as NAME · Change" chip in the game frame after a run. A rename updates every score that player owns, on every board, at once.

- **Files:** `functions/lib/scores.ts` (routes), `functions/lib/players.js` + `functions/lib/namemod.js` (shared with PromptArcade's `functions/_shared/`, keep them in sync), `overlay/games/play/ps-score.js` (identity + rename dialog `#ps-rename`, `window.psPlayer`), `overlay/games/play/ps-gate.js`, `overlay/games/plate.js` (`.ps-plate-who` chip, light-panel styles).
- **Identity (no accounts):** `POST /api/games/players {name, previousName?}` → `201 {playerId, playerToken, name, claimed}`; stored in localStorage `ps_player_id` / `ps_player_token` / `ps_player_name`. Server keeps only `sha256(token)` (constant-time compare). `POST /api/games/players/rename {playerId, playerToken, name}`, `POST /api/games/players/me {playerId, playerToken}`. Score POST `/api/games/<slug>/scores` takes `{score, playerId, playerToken}`; bad id/token → `401 bad-player` (client re-registers once).
- **D1 (`DB`, migration `scripts/migrations-2026-10-07-players.sql`, applied):** `players(id, display_name, token_hash, created_at, updated_at, rename_count, hidden)`, `player_names` (history: kind create|rename, ip_hash), `game_scores.player_id` + `game_scores.hidden`, `name_verdicts` (AI verdict cache per normalized name), `name_checks` (AI lookups per IP hash). Boards `LEFT JOIN players` and show `COALESCE(p.display_name, s.player_name)`; hidden players/rows are skipped. No edge cache on boards (`no-store`).
- **Limits (rolling 24 h):** 5 renames/player, 20 renames per IP hash, 10 creates per IP hash, 40 uncached AI checks per IP hash (salted daily IP hash; secret `SCORE_SALT`).
- **Name filter** on create, rename and anonymous scores: regex/leetspeak first, then Workers AI `@cf/meta/llama-4-scout-17b-16e-instruct` through `[ai] binding = "AI"` in `wrangler.toml`. Blocked if either says block; AI error or > 1.5 s → regex verdict stands. Message "That name isn't allowed — try another." `/api/health` reports `games: {identity: true, aiNameFilter: true}` when the binding is live. No extra token permission needed.
- **Legacy rows** (`player_id IS NULL`): a new player claims them only with proof — the request must carry the same HttpOnly `ps_voter` cookie that posted them (`voter_key`) AND the same name (the new name or `previousName`, the name the gate used before). `Guest` rows are never claimed. Typing someone's name from another browser claims nothing. At cut-over the board held CD ×9 and Guest ×1.
- **Caveat:** identity lives in one browser (clearing site data / another device = new player; old rows keep the last name). Names are not unique.
- **Preview URLs** 301 to promptshare.fun (middleware), so test games API changes with `npx wrangler pages dev dist` from `/tmp/ps-deploy-id1` (empty local D1: `/api/health` errors on `users`, games routes work) and then live.
- **Versions:** game scripts `?v=20261007id1`, `plate.js?v=20261007id2`, SW `promptshare-shell-v92`.

### Moderating a player
```bash
npx wrangler d1 execute promptshare --remote --command "SELECT id, display_name, rename_count FROM players WHERE display_name LIKE '%Some%'"
npx wrangler d1 execute promptshare --remote --command "UPDATE players SET hidden=1 WHERE id='p_…'"          # hide all their rows (reversible)
npx wrangler d1 execute promptshare --remote --command "UPDATE game_scores SET hidden=1 WHERE id=<row id>"    # hide one anonymous row
npx wrangler d1 execute promptshare --remote --command "INSERT OR REPLACE INTO name_verdicts (name_key, verdict, source, model, created_at) VALUES ('some name','block','manual','',strftime('%s','now')*1000)"
```

## Canonical glass header on every page (hdr1, 2026-10-07, deploy `753202ca`)
- **One bar, server-rendered:** `<!--ps-hdr1--><header class="ps-gbar" data-ps-hdr="1">…</header><script>…</script><!--/ps-hdr1-->`
  (logo, Images / Videos / Games, search → GET `/search/?q=`). Generated and applied by `scripts/apply-header-hdr1.py`
  (idempotent; re-run after adding a page). It sits OUTSIDE React's `#root`, so React never re-renders it (no flash).
  Plates get it automatically: `functions/p/[id].ts` uses the `/index.html` shell and only replaces `#root`.
- **CSS:** `assets/ps-header-v1.css` only (px units — legal.css has a 17px root). It hides React's `header.net-bar` /
  `nav.net-tabbar` (`header.ps-gbar ~ #root …`), zeroes `.net-shell` top padding, and adds `body{padding-top:13.6px}` via
  `html[data-ps-hdr]`, so content offsets are unchanged. Legal pages use `data-ps-hdr="dark"` (opaque cream glass).
- **Home has NO bar** (Logan): `html[data-ps-route="discover"] header.ps-gbar{display:none}`. The route attr is set by the
  inline head script before body parse, so the bar never paints on `/`.
- **Active section:** inline script after the bar sets `aria-current="page"` (orange) from the path (`/images`, `/videos`,
  `/games/*`; plates by `.stage.is-video|is-image` / `data-ps-plate-kind`). It re-runs on history changes.
- **Geometry (must stay):** 1400w bar 112.5,13.6,1160,69.2, links 72×44 at x 316.2/393.8/471.4, input 557→697.8 wide;
  390w bar 12,13.6,366,112.8 (search on row 2). Verify with `/tmp/pvcheck/hdrcrawl.mjs`.
- **Discover removed:** bundles `index-22c3e0dh.js` (from df: home/plates/creators/search) and `index-22c3e0di.js` (from dg:
  Images/Videos) with the user-facing Discover strings replaced; nav-v4 skips its eye-O decoration when the bar exists.
- Excluded: `/games/play/*.html` (iframe-only game documents inside the game plate; a bar there would double up and
  break fullscreen play).
- **hdr2 (deploy `85a6cdfa`):** blue glow behind the logo on SPA pages (Images/Videos/plates/creators/search) was React's
  "Skip to content" link (`.skip{position:absolute;top:-4rem}`, blue fill) — parked relative to `.net-shell`, which since hdr1
  starts below the bar, so it sat behind the logo and the bar's `backdrop-filter` blurred it into a glow. Fixed in
  `ps-header-v1.css`: unfocused skip link → `position:fixed;top:-240px`. CSS link now `?v=20261007hdr2`, SW v94.
  Check: `/tmp/pvcheck/noglow.mjs` (blue excess in the logo strip, compare to /games/).

## Home hub snake background (snake1, 2026-10-07, deploy `4627a93b`)
- **Where:** `assets/ps-hub-snake-v1.js` (vanilla JS, ~4.6 KB gz) inserts `canvas.ps-hub-snake` into
  `.ps-disc-pane--games .ps-disc-media` (before `.ps-disc-shade`), positioned top 62.5% / height 37.5%, z-index 1,
  `pointer-events:none`; the pane's own clip-path clips it to the triangle. Label "Games" (z3), the click target and the
  geometry are untouched. Inline `<style id="ps-hub-snake-css">` in `index.html` hides `.ps-disc-img` (hub-arrow-keys.svg) on
  home only. Linked `?v=20261007snake2` (snake1 URL has an edge-cached 404 — don't reuse it).
- **Behaviour:** grid cell `clamp(10,18,w/78)` px; step 120 ms (140 ms on phones); eats orange dots, +1 segment each; at
  length 30 (22 on phones) or after 80 s it exits through the base, pauses 1.6 s and re-enters at length 3. Dots avoid the
  label. Cyan→violet body, glow, eyes.
- **Perf/lifecycle:** boots after `load` + idle; DPR capped at 2; pauses on `visibilitychange` and when offscreen
  (IntersectionObserver); ResizeObserver relayout; stops off-hub; remounts if React re-renders the hub.
  `prefers-reduced-motion` → single static frame. Debug: `window.__psSnake.state()` / `.setMax(n)`.
- Check: `/tmp/pvcheck/snake.mjs` (frames, cycle, click target, reduced motion, plate), `snakerec.mjs` (mp4).
- Rollback: remove the script + style lines from `index.html` (arrow art returns), bump SW.
