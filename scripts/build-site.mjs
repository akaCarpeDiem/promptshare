#!/usr/bin/env node
/**
 * Writes every HTML document of the site into overlay/ from one template.
 *
 *   node scripts/build-site.mjs                 new home page at /
 *   node scripts/build-site.mjs --home panels   three-panel home page at /
 *
 * Whichever is chosen, both stay reachable: /start/ is always the new home and
 * /panels/ is always the three-panel one.
 *
 * Inputs:  content/*.html (About and policy text), overlay/data/games.json,
 *          overlay/data/lexicon.json, overlay/app/* (hashed for cache-busting).
 * Outputs: overlay/index.html, start/, panels/, images/, videos/, words/, search/,
 *          games/ (index + one page per game), about/ … contact/, 404.html.
 *
 * No dependencies. Re-run after changing the template, the games data or the content files.
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { segment, renderPrompt, compileLexicon } from "../overlay/app/marks.js";
import { ROLES, ROLE } from "../overlay/app/roles.js";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(REPO, "overlay");
const HOME = process.argv.includes("--home") ? process.argv[process.argv.indexOf("--home") + 1] : "new";
const ORIGIN = "https://promptshare.co";

const read = (rel) => readFileSync(join(REPO, rel), "utf8");
const write = (rel, text) => {
  const file = join(OUT, rel);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text);
};
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// One version string for everything in /app and /data: changes whenever any of those files change.
const hash = createHash("sha256");
for (const dir of ["overlay/app", "overlay/app/views", "overlay/data"]) {
  for (const f of readdirSync(join(REPO, dir)).sort()) if (/\.(js|css|json)$/.test(f)) hash.update(read(`${dir}/${f}`));
}
const V = hash.digest("hex").slice(0, 10);

const games = JSON.parse(read("overlay/data/games.json"));
const matcher = compileLexicon(JSON.parse(read("overlay/data/lexicon.json")));

/* ------------------------------------------------------------ template */

const LOGO = `<svg viewBox="0 0 48 48" aria-hidden="true"><defs><linearGradient id="ps-mark" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8ee9ff"/><stop offset="1" stop-color="#c4a6ff"/></linearGradient></defs><rect x="3.2" y="6.4" width="28.4" height="16.8" rx="5.2" fill="#1c1e2c" stroke="url(#ps-mark)" stroke-width="1.7"/><path d="M8.2 14.8h9.2" fill="none" stroke="#f4f1ff" stroke-width="1.35" stroke-linecap="round" opacity="0.9"/><path d="M20.2 12.2 23.4 14.8 20.2 17.4" fill="none" stroke="#8ee9ff" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><rect x="16.4" y="24.8" width="28.4" height="16.8" rx="5.2" fill="#1c1e2c" stroke="url(#ps-mark)" stroke-width="1.7"/><path d="M30.6 33.2h9.2" fill="none" stroke="#f4f1ff" stroke-width="1.35" stroke-linecap="round" opacity="0.9"/><path d="M27.8 30.6 24.6 33.2l3.2 2.6" fill="none" stroke="#c4a6ff" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

const HEADER = `<a class="skip" href="#main">Skip to content</a>
<header class="top">
  <div class="wrap top-in">
    <a class="brand" href="/" aria-label="PromptShare home">${LOGO}<span>PromptShare</span></a>
    <nav class="nav" aria-label="Sections">
      <a href="/images/">Images</a>
      <a href="/videos/">Videos</a>
      <a href="/games/">Games</a>
      <a href="/words/">Words</a>
    </nav>
    <div class="top-tools">
      <form class="search" role="search" action="/search/" method="get">
        <label class="sr" for="q">Search prompts</label>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 21 21"/></svg>
        <input id="q" name="q" type="search" placeholder="Search prompts" autocomplete="off" enterkeyhint="search">
        <kbd aria-hidden="true">/</kbd>
      </form>
      <button type="button" class="icon-btn theme-btn" aria-label="Switch colour mode">
        <svg class="i-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>
        <svg class="i-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>
      </button>
    </div>
  </div>
