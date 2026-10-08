# PromptShare visual redesign v1

Deployed Sunday Sep 27, 2026 (PT) to Cloudflare Pages project `promptshare`.

- **Peek:** https://6d22ca66.promptshare-6is.pages.dev
- **Live:** https://promptshare.fun
- **SW cache:** `promptshare-shell-v17` (was v16)
- **Main SPA unchanged:** `/assets/index-22c3e0bs.js` + `/assets/index-c49d2633.css`
- **Additive layer:** `/assets/ps-redesign-v1.css`, `/assets/ps-motion-v1.js`

## Creative choices

Matched the user featured-prompt mock energy (dark lavender paper, cyan `#7ee7f5`, purple `#c4a6ff`) and pushed Awwwards-adjacent polish without touching React mounts:

1. **Atmosphere** — Multi-stop aurora/mesh gradients on `body`, soft drifting overlay blobs, optional SVG noise grain, pointer-follow cyan→purple glow orb (coarse pointer / reduced-motion off).
2. **Shell** — Glass `net-bar` (blur + saturate), active Discover pill with cyan/violet gradient rim, search focus cyan glow, premium page-head kicker tracking + gradient headline wash.
3. **Cards** — Glass borders, hover lift + cyan rim light + violet bloom, media slight zoom on hover, staggered fade+rise via IntersectionObserver.
4. **Pills** — White-border active chip (mock), springy hover scale, smooth scroll-into-view for `.is-on`.
5. **Plate hero** — `.creation .stage` large 28px radius, cyan/violet outer glow, soft inner rim light, gentle scale on hover.
6. **Featured prompt chrome** — `.prompt-under` glass panel; heading visually becomes **`+ FEATURED PROMPT`** (cyan mono tracking via `::before`); **Prompt breakdown →** cyan outline + **Copy prompt** filled ghost; cyan underlines on influential phrases preserved/enhanced.
7. **Featured slot** — Full-width glass hero band with `+ Featured` kicker.
8. **Modals** — Backdrop blur + dialog rise animation.
9. **Gallery leftovers** — `.frame` / `.sheet` / `.nav-arrow` / `.chips` also elevated (Archive CSS still present; Archive route still redirects).
10. **`prefers-reduced-motion`** — Animations/transitions/glow orb gated; reveals snap visible.

## Files added / changed

| Path | Role |
| --- | --- |
| `dist/assets/ps-redesign-v1.css` | Full visual override layer (~20 KB) |
| `dist/assets/ps-motion-v1.js` | ES module: reveals, glow, chip scroll, MutationObserver |
| `dist/index.html` | Links redesign CSS + motion JS after main assets |
| `dist/sw.js` | Cache → `promptshare-shell-v17` |
| `overlay/*` | Same four files synced |
| `REDESIGN_REPORT.md` | This report |

**Not edited:** main React bundle `index-22c3e0bs.js` (no SyntaxError risk), AdSense head tag, auth UI behavior, `/p/:id` APIs, legal pages.

## Verification

| Check | Result |
| --- | --- |
| Peek HTML refs redesign assets | yes |
| Live HTML refs | `index-22c3e0bs.js`, `index-c49d2633.css`, `ps-redesign-v1.css`, `ps-motion-v1.js` |
| Live assets 200 (browser UA) | redesign CSS 20183 B, motion JS 3415 B |
| `acorn --ecma2022 --module` main + motion | OK |
| Live `sw.js` | `promptshare-shell-v17` |
| `/api/health` | `ok: true` (d1/r2) |
| SPA mount (Chrome) | `.net-shell` + Discover + card grid (6 cards); not SEO-only shell |
| Plate `/p/seed_burger` | stage glow + `::before` `+ FEATURED PROMPT` + breakdown/copy buttons |
| Screenshots | `/workspace/ps-review/redesign-desktop-1280.png`, `redesign-mobile-390.png`, `redesign-plate-desktop.png`, `redesign-plate-mobile.png`, `redesign-plate-prompt.png`, `redesign-plate-full.png` |

## Remaining gaps

1. **Mock category pill row on Discover** — Archive/GalleryApp (All / Animation / …) was removed from the SPA; Discover is a feed, not category-filtered featured media. Pill styling applies wherever `.chip` / `.chip-row` exist (upload models, etc.). Restoring a Discover category rail would need SPA/API work beyond additive CSS.
2. **Featured media carousel arrows** — Live plate DOM has no `.nav-arrow` siblings; glow/hero treatment is CSS-only on `.stage`.
3. **`+ FEATURED PROMPT` label** — Achieved via CSS `::before` + `font-size:0` on the React `h2` (“The prompt”). Screen readers may still hear the original string; a tiny React label change would be cleaner later.
4. **Old clients** — SW v17 + boot watchdog should clear v16 shells after one reload.
5. **No Vite source tree** — Further product markup changes still require minified surgery or a restored build pipeline; redesign layer keeps rollback easy (unlink the two assets + drop SW bump).
