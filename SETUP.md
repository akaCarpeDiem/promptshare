# PromptShare setup notes

## Deploy

From `/workspace/promptshare-deploy` (keep `functions/` beside `dist/`):

```bash
# Sync overlay onto dist (base.zip already has media/ + fonts/)
cp -a overlay/. dist/
rm -f dist/sitemap.xml
export WRANGLER_CACHE_DIR=/tmp/wrangler-cache
npx wrangler pages deploy dist --project-name=promptshare
```

Canonical: https://promptshare.fun/

## Optional Sightengine image safety scan

When both secrets are set on the Pages project, every image upload (creation + avatar) is checked with Sightengine (`nudity-2.0` + `face-attributes`) before R2 storage. If either secret is missing, the vision check is skipped entirely (text prohibited-content blocklist still runs). This is automated and not 100% accurate.

| Secret | Purpose |
| --- | --- |
| `SIGHTENGINE_API_USER` | Sightengine API user id |
| `SIGHTENGINE_API_SECRET` | Sightengine API secret |

Set them in Cloudflare Dashboard → Pages → `promptshare` → Settings → Environment variables (Production + Preview as needed). Rejected uploads return: `This image was flagged by our safety check and can’t be published.`

## Dynamic sitemap

`functions/sitemap.xml.ts` serves `/sitemap.xml` from D1 (static pages + public non-hidden plates + creators with at least one public plate). Do not ship a static `dist/sitemap.xml` that would fight the function. `robots.txt` already points at `https://promptshare.fun/sitemap.xml`.

## Email login (OTP)

Sign-in uses a 6-digit email code (Resend), not a magic link. See `OTP_AUTH_MIGRATION.md` for the D1 `login_codes` table and API shapes.


## Media storage (R2 / Stream — not Pages 10GB)

PromptShare media does **not** live in the Pages deploy bundle:

| Store | Role |
| --- | --- |
| **Cloudflare R2** (`promptshare-media`, binding `MEDIA`) | Operator-uploaded images (and raw video objects as needed) |
| **Cloudflare Stream** (planned) | Hosted video playback for the Videos section |
| **Pages `dist/`** | Site shell only (HTML/JS/CSS + light static assets) |

Operator uploads go to object storage; D1 holds plate metadata. This keeps the Pages project small under the ~10GB deploy limit.

## Gallery-only product lock

Public UX is a curated educational gallery. Visitor upload UI and Following feed are removed/hidden. `POST /api/creations` returns 403. Auth APIs may remain dormant for operator use.
