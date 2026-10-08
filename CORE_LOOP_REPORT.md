# PromptShare core-loop report

Deployed to Cloudflare Pages project `promptshare` (peek `https://802e2af8.promptshare-6is.pages.dev` → 301 canonical). Live: **https://promptshare.fun**. Verified Sunday Sep 27, 2026 (PT).

Hard constraints honored: not a generator; no in-browser image gen, paid packs, crypto, follow walls, fake creator counts, or native-app UI; no full restyle; `/p/{id}` crawlable HTML kept; contact `support@promptshare.fun`; AdSense `ca-pub-4059575347806121` + `ads.txt` intact.

## 1. Publish flow (step by step)

1. Open **`/upload/`** (account required to publish; browsing stays public).
2. Read the limits panel before choosing a file:
   - Images only: JPEG, PNG, WebP, GIF
   - Max 8 MB
   - 20 uploads per hour
   - Must include the final prompt that produced the file
   - Optional: model, earlier steps, title, tags, public vs unlisted
   - **Video and audio cannot be uploaded** (stated explicitly; unsupported types are rejected with a clear message — no mystery dropzone)
   - Short safety line: no sexual content involving minors (incl. generated/fictional); full rules on `/terms`
3. Choose an image via the image-only file input (`accept` limited to those types). Wrong types (including video/audio) clear the selection and show an error.
4. Fill **Exact prompt (required)** — client blocks empty / &lt;3 chars; server rejects empty/short prompts.
5. Optionally set title, model (chips or free text), tags, visibility (public / unlisted), and up to 8 earlier chain steps.
6. Submit **Publish creation** → `POST /api/creations` (auth + 20/hour rate limit + image validation + prohibited-content blocklist).
7. On success, redirect to the plate permalink **`/p/{id}`**.

## 2. Plate JSON fields (exact names)

Documented on **`/about/#developers`**. Served on creation objects from `GET /api/creations/{id}` and `GET /api/feed`.

### Canonical app fields
| Field | Meaning |
|-------|---------|
| `id` | Plate id |
| `imageURL` | Media URL (alias of `mediaUrl`) |
| `prompt` | Final prompt text |
| `model` | Model name |
| `notes` | Array of `{ id, position, prompt, model, text, note }` from chain steps |
| `creatorHandle` | Author handle |
| `visibility` | `public` \| `unlisted` |
| `createdAt` | ISO-8601 publish time |

Also nested as **`plate`** with the same canonical fields plus current API aliases.

### Current API names (kept)
`mediaUrl`, `userId`, `title`, `tags`, `mediaKind`, `steps`, `author`, `featured`, `hidden`, `likeCount`, `saveCount`, `liked`, `saved`

Example live: `GET https://promptshare.fun/api/creations/seed_burger` returns both `imageURL` / `creatorHandle` / `notes` and nested `plate`.

## 3. Safety controls added / finished

- **Upload UI:** limits, image-only, explicit no video/audio, prompt required, short NSFW/minors rule.
- **Server upload blocklist** (`prohibitedContent` in `functions/lib/handler.ts`): rejects sexual content involving minors (incl. generated/fictional) and basic illegal patterns on prompt/title/tags/steps.
- **Rate limit:** 20 uploads/hour/user — kept and shown on upload.
- **Report:** visible **Report this plate** on non-owner plate view; requires account (unchanged). Form adds triage **categories** (`sexual_minors`, `csam`, `illegal`, `violence`, `hate`, `spam`, `copyright`, `other`) stored as `[category] reason`.
- **Hide / remove:** owner control kept/clearer label; sets `hidden=1`.
- **`/terms`:** new **Safety and NSFW** section (minors rule + report/hide).
- **Breakdown honesty:** notes labeled PromptShare interpretations; archive notes described as curated/manual (not auto-generated); missing notes → **Breakdown not written yet** (SPA + SSR + archive study empty path).

## 4. Files / areas changed

- `functions/lib/handler.ts` — blocklist, optional model, report categories, `imageURL` / `creatorHandle` / `notes` / `plate` on API cards
- `functions/p/[id].ts` — published date; breakdown empty / interpretation labels
- `dist/assets/index-0ad114e8.js` (cache-busted from prior bundle) — upload copy, validation, report UI, dates, breakdown empty state
- `dist/assets/GalleryApp-7604d406.js` — interpretation labels, curated honesty, empty notes / empty category copy
- `dist/assets/index-c49d2620.css` — upload-limits / report / empty-chain styles
- `dist/index.html` — asset refs
- `dist/terms/index.html`, `dist/about/index.html` — safety + plate JSON docs
- `dist/OVERLAY_README.txt` + mirrored `overlay/` (per OVERLAY_README)

## 5. Verify checklist (post-deploy)

| Check | Result |
|-------|--------|
| Upload limits, image-only, no mystery video dropzone, prompt required | Pass (live JS) |
| Plate with notes → interpretation label; without → “Breakdown not written yet” | Pass (SSR `/p/seed_burger` + SPA empty path; archive curated label) |
| Empty category empty state | Pass (“No plate in this category yet. Try All…”) |
| `/terms` safety/NSFW; upload short version | Pass |
| Report / hide controls | Pass (Report this plate / Hide / remove) |
| `/p/seed_burger` 200 crawlable | Pass |
| Plate JSON documented on about | Pass |
| AdSense + ads.txt + contact email | Intact |

## 6. Blockers

- **Auth secrets still unset** on production (`GOOGLE_CLIENT_*`, `MICROSOFT_CLIENT_*`, `RESEND_API_KEY`). Sign-in (and therefore **report / upload / hide / like / save**) cannot complete until those are configured. Report button is visible; API still returns 401 without a session.
- No admin moderation queue UI (reports stored in D1 only) — unchanged.
- Asset filenames were cache-busted (`/assets/*` is `immutable`); old hashed bundles may remain on the CDN unused.

