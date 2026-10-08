# PromptShare identity upgrade report

Deployed Sunday Sep 27, 2026 (PT) to Cloudflare Pages project `promptshare`.

- Peek: https://6f85ec66.promptshare-6is.pages.dev (301 → canonical)
- Live: https://promptshare.fun
- Assets: `/assets/index-22c3e0bp.js`, `/assets/index-c49d2631.css`
- SW cache: `promptshare-shell-v13`

## Endpoints added / extended

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/username/available?u=` | Format + reserved + NSFW + uniqueness |
| POST | `/api/username/check` | Same as available (JSON body) |
| POST | `/api/me/username` | Set/change username (auth) |
| POST | `/api/me/password` | Set/change password (auth; current required if already set) |
| POST | `/api/auth/password` | Username + password login → `ps_session` cookie |
| POST | `/api/auth/verify-code` | Now returns `needsUsername` (+ user.needsUsername / hasPassword) |
| PATCH | `/api/me` | Handle changes run through username rules + set `usernameSet` |
| GET | `/api/me` | User includes `needsUsername`, `hasPassword` |

Email OTP (`/api/auth/magic` + `/api/auth/verify-code`) unchanged as a login path.

## Fields

D1 `users` (+ fileStore JSON): `username_set`, `password_hash`, `password_salt`, `password_updated_at`.
Migrated in `createD1Store().ready()` via `ALTER TABLE ... ADD COLUMN`.
Existing rows default `username_set=1` (no forced onboarding).
New OTP/OAuth accounts: placeholder handle `tmp`+hex, `username_set=0`.

Password: PBKDF2-SHA256, 100k iterations, 16-byte salt (Web Crypto). Hash/salt never returned to clients.

## Username rules

- 3–20 chars, `[a-z0-9_]`, stored lowercase (case-insensitive uniqueness)
- Reserved list (admin, promptshare, support, me, api, …)
- Curated NSFW/slur blocklist (exact short tokens + substring list) in `functions/lib/username.ts`
- Server authoritative; client mirrors format for UX

## First-login onboarding

After successful email-code (or password) verify, if `needsUsername`, SPA opens **Choose a username** modal (live availability), then optional **Set a password** (skippable). `/me` effect also re-opens onboard if `user.needsUsername` is still true.

You/`/me`: Username field (was Handle), password set/change section, Sign out, Delete account.

Sign-in modal: tabs **Email code** | **Username & password**.
