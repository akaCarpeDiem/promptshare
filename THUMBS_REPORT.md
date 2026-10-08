# PromptShare thumbs + card footer cleanup — 2026-10-01 PT

**Live:** https://promptshare.fun/  
**Deploy:** https://95f2b4ca.promptshare-6is.pages.dev → production  
**SW:** `promptshare-shell-v62`  
**Overlay:** `ps-thumbs-v1.js|css?v=20261001th1`

## API approach

**Cloudflare D1** table `thumbs (creation_id, voter_key, created_at)` with PK `(creation_id, voter_key)`.

- `GET /api/thumbs?ids=a,b,c` → `{ counts, voted }`
- `POST /api/thumbs/:id` → toggle; returns `{ id, thumbed, count }`
- Anonymous browser identity via `ps_voter` HttpOnly cookie (UUID, ~13 months)
- One thumbs-up per browser (toggle on/off); counts stack across visitors
- Implemented in `functions/lib/thumbs.ts`, wired from `functions/api/[[path]].ts` before `handleApi`

Not localStorage-only; not Durable Objects / KV (D1 already bound).

## UI

- Removed card author avatar/name + date + stray likeCount `0` (home 3×3, `/images` SPA cards, `/videos` cards)
- Plate pages: hide author link + published date; hide auth Like/Save; inject 👍 control
- Prompt / influential-word hover (`PS_SEED_NOTES`) / breakdown UI left intact

## Screenshots

- `/workspace/ps-review/cards-thumbs.png` (home after thumbs click)
- Also: `cards-thumbs-home.png`, `cards-thumbs-images.png`, `cards-thumbs-plate.png`, `cards-thumbs-videos.png`, `cards-thumbs-video-plate.png`

## Verify

- Home: 9 thumbs, no Mira/Jonah/Noor footers
- `/images`: thumbs on cards; counts persist after reload/other pages
- Plate: thumbs + prompt + breakdown; author/date hidden
- Video plate: thumbs + long prompt + breakdown present

**Ready for parent to generate more videos.**
