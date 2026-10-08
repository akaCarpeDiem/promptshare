# PromptShare SEO-shell SyntaxError fix

Deployed Sunday Sep 27, 2026 (PT) to Cloudflare Pages project `promptshare`.

- Peek: https://e38ea2d5.promptshare-6is.pages.dev
- Live: https://promptshare.fun
- Assets: `/assets/index-22c3e0bs.js`, `/assets/index-c49d2633.css`
- SW cache: `promptshare-shell-v16`
- Prior broken live: `index-22c3e0br.js` / `promptshare-shell-v15`

## Cause

Archive-removal patch (bq → br) replaced the Vite lazy archive binding:

```js
var …, Te = function (…) { … return r.then(…) }, Ee = (0,l.lazy)(() => Te(() => import(…)))
```

with a top-level helper, but **kept the comma** from the `var` list:

```js
… return e().catch(i)})},function psRedirectLegacy(){…}
```

In a `var` declaration, after `,` the parser expects an identifier binding, not `function`. Browsers (and Node ESM) throw:

`SyntaxError: Unexpected token 'function'` (reported near line 26/27, ~col 37709).

`node --check` alone was a false OK (script mode); ESM/`acorn --module` reproduces the failure.

No Vite app source tree is in this deploy root — only the built/patched `dist/` + overlay — so the fix was applied at the bundle join that introduced the bug.

## Fix

One-character structural repair at the Te / redirect join:

- Broken: `})},function psRedirectLegacy()`
- Fixed:  `})};function psRedirectLegacy()`  (close Te body, then statement)

Behavior unchanged: `psRedirectLegacy()` still remaps `/archive` and legacy `/?plate|study|category|model|q` deep links; SPA mounts Discover via `Oe → be`.

New content hash: `index-22c3e0bs.js` (HTML + overlay updated). SW bumped `v15 → v16` so clients drop the bad shell.

## Verification

| Check | Result |
| --- | --- |
| `acorn --ecma2022 --module` on local + live `bs` | OK |
| Live HTML refs | `index-22c3e0bs.js` + `index-c49d2633.css` |
| `GET /assets/index-22c3e0bs.js` (browser UA) | 200, `application/javascript`, bytes match local |
| `GET /` | 200 |
| Live `sw.js` | `promptshare-shell-v16` |
| `/api/health` | `ok: true` (d1/r2) |

## Remaining risks

1. Clients with an old SW may need one reload (boot watchdog + v16 activate) before the new HTML/JS wins.
2. Deploy root still has no Vite source — further SPA edits remain minified-bundle surgery; prefer restoring a real rebuild pipeline.
3. Old `index-22c3e0b*.js` litter remains in `dist/assets/` (immutable); live HTML only points at `bs`.
4. OAuth providers still report unset in health (`google`/`microsoft` false); unrelated to this shell fix.
