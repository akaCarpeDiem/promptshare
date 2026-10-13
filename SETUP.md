# PromptShare setup notes

## Deploy

See `DEPLOY.md` for the steps and `FRONTEND.md` for how the front end is put together.

Canonical: https://promptshare.co/

## Dynamic sitemap

`functions/sitemap.xml.ts` serves `/sitemap.xml` from D1 (static pages, category pages and public non-hidden plates). Do not ship a static `dist/sitemap.xml` that would fight the function. `robots.txt` already points at `https://promptshare.co/sitemap.xml`.

## No sign-in or outbound email

Sign-in, accounts, sessions, OAuth, password/OTP login, Resend mail and the emailed plate report were removed (2026-10-12). The only public contact is support@promptshare.co (contact page). Old auth tables may still exist in D1 but no code reads them.

## Media storage (R2 / Stream — not Pages 10GB)

PromptShare media does **not** live in the Pages deploy bundle:

| Store | Role |
| --- | --- |
| **Cloudflare R2** (`promptshare-media`, binding `MEDIA`) | Operator-uploaded images (and raw video objects as needed) |
| **Cloudflare Stream** (planned) | Hosted video playback for the Videos section |
| **Pages `dist/`** | Site shell only (HTML/JS/CSS + light static assets) |

Operator uploads go to object storage; D1 holds plate metadata. This keeps the Pages project small under the ~10GB deploy limit.

## Gallery-only product lock

Public UX is a curated educational gallery. Visitor upload UI and Following feed are removed/hidden. There is no `POST /api/creations`; write routes return 404.
