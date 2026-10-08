# PromptShare visual redesign v2 (bright cream / enjoy.dev energy)

Deployed Sunday Sep 27, 2026 (PT) to Cloudflare Pages project `promptshare`.

- **Peek:** https://6db20823.promptshare-6is.pages.dev (301 → live custom domain)
- **Live:** https://promptshare.fun
- **SW cache:** `promptshare-shell-v18` (was v17)
- **Main SPA unchanged:** `/assets/index-22c3e0bs.js` + `/assets/index-c49d2633.css`
- **Additive layer:** `/assets/ps-redesign-v2.css`, `/assets/ps-motion-v2.js`
- **Removed:** `ps-redesign-v1.css`, `ps-motion-v1.js` (no longer linked; deleted from dist/overlay)

## Why v2

v1 was a dark-lavender glass overlay on the existing void palette — users reported it looked identical to the old UI. v2 **forces a light-first cream system** by overriding `:root` tokens (`--void`, `--stage`, `--paper`, `--ink`, `--cyan`, …), `color-scheme: light`, and body/shell/card surfaces so first paint is unmistakably warm paper + dark ink + colorful accents (enjoy.dev energy, not copy).

## Palette

| Role | Hex |
| --- | --- |
| Canvas | `#fffdf9` / `#f8f6f1` |
| Ink | `#242422` |
| Blue | `#2459e8` / `#2878ef` |
| Orange | `#f58220` |
| Pink | `#ed438b` / `#b52d67` |
| Soft tiles | sky `#e5edff`, blush `#ffcbe2`, apricot `#fff0d6` / `#ffd392` |

Token remaps (forced): `--void→#fffdf9`, `--stage→#fff`, `--paper/--ink→#242422`, `--cyan→#2459e8`, `--violet→#ed438b`, `--vermillion→#2459e8`.

## Motion

- Spring curve `cubic-bezier(0.34, 1.56, 0.64, 1)` on hovers / dialogs / chip scale
- IntersectionObserver fade-up + stagger (`.ps-reveal` / delay 1–6)
- Floating pastel sticker blobs (sky / pink / apricot + accent dots): `tile-float` / `rock` / `flutter`
- Active Discover pill: blue fill; active chips: orange fill + soft bounce
- Card hover: spring lift + blue rim
- `prefers-reduced-motion` and `data-motion="off"` kill animations / snap reveals visible

## UI coloring (obvious on first paint)

- Cream body + soft pastel radial atmosphere (not purple void)
- Nav active Discover = solid blue pill; Sign in = blue outline
- Cards rotate pastel backs (sky / blush / apricot) with colored borders
- Phrase underlines = pink (was cyan on dark)
- Primary buttons = solid blue; Copy prompt = solid pink; breakdown = blue outline
- Hero “DISCOVER” kicker = orange; headline big dark serif on cream
- Featured prompt chrome stays in spirit (`+ FEATURED PROMPT` via `::before`) on apricot-cream panel

## Files

| Path | Role |
| --- | --- |
| `dist/assets/ps-redesign-v2.css` | Bright cream override (~25 KB) |
| `dist/assets/ps-motion-v2.js` | Reveals, stickers, chip polish, reduced-motion |
| `dist/index.html` | Loads v2; theme-color `#fffdf9`; SEO shell cream/ink |
| `dist/sw.js` | `promptshare-shell-v18` |
| `overlay/*` | Synced |
| `REDESIGN_V2_REPORT.md` | This report |

**Not edited:** React bundle `index-22c3e0bs.js`, AdSense `ca-pub-4059575347806121`, auth flows, `/p/:id` APIs, legal pages, product copy locks.

## Verification

| Check | Result |
| --- | --- |
| Live HTML refs | `index-22c3e0bs.js`, `index-c49d2633.css`, `ps-redesign-v2.css`, `ps-motion-v2.js` |
| Live assets 200 | redesign CSS 25251 B, motion JS 4542 B |
| `acorn --ecma2022 --module` main + motion | OK |
| Live `sw.js` | `promptshare-shell-v18` |
| `/api/health` | `ok: true` (d1/r2); email auth true |
| Computed body | `rgb(255,253,249)` / `rgb(36,36,34)`; `--void #fffdf9`; `--cyan #2459e8` |
| SPA mount | `.net-shell` + Discover + 6 cards; not SEO shell; `ps-redesign-v2` + stickers |
| Plate `/p/seed_burger` | stage + `.prompt-under` apricot gradient; `::before "+ FEATURED PROMPT"`; blue breakdown + pink copy |
| Screenshots | `/workspace/ps-review/redesign-v2-desktop.png`, `redesign-v2-mobile.png`, `redesign-v2-plate.png` (+ `redesign-v2-plate-full.png`) |

## Remaining notes

1. Historical CDN may still serve orphaned v1 filenames if requested directly; HTML no longer links them.
2. Peek hostname 301s to `promptshare.fun` (custom domain) — expected for this project.
3. Further markup-level category rails still need SPA work; additive CSS/JS only.
