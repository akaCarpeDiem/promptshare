# PromptShare creator network

Built for Cloudflare Pages project **promptshare**. Do not deploy from this environment. Grok Bot deploys.

```bash
npx wrangler pages deploy dist --project-name=promptshare
```

Run that from the repository root so `functions/` is uploaded with `dist/`. Canonical origin: https://promptshare.fun/. Preview host: https://promptshare-6is.pages.dev/.

## What a person can do

Sign in, edit a profile, upload an image with the model and the exact prompt, optionally add earlier prompt steps, and see the creation on Discover and on `/u/:handle`. Open another creator, follow them, and filter Discover to Following. Uploads are images only (JPEG, PNG, WebP, GIF, 8 MB). Video and audio files are rejected by the API and are not offered in the upload form. The 194-plate study gallery, including its video and audio plates, stays at `/archive`. Deep links `/?plate=`, `/?study=`, `/?category=`, `/?model=`, and `/?q=` redirect to `/archive`.

Local review does not need Cloudflare. Vite serves `/api` with a file store (`.data/db.json`, gitignored) and `DEV_AUTH=1`, so a magic link is returned in the JSON response. Dev server: http://127.0.0.1:47291

## Architecture

- Vite + React client. Discover, creators, search, upload, profile edit, public profile, and creation detail are client routes. The archive bundle is loaded only on `/archive`.
- Cloudflare Pages Functions in `functions/`. `functions/api/[[path]].ts` is the JSON API. `functions/p/[id].ts` SSR for public plates. `functions/sitemap.xml.ts` serves a D1-backed `/sitemap.xml`. `functions/c/[id].ts` 301s legacy `/c/:id` → `/p/:id`.
- Metadata: D1 binding `DB`. Image uploads and avatars: R2 binding `MEDIA`. No KV. Video and audio are not stored.
- Sessions are an HttpOnly `ps_session` cookie (30 days, `SameSite=Lax`, `Secure` on https). Magic links last 20 minutes. OAuth state lasts 15 minutes.
- Seeded studio profiles `mira`, `jonah`, and `noor` use published catalog images and the prompts that belong to those files, so Discover is not empty before the first real upload. Jonah’s astronaut plate is a two-step chain whose final sentence is the published prompt. Video and audio plates stay in the archive only. If a database was seeded earlier with video or audio rows, the next API start deletes non-image creations and inserts any missing image seeds.

## Bindings and secrets

Create these in the Cloudflare dashboard for the `promptshare` Pages project. `wrangler.toml` intentionally has no database id.

| Name | Kind | Notes |
| --- | --- | --- |
| `DB` | D1 | Database name `promptshare`. Apply `schema.sql` before the first request. |
| `MEDIA` | R2 | Bucket `promptshare-media`. Still required for image uploads and avatars. Video and audio are not uploaded. |
| `GOOGLE_CLIENT_ID` | secret | |
| `GOOGLE_CLIENT_SECRET` | secret | |
| `MICROSOFT_CLIENT_ID` | secret | |
| `MICROSOFT_CLIENT_SECRET` | secret | |
| `RESEND_API_KEY` | secret | Magic-link email. Without it, production does **not** return the link. |
| `MAIL_FROM` | secret | Optional. Default `PromptShare <support@promptshare.fun>`. |
| `PUBLIC_ORIGIN` | secret | `https://promptshare.fun` |
| `DEV_AUTH` | secret | Do not set this on production. `1` only for a local host. |
| `SIGHTENGINE_API_USER` | secret | Optional. With `SIGHTENGINE_API_SECRET`, runs Sightengine nudity/minor scan on uploads. |
| `SIGHTENGINE_API_SECRET` | secret | Optional. Leave both unset to skip vision checks (text blocklist still runs). |

OAuth redirect URIs:

- `https://promptshare.fun/api/auth/callback/google`
- `https://promptshare.fun/api/auth/callback/microsoft`

Also add the `pages.dev` origin if you test OAuth there.

```bash
npx wrangler d1 execute promptshare --remote --file=schema.sql
```

Until `DB` is bound, `/api/*` returns 503 and names the missing bindings. Google and Microsoft buttons return 501 with the secret names until those secrets exist. Uploads return an error if `MEDIA` is missing.

## Limits

| Kind | Max size |
| --- | --- |
| Image (JPEG, PNG, WebP, GIF, including profile pictures) | 8 MB |
| Uploads | 20 images per user per hour |
| Magic links | 5 per email per hour, 20 per IP per hour |
| Prompt chain | 8 earlier steps |
| Social links | 3 |
| Handle | 3–20 characters, `a-z`, `0-9`, `_` |

Uploads are JSON with base64 file data, not multipart.

## Live locally vs needs Cloudflare

| | Local Vite | Cloudflare before dashboard wiring | After bindings |
| --- | --- | --- | --- |
| Discover, archive, legal pages | yes | yes | yes |
| Magic-link session | yes, `devLink` in the response | API 503 until D1 exists; after D1, no token unless Resend is set | email via Resend |
| Google / Microsoft | button explains the missing secrets | same, 501 | redirect to the provider |
| Image upload and avatar | `.data/media` | fails until R2 `MEDIA` is bound | R2. Video and audio requests are rejected before storage. |
| Profiles, follow, like, save, report | file store | D1 | D1 |

## PWA

`public/site.webmanifest` is `display: standalone` with 192 and 512 PNG icons. `public/sw.js` precaches the shell and icons, uses the network for navigations, and does not intercept `/api`. A headless check registered the worker at scope `/` with state `activated`.

## Handoff files

Slim overlay (overwrite onto the existing `dist/` that already has `/media` and `/fonts`). Do not replace the whole media archive.

Functions zip (keep `functions/` next to `dist/` when wrangler runs).

## Known gaps

- No admin queue for reports. Reports are stored.
- Unlisted creations are visible to anyone with the link.
- D1 feed search loads the latest 80 public rows and filters in the function.
- The file store rewrites `.data/db.json` on each API call, including reads.
- Studio seed accounts are not real people. Their emails are `*@studio.promptshare.invalid`.
- Hide removes a creation from Discover and the profile. There is no separate delete-account flow yet.
- AdSense stays off until `VITE_ADSENSE_CLIENT` is a real `ca-pub-` id at build time. No publisher id is invented here.