</header>`;

const FOOTER = `<footer class="foot">
  <div class="wrap foot-in">
    <div>
      <a class="brand" href="/">${LOGO}<span>PromptShare</span></a>
      <p>An educational gallery of AI-generated images, videos and games, each shown with the prompt that made it. Not a generator, not a model vendor, not a marketplace. Notes are PromptShare's interpretations, not professional advice.</p>
    </div>
    <nav aria-label="Browse">
      <h2>Browse</h2>
      <ul><li><a href="/images/">Images</a></li><li><a href="/videos/">Videos</a></li><li><a href="/games/">Games</a></li><li><a href="/words/">Words</a></li></ul>
    </nav>
    <nav aria-label="About">
      <h2>About</h2>
      <ul><li><a href="/about/">About</a></li><li><a href="/contact/">Contact</a></li><li><a href="/terms/">Terms</a></li><li><a href="/privacy/">Privacy</a></li><li><a href="/cookies/">Cookies</a></li></ul>
    </nav>
  </div>
</footer>`;

// Modules app.js imports, listed so the browser fetches them in parallel instead of discovering them one by one.
const SHARED_MODULES = ["data.js", "ui.js", "card.js", "marks.js", "roles.js"];
const VIEW_MODULES = ["views/home.js", "views/browse.js", "views/plate.js"];

/**
 * A full document.
 * `app: true` marks a gallery page whose #root is drawn by /app/app.js; `root` is what shows
 * until then (and what search engines read). `functions/p/[id].ts` reuses the home document as
 * the shell for plate pages and swaps the #root…</noscript> block, so that block keeps this exact shape.
 */
function page({ path, title, description, root, app = false, bodyAttrs = "", htmlAttrs = "", robots = "index,follow", canonical = path, image = "/og.png", extraHead = "" }) {
  const url = ORIGIN + canonical;
  return `<!doctype html>
<html lang="en"${htmlAttrs}>
  <head>
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-3NENPL8C1E"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());

  gtag('config', 'G-3NENPL8C1E');
