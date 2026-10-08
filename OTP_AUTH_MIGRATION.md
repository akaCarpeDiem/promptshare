# OTP email auth migration (2026-09-27)

PromptShare sign-in moved from magic-link click to email + 6-digit code.

## D1

```bash
npx wrangler d1 execute promptshare --remote --command="CREATE TABLE IF NOT EXISTS login_codes (
  email TEXT PRIMARY KEY,
  code_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0
);"
```

`magic_links` is left in place but unused for login.

If `wrangler d1 execute` is unavailable, `createD1Store().ready()` also runs `CREATE TABLE IF NOT EXISTS login_codes (...)` on first API hit. `GET /api/auth/verify?token=` returns 410.

## API

- `POST /api/auth/magic` `{ email }` → emails a 6-digit code; returns `{ ok, sent }` (never the code in production). With `DEV_AUTH=1` and no Resend, may include `devCode`.
- `POST /api/auth/verify-code` `{ email, code }` → sets `ps_session` cookie; returns `{ ok, user }`.

Codes expire in 15 minutes, max 5 attempts, hashed at rest (SHA-256 of `ps-otp:email:code`).
