# PromptShare front end

No framework and no build step for the code: plain ES modules and one stylesheet, served as they are.
One script (`scripts/build-site.mjs`) writes the HTML documents.

## The idea

The site teaches people to read prompts, so a prompt is set like code under review: monospaced, with
each influential phrase marked in the colour of the job it does. There are eight jobs ("roles"):
Subject, Place, Style, Light & weather, Camera & framing, Motion & time, Detail, Guardrail.
Everything else in the interface is monochrome, so the marks and the media are the only colour.

Marks come from two places:

- `overlay/data/notes.json`: notes written for one plate (`{ plateId: [{ phrase, kind, means }] }`).
- `overlay/data/lexicon.json`: the site-wide glossary (`{ t, role, means, also? }`). Every prompt is
  scanned for these phrases. This is what powers the Words pages.

A plate's own notes win where the two overlap.

## Where things are

```
overlay/app/app.css        the whole design: tokens (light and dark), components, pages
overlay/app/app.js         entry: header, theme, router for the gallery pages
overlay/app/data.js        loads /api/catalog + the three data files; filtering and counts
overlay/app/marks.js       prompt → marked segments (pure functions, also used by the build script)
overlay/app/roles.js       the eight roles and the 19 categories
overlay/app/card.js        cards, paged grids, hover video previews
overlay/app/views/home.js  the two home pages
overlay/app/views/browse.js  Images, Videos, Search, Words
overlay/app/views/plate.js   one output with its prompt
overlay/app/game.js        games index filter and game-page leaderboard
overlay/app/hub-snake.js   the snake in the Games triangle of the three-panel home
overlay/data/games.json    the 17 games: prompt, notes, difficulty, poster
content/*.html             text of About, Privacy, Terms, Cookies, Contact
scripts/build-site.mjs     writes every HTML document into overlay/
scripts/dev-server.mjs     local server that runs the real functions
scripts/check-notes.mjs    checks notes.json against the live catalogue
```

## Pages

| URL | What draws it |
| --- | --- |
| `/` | `home` (or `panels` if built with `--home panels`) |
| `/start/`, `/panels/` | always the new home / the three-panel home |
| `/images/`, `/videos/` | `browse`; `?tag=<category>` and `?model=<name>` filter |
| `/words/`, `/words/?w=<phrase>` | `words` |
| `/search/?q=` | `search` |
| `/p/<id>` | `functions/p/[id].ts` sends the plate inside the home document; `plate` redraws it |
| `/games/`, `/games/<slug>/` | static HTML from the build script + `game.js` |
| `/about/` … `/contact/` | static HTML from `content/` |

The gallery pages are separate HTML files but behave as one app: links between them swap the view in
place (with a View Transition where the browser has it), so the catalogue is fetched once.

## Common changes

- **Switch the home page:** `node scripts/build-site.mjs --home panels` (or without the flag), commit, deploy.
- **Change header, footer or `<head>`:** edit the template in `scripts/build-site.mjs`, re-run it.
- **Edit About or a policy page:** edit `content/<name>.html`, re-run the build script.
- **Add a glossary phrase:** add `{ "t": "…", "role": "light", "means": "…" }` to `overlay/data/lexicon.json`,
  re-run the build script (it refreshes the version hash). Keep `means` general and hedged: it describes what
  the phrase usually does, not what one picture shows. Optional fields: `also` (other spellings counted as the
  same phrase) and `notBefore` / `notAfter` (words that, straight after or before the match, mean a different
  sense: "wide" is a camera term, "wide river" is not).
- **Add notes for a plate:** add its id to `overlay/data/notes.json`. Each `phrase` must appear in the prompt
  exactly as written. `kind` can be a role id or one of the older labels listed in `roles.js`. Every plate has
  notes as of 2026-10-11; they were written while looking at the picture, and say so when a phrase did not show
  up in the result. Keep to that: describe what the phrase asked for and what is visible, nothing more.
- **Add a game:** put the game at `overlay/games/play/<slug>.html`, a poster at `overlay/games/posters/<slug>.svg`,
  add an entry to `overlay/data/games.json`, add the slug to `STATIC_PATHS` in `functions/sitemap.xml.ts`, re-run the build script.
- **New plates** show up by themselves: they come from D1 through `/api/catalog`. Until notes are written for
  one it is marked from the glossary only. `node scripts/check-notes.mjs` lists plates without notes and any
  note whose phrase no longer matches its prompt.

## Rules worth keeping

- `functions/p/[id].ts` replaces `<div id="root">…</div>` and the `<noscript>` straight after it in `index.html`.
  Keep those two elements adjacent in the template.
- Modules import each other by plain path, so `/app/*` and `/data/*` are served with `must-revalidate`
  (`overlay/_headers`). Don't mark them immutable.
- Theme: `light-dark()` tokens follow the device; the header button stores an override in
  `localStorage["ps-theme"]`, applied by an inline script in `<head>` before first paint.
- Motion respects `prefers-reduced-motion`: no auto-advancing example, no looping door video, no transitions.