</script>
    <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-4059575347806121"
     crossorigin="anonymous"></script>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="robots" content="${robots}" />
    <title>${esc(title)}</title>
    <meta name="description" content="${esc(description)}" />
    <link rel="canonical" href="${esc(url)}" />
    <meta name="theme-color" content="#0c0e12" />
    <meta name="color-scheme" content="light dark" />
    <script>try{var t=localStorage.getItem("ps-theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}</script>
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <link rel="apple-touch-icon" href="/icon-192.png" />
    <link rel="manifest" href="/site.webmanifest" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="PromptShare" />
    <meta property="og:url" content="${esc(url)}" />
    <meta property="og:title" content="${esc(title)}" />
    <meta property="og:description" content="${esc(description)}" />
    <meta property="og:image" content="${esc(ORIGIN + image)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${esc(title)}" />
    <meta name="twitter:description" content="${esc(description)}" />
    <meta name="twitter:image" content="${esc(ORIGIN + image)}" />
    <link rel="preload" href="/fonts/outfit-normal-400.woff2" as="font" type="font/woff2" crossorigin />
    <link rel="preload" href="/fonts/fraunces-normal-500.woff2" as="font" type="font/woff2" crossorigin />
    <link rel="stylesheet" href="/app/app.css?v=${V}" />
    <link rel="modulepreload" href="/app/app.js?v=${V}" />
${(app ? [...SHARED_MODULES, ...VIEW_MODULES] : SHARED_MODULES).map((m) => `    <link rel="modulepreload" href="/app/${m}" />`).join("\n")}${app ? `
    <link rel="preload" href="/api/catalog" as="fetch" crossorigin />` : ""}
    <script type="module" src="/app/app.js?v=${V}"></script>${extraHead}
  </head>
  <body data-shell="${app ? "app" : "page"}"${bodyAttrs}>
${HEADER}
    <div id="root">${root}</div>
    <noscript><p class="wrap fine" style="padding-block:16px">PromptShare needs JavaScript to draw the gallery. The <a href="/about/">About</a> page and the policy pages work without it.</p></noscript>
${FOOTER}
  </body>
</html>
`;
}

const skeleton = (n = 8) => `<div class="grid" aria-hidden="true">${'<div class="skel skel-card"></div>'.repeat(n)}</div>`;
const browseRoot = (h1, lede) => `<main class="wrap" id="main"><header class="ph"><div class="ph-top"><h1 class="h1">${h1}</h1></div><p class="lede">${lede}</p></header>${skeleton()}</main>`;

/* --------------------------------------------------------------- home */

const HOME_DESC = "PromptShare is an educational curated gallery of AI images, videos and games, each shown with the exact prompt that made it.";
const homeRoot = `<main id="main"><div class="wrap"><section class="hero"><div>
  <h1 class="display">The output, then the prompt.</h1>
  <p class="lede">A curated gallery of AI images, videos and games. Each one sits beside the exact prompt that made it, with the phrases that did the work marked and explained.</p>
  <div class="hero-go"><a class="btn btn-solid" href="/images/">Browse images</a><a class="btn" href="/videos/">Watch videos</a><a class="btn" href="/games/">Play games</a></div>
</div><div class="demo" aria-hidden="true"><div class="demo-shot skel"></div></div></section></div></main>`;
const panelsRoot = `<main id="main" class="panels"><div class="panels-say"><h1>The output, then the prompt.</h1><p>AI images, videos and games, each beside the exact prompt that made it.</p></div></main>`;
const homeMeta = { title: "PromptShare — The output, then the prompt", description: HOME_DESC, app: true };

write("index.html", page({ ...homeMeta, path: "/", root: HOME === "panels" ? panelsRoot : homeRoot, htmlAttrs: HOME === "panels" ? ' data-home="panels"' : "", bodyAttrs: HOME === "panels" ? ' class="panels-page"' : "" }));
write("start/index.html", page({ ...homeMeta, path: "/start/", canonical: "/", robots: "noindex,follow", root: homeRoot }));
write("panels/index.html", page({ ...homeMeta, path: "/panels/", canonical: "/", robots: "noindex,follow", root: panelsRoot, bodyAttrs: ' class="panels-page"' }));

/* ------------------------------------------------------------- browse */

write("images/index.html", page({ path: "/images/", app: true, title: "Images — PromptShare", description: "Curated AI images, each with the exact prompt that made it and notes on which phrases did the work.", root: browseRoot("Images", "Each picture sits beside the exact prompt that made it. Marked phrases are the ones doing the work.") }));
write("videos/index.html", page({ path: "/videos/", app: true, title: "Videos — PromptShare", description: "Curated AI video clips, each with the exact prompt that made it and notes on which phrases did the work.", root: browseRoot("Videos", "Short clips, each beside the exact prompt that made it. Marked phrases are the ones doing the work.") }));
write("words/index.html", page({ path: "/words/", app: true, title: "Words — PromptShare", description: "The phrases that turn up again and again in AI prompts, what each one tends to change, and every image and video here that used it.", root: browseRoot("Words", "The phrases that do the work, and what each one tends to change.") }));
write("search/index.html", page({ path: "/search/", app: true, robots: "noindex,follow", title: "Search — PromptShare", description: "Search PromptShare by prompt, title, category or model.", root: browseRoot("Search", "Search titles, prompts, categories and model names.") }));
write("404.html", page({ path: "/404", robots: "noindex", title: "Not found — PromptShare", description: "That page isn't here.", root: `<main class="wrap" id="main"><div class="status"><h1 class="h2">That page isn't here</h1><p>Try <a href="/images/">Images</a>, <a href="/videos/">Videos</a> or <a href="/games/">Games</a>.</p></div></main>` }));

/* -------------------------------------------------------------- games */

const playIcon = `<svg viewBox="0 0 12 12" fill="currentColor" aria-hidden="true"><path d="M3 1.6v8.8a.6.6 0 0 0 .9.5l7-4.4a.6.6 0 0 0 0-1L3.9 1.1a.6.6 0 0 0-.9.5z"/></svg>`;
const gameCard = (g) => `<a class="card game-card" href="/games/${g.slug}/" data-diff="${g.diff}">
  <div class="card-media"><img src="${g.poster}" alt="" width="640" height="480" loading="lazy" decoding="async"><span class="card-kind">${playIcon}Play</span></div>
  <div class="card-body"><div class="card-head"><h2 class="card-title">${esc(g.title)}</h2><span class="diff" data-diff="${g.diff}">${esc(g.label)}</span></div><p class="prompt">${esc(g.prompt)}</p></div>
</a>`;

write("games/index.html", page({
  path: "/games/", bodyAttrs: ' data-page="games"', title: "Games — PromptShare",
  description: "Small browser games, each written by an AI model from a single prompt. Play one, then read the prompt that made it.",
  root: `<main class="wrap" id="main">
  <header class="ph">
    <div class="ph-top">
      <h1 class="h1">Games <small class="num">${games.length}</small></h1>
      <div class="toolbar"><div class="seg" role="group" aria-label="Difficulty" data-diff-filter>
        <button type="button" data-diff="" aria-pressed="true">All</button><button type="button" data-diff="simple" aria-pressed="false">Simple</button><button type="button" data-diff="mid" aria-pressed="false">Mid</button><button type="button" data-diff="advanced" aria-pressed="false">Advanced</button>
      </div></div>
    </div>
    <p class="lede">Small browser games, each written by an AI model from a single prompt. Play one, then read the prompt that made it.</p>
  </header>
  <div class="grid">${games.map(gameCard).join("\n")}</div>
</main>`,
}));

const chevron = `<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4.5 2.5 8 6l-3.5 3.5"/></svg>`;
const expand = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>`;
const arrow = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;

games.forEach((g, i) => {
  const segments = segment(g.prompt, g.notes, matcher);
  const marks = segments.filter((s) => s.role);
  const roles = ROLES.filter((r) => marks.some((m) => m.role === r.id));
  const prev = games[i - 1];
  const next = games[i + 1];
  const step = (to, label, d) => (to ? `<a class="btn step-btn" href="/games/${to.slug}/" aria-label="${label}: ${esc(to.title)}" title="${label}">${arrow(d)}</a>` : `<a class="btn step-btn" aria-disabled="true" aria-label="${label}">${arrow(d)}</a>`);
  write(`games/${g.slug}/index.html`, page({
    path: `/games/${g.slug}/`, bodyAttrs: ' data-page="game"', title: `${g.title} — PromptShare Games`, description: g.description, image: "/og.png",
    root: `<main class="wrap" id="main">
  <nav class="crumbs" aria-label="Where you are">
    <a href="/games/">Games</a>${chevron}<a href="/games/?diff=${g.diff}">${esc(g.label)}</a>
    <span class="step"><span class="fine num" style="align-self:center;margin-right:6px">${i + 1} of ${games.length}</span>${step(prev, "Previous game", "M15 5l-7 7 7 7")}${step(next, "Next game", "M9 5l7 7-7 7")}</span>
  </nav>
  <h1 class="h1">${esc(g.title)}</h1>
  <p class="facts"><span class="tag">${esc(g.model)}</span><span class="tag">Game</span><span class="diff" data-diff="${g.diff}">${esc(g.label)}</span></p>
  <div class="game" data-game="${g.slug}">
    <div class="game-stage">
      <div class="game-frame"><iframe src="/games/play/${g.slug}.html" title="${esc(g.title)}" loading="eager" allow="fullscreen; autoplay"></iframe></div>
      <div class="stage-tools"><span class="fine">Runs in your browser. Nothing to install.</span><button type="button" class="btn btn-quiet btn-sm" data-full>${expand}Full screen</button></div>
    </div>
    <aside class="board" aria-label="Top 10 scores">
      <h2>Top 10</h2>
      <p class="fine" id="ps-score-empty">No scores yet. Be the first.</p>
      <ol id="ps-board"></ol>
      <div class="board-who" id="ps-who"></div>
    </aside>
  </div>
  <div class="game-read">
    <section class="panel" aria-label="The prompt">
      <div class="panel-head"><h2>The prompt</h2><button type="button" class="btn btn-solid btn-sm" data-copy-prompt>Copy prompt</button></div>
      <p class="prompt" id="prompt">${renderPrompt(segments, { interactive: true })}</p>
      <ul class="legend">${roles.map((r) => `<li data-role="${r.id}"><i></i>${esc(r.name)}</li>`).join("")}</ul>
    </section>
    <section class="notes">
      <h2 class="h2">What each part does</h2>
      <p class="fine">Notes are PromptShare's reading of this prompt, not the model's commentary.</p>
      <ol>${marks.map((m) => `<li><div class="note" data-role="${m.role}" data-n="${m.n}"><span><span class="note-kind">${esc(ROLE[m.role].name)}</span><span class="note-phrase">${esc(m.text)}</span><span class="note-means">${esc(m.note ? m.note.means : m.term.means)}</span></span></div></li>`).join("")}</ol>
    </section>
  </div>
  <p class="fine disclaimer">Self-contained HTML and canvas, running on this site. No account and no upload. Scores are stored under the display name you choose.</p>
</main>`,
  }));
});

/* ---------------------------------------------------------- documents */

for (const file of readdirSync(join(REPO, "content")).filter((f) => f.endsWith(".html"))) {
  const name = file.replace(/\.html$/, "");
  const src = read(`content/${file}`);
  const title = /<!-- title: (.*?) -->/.exec(src)?.[1] || name;
  const description = /<!-- description: (.*?) -->/.exec(src)?.[1] || "";
  const body = src.replace(/<!-- (title|description): .*? -->\n?/g, "");
  write(`${name}/index.html`, page({ path: `/${name}/`, title, description, root: `<main class="wrap" id="main"><article class="doc">${body}</article></main>` }));
}

console.log(`built ${HOME === "panels" ? "three-panel" : "new"} home at /, version ${V}`);
