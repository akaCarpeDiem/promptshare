# PromptShare category browsing — report

**Canonical:** https://promptshare.fun  
**Deploy (latest Functions):** https://2b0dbdc0.promptshare-6is.pages.dev  
**Date:** 2026-09-27 PT  
**SPA asset:** `/assets/index-22c3e0bu.js`  
**SW cache:** `promptshare-shell-v21`  
**Contact:** support@promptshare.fun  

## What shipped

1. **Discover category carousel** under the hero (after `.page-head`): no scrollbar, `‹`/`›` arrows, vertical wheel → horizontal scroll while hovering (`ps-categories-v1.js` via event delegation on `[data-ps-cat-carousel]`).
2. **Category pages** via `/?tag={slug}` and pretty `/explore/{slug}` (SPA maps explore → discover+tag). Active chip + kicker label + “← All categories”.
3. **D1 seeds:** ≥6 public creations per taxonomy slug (new `seed_{category}_…` ids so `ensure()` inserts them). Legacy six retagged to taxonomy primaries.
4. **Feed performance:** SQL tag prefilter, light hydrate for cards, bulk seed-id lookup on ready().

## Taxonomy (slug = primary tag)

| Slug | Label | Seed count (live API) |
|------|-------|------------------------|
| landscapes | Landscapes | 7 |
| cities | Cities | 6 |
| people | People | 6 |
| cyberpunk | Cyberpunk | 7 |
| animals | Animals | 6 |
| fictional-animals | Fictional Animals | 6 |
| comic | Comic book art | 6 |
| anime | Anime | 6 |
| food | Food | 7–8 |
| architecture | Architecture | 6 |
| space | Space | 7 |
| fantasy | Fantasy | 6 |
| vehicles | Vehicles | 6 |
| nature | Nature | 8 |

Authors rotate: `user_mira` / `user_jonah` / `user_noor`.

## Images: new vs studio

| Kind | Count | Notes |
|------|------:|-------|
| **Studio remaps** (existing `/media/images/studio-*.webp` + a few classic assets) | **84** new seed rows | Priority (A): carousel filled immediately; all already 200 on live CDN |
| **Legacy seeds** retagged | **6** | `seed_lake`→landscapes, `seed_city`→cyberpunk, `seed_astronaut`→space, `seed_ice`/`seed_blossoms`→nature, `seed_burger`→food |
| **Brand-new GenerateImage outputs** | **0** | `GenerateImage` / `CallDynamicTool` was **not available** in this executor (only `cursor-github` MCP). No R2 uploads of new files required for remaps. |

All category media paths are static under `dist/media/images/` (already live). Overlay mirrored for HTML/assets/SW/redirects.

## SPA / UI files

- `dist/assets/index-22c3e0bu.js` — tag route parse, `/explore/{slug}`, `ue({…tag})`, carousel chips, `PS_PLATE_MAP` extended (empty `PS_SEED_NOTES` → fine)
- `dist/assets/ps-categories-v1.css?v=20260927cat`
- `dist/assets/ps-categories-v1.js?v=20260927cat`
- `dist/_redirects` — `/explore`, `/explore/`, `/explore/*` → SPA
- `dist/sw.js` — `promptshare-shell-v21`
- Validated: `npx acorn --ecma2022 --module` on new JS assets

## Backend

- `functions/lib/seed.ts` — 90 creations (6 legacy + 84 category)
- `functions/lib/d1.ts` — tag SQL `LIKE` prefilter; light feed hydrate; bulk `seed_%` id map in `ensure()`; legacy tag refresh when tags drift

## Verification

| Check | Result |
|-------|--------|
| `/api/health` | ok (`store:d1`, `media:r2`) |
| HTML links `index-22c3e0bu.js` + categories CSS/JS | yes |
| `/api/feed?tag=landscapes` | ≥6 (7) |
| All 14 tags | ≥6 each |
| Discover carousel (14 chips), arrows scroll ~240px | yes |
| `/?tag=landscapes` filters cards, Landscapes chip `is-on` | yes |
| SPA mounts (`#root` React) | yes |
| Screenshots | `/workspace/ps-review/cat-carousel-desktop.png`, `cat-page-landscapes.png` |

## Follow-ups (optional)

- Generate 2+ brand-new webp per category when `GenerateImage` is available; upload to Pages `dist/media/images/` (+ R2 `promptshare-media/media/images/` if needed) and add new seed ids.
- Further cut unfiltered feed latency (~4.5s for 40 cards) with batched author lookup / like counts.
