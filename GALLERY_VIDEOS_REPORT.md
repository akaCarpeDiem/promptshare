# PromptShare gallery-only + Videos scaffold

**Date:** 2026-10-01 PT  
**Canonical:** https://promptshare.fun/  
**Deploy:** https://d517b4fd.promptshare-6is.pages.dev (production on promptshare.fun)  
**SPA:** `/assets/index-22c3e0da.js` + `ps-gallery-v1.js/css`  
**SW:** `promptshare-shell-v54`

## Removed / hidden

- Nav **Upload** → replaced with **Videos**
- `/upload` and `/upload/` **301 → /**
- Discover **Following** toggle + **Share a creation** CTA hidden/neutered
- Empty-state “Upload a creation” / “Sign in to publish” copy softened or hidden
- SEO / about / privacy / terms no longer promise visitor uploads or “creator network” UGC
- `POST /api/creations` → **403** (“Public uploads are closed…”)
- Auth APIs left dormant (not deleted)

## Videos

- **URL:** https://promptshare.fun/videos (and `/videos/`)
- Categories (same as image `PS_CATS`): Landscapes, Cities, Street, People, Portraits, Cyberpunk, Futuristic, Animals, Fictional Animals, Myths, Comic book art, Anime, Food, Architecture, Space, Fantasy, Vehicles, Nature (18)
- Empty / placeholder shelf only — **no fake video files**

## Storage docs

- `SETUP.md` + `DEPLOY.md`: media in **R2** (`promptshare-media`); Stream later for video; Pages shell stays small

## Verified live

- No Upload in HTML shell; Videos linked
- Preview alias `promptshare-6is.pages.dev` still **301 → promptshare.fun**
- `/api/health` ok; landscapes feed still returns creations
- Upload API 403

## Follow-ups

1. Seed **first video category** (recommend **Landscapes**) — one prompt / one clip via R2 or Stream
2. Optionally hide or reframe **Creators** nav as “Studios” if still too UGC-coded
3. Wire real video plate rows + player when first clips exist
