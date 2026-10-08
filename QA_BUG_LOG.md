# PromptShare QA bug log

Break-only QA · live https://promptshare.fun · source `/workspace/promptshare-deploy`  
Verified Sun Sep 27, 2026 (PT). **No code changes. No deploy.**

## Checklist (brief)

| # | Result |
|---|--------|
| 1 Routes `/` `/about/` `/privacy/` `/terms/` `/contact/` `/cookies/` `/creators/` `/archive/` | 200 |
| 2 `/p/{id}` public plates | 200; `<img>` + prompt in HTML (SSR `#root`); no JS required |
| 3 Unlisted in sitemap | OK — static sitemap lists public seeds only; feed has 0 unlisted; unlisted get `noindex` |
| 4 `promptshare-6is.pages.dev` → `promptshare.fun` | 301 path-preserving (`/`, `/about/`, `/p/seed_burger`) |
| 5 `/ads.txt` | `text/plain`; body `google.com, pub-4059575347806121, DIRECT, f08c47fec0942fa0` |
| 6 sitemap.xml hosts | only `https://promptshare.fun` (no pages.dev) |
| 7 Upload empty prompt / oversized | Client rejects empty/`<3` chars; server `handler.ts` rejects empty + `IMAGE_LIMIT` 8 MB (`Images are limited to 8 MB.`) |
| 8 Sign-in errors | Readable JSON → UI (`form-error`); e.g. Google/Microsoft 501 name missing secrets; magic returns clear `message` when Resend unset |
| 9 Copy prompt / copy link | SSR buttons + handlers; SPA also has Copy prompt / Copy link (`clipboard.writeText`) |
| 10 Report | **Shipped in SPA** (“Report this plate” + categories → `POST /api/creations/:id/report`, auth required). Not in SSR HTML. No admin triage UI. |
| 11 Leftover brand strings | None on live HTML/legal/meta. Orphan unused `index-DGwNeZiL.js` still contains “PromptGallery” (not linked by live `index.html`) |
| 12 og:image on plates | Present (plate media URL) |
| 13 NSFW/minors on `/terms` | Present (“Safety and NSFW” / no sexual content involving minors) |
| 14 Contact email | `support@promptshare.fun` visible + mailto on `/contact` (also terms/privacy/about) |

## Issues / changes

*(none — already OK)*

No severity critical/high/medium/low items requiring a fix.

## Known limitations (not bugs)

- Auth secrets unset live: `google/microsoft/email/devLink: false` (`/api/health`). Upload/report/sign-in E2E needs secrets; validation verified in client JS + server handler only.
- Client upload UI does not pre-check `file.size`; oversized rejected by server (error surfaced via API `error` string).
- Sitemap is static (public seeds + studio profiles); not auto-updated for new public uploads.
- Report requires signed-in user; no public anonymous report on SSR plate HTML.
- Stale unused asset bundles under `dist/assets/` (e.g. `index-DGwNeZiL.js`) are not served by current `index.html`.
