# PromptShare IA redesign — 2026-10-01 PT

**Canonical:** https://promptshare.fun/  
**Deploy:** https://984feffa.promptshare-6is.pages.dev (production on promptshare.fun)  
**SPA:** `/assets/index-22c3e0dc.js` (cache-bust rename)  
**Overlay:** `ps-ia-v1.js|css` `?v=20261001ia3`, nav/gallery `ia3`  
**SW:** `promptshare-shell-v61`

## Routes

| URL | Role |
|-----|------|
| `/` | Featured only — 9 mixed image/video cards, reshuffled on full reload; **no** category carousel |
| `/discover` | Full-viewport Images \| Videos split |
| `/images` | Still-image gallery + category carousel (18 cats) |
| `/videos` | Video gallery + own category carousel |

## Nav

- Discover eye-mark → `/discover` (active on Discover)
- Logo/PromptShare → `/` (home)
- No Creators / Sign-in / Videos in primary nav

## Implementation

- SPA route parser: `home`, `discover-hub`, `/images` → discover gallery, chip links → `/images?tag=`
- Overlay `ps-ia-v1` renders home featured + discover split; probes media so missing R2 assets are skipped on home/discover heroes
- Redirects: `/discover`, `/images`; `/creators` → `/discover`; `/explore` → `/images`

## Screenshots

- `/workspace/ps-review/ia-home-3x3.png`
- `/workspace/ps-review/ia-discover-split.png`
- `/workspace/ps-review/ia-images-carousel.png`
- `/workspace/ps-review/ia-videos-carousel.png`

## Blockers / follow-ups

- ~31 seed image files still missing from R2/media (API lists them; `/media/...` returns HTML shell). Home/Discover filter those out; `/images` gallery still shows broken thumbs for missing files until media is uploaded.
- Only one curated video live (`landscapes-canopy-godrays`); featured always prefers including it when loadable.
