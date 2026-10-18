// The two home pages. `home` explains the site and shows it working; `panels` is the original
// three-way split (Images / Videos / Games), kept and tidied.
import { db, filter, previewOf } from "../data.js";
import { ROLES, ROLE } from "../roles.js";
import { renderPrompt } from "../marks.js";
import { plateCard, gameCard } from "../card.js";
import { esc, fmt, $, $$, reducedMotion } from "../ui.js";
import { mountDoorSnake } from "../door-snake.js";

// Plates whose notes show several different jobs and whose picture clearly delivers each one.
const DEMOS = ["seed_cities_q_istanbul_bosphorus", "seed_landscapes_q_red_mesa", "seed_portrait_teal_hoops", "seed_comic_q_rooftop_courier"];

/** The plates the home page reads out: the chosen ones if present, otherwise the best-annotated images. */
function demoPlates(n = 4) {
  const chosen = DEMOS.map((id) => db.byId.get(id)).filter((p) => p && p.segments.some((s) => s.note));
  if (chosen.length >= 2) return chosen.slice(0, n);
  const scored = db.plates
    .filter((p) => p.mediaKind === "image" && db.notes[p.id])
    .map((p) => {
      const noted = p.segments.filter((s) => s.note);
      const roles = new Set(noted.map((s) => s.role));
      return { p, score: roles.size * 3 + Math.min(noted.length, 5) + (p.featured ? 2 : 0) - (p.prompt.length > 230 ? 3 : 0) };
    })
    .sort((a, b) => b.score - a.score);
  const out = [];
  const cats = new Set();
  for (const { p } of scored) {
    if (cats.has(p.category)) continue; // four different kinds of picture
    cats.add(p.category);
    out.push(p);
    if (out.length === n) break;
  }
  return out;
}

/** Up to n plates, taking one from each category in turn so a row isn't five landscapes. */
function spread(list, n) {
  const groups = new Map();
  for (const p of list) groups.set(p.category, [...(groups.get(p.category) || []), p]);
  const out = [];
  for (let round = 0; out.length < n && round < 8; round++) {
    for (const g of groups.values()) if (g[round] && out.length < n) out.push(g[round]);
  }
  return out;
}

// Pictures that read well large and cropped, tried in order; any featured image is the fallback.
const LEADS = ["seed_cyberpunk_neon_alley", "seed_vehicles_q_river_airboat", "seed_lake", "seed_blossoms"];
const lead = (images, skip = 0) => LEADS.map((id) => db.byId.get(id)).filter(Boolean)[skip] || images.find((p) => p.featured) || images[0];

export function home(root) {
  const images = filter({ kind: "image" });
  const videos = filter({ kind: "video" });
  const demos = demoPlates();
  const shown = new Set(demos.map((p) => p.id));
  const pool = (list) => { const f = list.filter((p) => p.featured && !shown.has(p.id)); return f.length >= 4 ? f : list; };
  const featuredImages = spread(pool(images), 8);
  const featuredVideos = spread(pool(videos), 4);
  const doorImage = lead(images);
  // One game of each difficulty first, then fill the row.
  const firstOf = ["simple", "mid", "advanced"].map((d) => db.games.find((g) => g.diff === d)).filter(Boolean);
  const homeGames = [...firstOf, ...db.games.filter((g) => !firstOf.includes(g))].slice(0, 4);
  const wordsIn = (id) => [...db.words.values()].filter((w) => w.term.role === id).sort((a, b) => b.plates.length - a.plates.length);
  // The four jobs with the most phrases in use.
  const wall = ROLES.filter((r) => r.id !== "guard").map((r) => ({ role: r, words: wordsIn(r.id) })).filter((c) => c.words.length >= 3)
    .sort((a, b) => b.words.length - a.words.length).slice(0, 4).map((c) => ({ ...c, words: c.words.slice(0, 7) }));

  root.innerHTML = `<main id="main" tabindex="-1">
  <div class="wrap">
    <section class="hero">
      <div>
        <h1 class="display">The output, then the prompt.</h1>
        <p class="lede">A curated gallery of AI images, videos and games. Each one sits beside the exact prompt that made it, with the phrases that did the work marked and explained.</p>
        <div class="hero-go">
          <a class="btn btn-solid" href="/images/">Browse images</a>
          <a class="btn" href="/videos/">Watch videos</a>
          <a class="btn" href="/games/">Play games</a>
        </div>
        <p class="hero-words"><a href="/words/">Words</a>: the phrases that do the work, each one explained, with every prompt here that uses it.</p>
        <p class="hero-counts num"><span><b>${fmt(images.length)}</b> images</span><span><b>${fmt(videos.length)}</b> videos</span><span><b>${fmt(db.games.length)}</b> games</span><span><b>${fmt(Object.values(db.notes).reduce((n, list) => n + list.length, 0))}</b> prompt notes</span></p>
      </div>
      ${demos.length ? `<div class="demo" aria-label="Example: a prompt read phrase by phrase">
        <div class="demo-shot">${demos.map((p, i) => `<img src="${esc(p.mediaUrl)}" alt="${esc(p.title)}" width="${p.width || 1280}" height="${p.height || 720}" ${i ? 'loading="lazy"' : 'fetchpriority="high"'} decoding="async">`).join("")}<a href="#" aria-label="Open this plate"></a></div>
        <div class="demo-read">
          <p class="prompt"></p>
          <p class="demo-note" aria-live="off"></p>
        </div>
        <div class="demo-bar">
          <div class="demo-dots" role="group" aria-label="Choose an example">${demos.map((p, i) => `<button type="button" data-demo="${i}" aria-label="${esc(p.title)}"></button>`).join("")}</div>
          <a class="fine" href="#" data-demo-link>Open this plate</a>
        </div>
      </div>` : ""}
    </section>

    <section class="doors" aria-label="Sections">
      <a class="door" href="/images/">${doorImage ? `<img src="${esc(doorImage.mediaUrl)}" alt="" loading="lazy" decoding="async">` : ""}<div><strong>Images</strong><span>${fmt(images.length)} stills in ${new Set(images.map((p) => p.category).filter(Boolean)).size} categories</span></div></a>
      <a class="door" href="/videos/"><video src="/media/video/hub-alpine-540.mp4" poster="/media/posters/landscapes-alpine-lake.jpg" muted loop playsinline preload="none" data-quiet-loop></video><div><strong>Videos</strong><span>${fmt(videos.length)} clips with motion prompts</span></div></a>
      <a class="door door-games" href="/games/"><img src="/games/posters/hub-tech-bg-custom.webp" alt="" loading="lazy" decoding="async"><div><strong>Games</strong><span>${fmt(db.games.length)} playable games, one prompt each</span></div></a>
    </section>

    <section class="band">
      <div class="row-head"><h2 class="h2">Words that do the work</h2><a href="/words/">All ${fmt(db.words.size)} phrases</a></div>
      <p class="lede">Pick a phrase to see what it tends to change, and every prompt here that uses it.</p>
      <div class="word-wall">${wall.map(({ role, words }) => `<div class="word-col" data-role="${role.id}"><h3><i class="role-dot"></i>${esc(role.name)}</h3><div class="terms">${words.map((w) => `<a class="term" data-role="${role.id}" href="/words/?w=${encodeURIComponent(w.term.t)}">${esc(w.term.t)} <span class="num">${w.plates.length}</span></a>`).join("")}</div></div>`).join("")}</div>
    </section>

    ${featuredImages.length ? `<section class="band"><div class="row-head"><h2 class="h2">Featured images</h2><a href="/images/">All images</a></div><div class="grid" data-row="images">${featuredImages.map((p) => plateCard(p)).join("")}</div></section>` : ""}
    ${featuredVideos.length ? `<section class="band"><div class="row-head"><h2 class="h2">Featured videos</h2><a href="/videos/">All videos</a></div><div class="grid" data-row="videos">${featuredVideos.map((p) => plateCard(p)).join("")}</div></section>` : ""}
    ${db.games.length ? `<section class="band"><div class="row-head"><h2 class="h2">Games from a single prompt</h2><a href="/games/">All games</a></div><div class="grid" data-row="games">${homeGames.map((g) => gameCard(g)).join("")}</div></section>` : ""}
  </div>
</main>`;
  $$("[data-row]", root).forEach((grid) => (grid._ids = $$(".card[data-id]", grid).map((c) => c.dataset.id)));
  document.title = "PromptShare — The output, then the prompt";
  // The Videos door plays its clip only when it is on screen and motion is welcome.
  const loop = $("[data-quiet-loop]", root);
  let loopWatch = null;
  if (loop && !reducedMotion()) {
    loopWatch = new IntersectionObserver(([e]) => { if (e.isIntersecting) loop.play().catch(() => {}); else loop.pause(); }, { threshold: 0.25 });
    loopWatch.observe(loop);
  }
  // The Games door: the retro snake from the old Games triangle (door-snake.js).
  const unSnake = mountDoorSnake($(".door-games", root));
  if (!demos.length) return { destroy: () => { loopWatch?.disconnect(); unSnake(); } };

  /* The demo: light each noted phrase in turn and say what it did. One plate, then the next. */
  const shots = $$(".demo-shot img", root);
  const promptEl = $(".demo-read .prompt", root);
  const noteEl = $(".demo-note", root);
  const dots = $$("[data-demo]", root);
  const links = [$(".demo-shot a", root), $("[data-demo-link]", root)];
  let plateAt = -1, markAt = 0, timer = 0, paused = false, marks = [];
  const showMark = (i) => {
    markAt = i;
    $$(".mk", promptEl).forEach((el) => el.classList.toggle("is-on", el.dataset.k === String(i)));
    const m = marks[i];
    noteEl.dataset.role = m.role;
    noteEl.innerHTML = `<b>${esc(ROLE[m.role].name)}</b><span>${esc(m.note.means)}</span>`;
  };
  const showPlate = (i) => {
    plateAt = i;
    const p = demos[i];
    shots.forEach((img, k) => img.classList.toggle("is-on", k === i));
    dots.forEach((d, k) => d.setAttribute("aria-pressed", String(k === i)));
    links.forEach((a) => (a.href = `/p/${encodeURIComponent(p.id)}`));
    marks = p.segments.filter((s) => s.note);
    let k = 0;
    promptEl.innerHTML = p.segments.map((s) => (s.note ? `<span class="mk" data-role="${s.role}" data-k="${k++}">${esc(s.text)}</span>` : esc(s.text))).join("");
    showMark(0);
  };
  const tick = () => {
    if (paused || document.hidden) return;
    if (markAt + 1 < marks.length) showMark(markAt + 1);
    else showPlate((plateAt + 1) % demos.length);
  };
  showPlate(0);
  if (!reducedMotion()) timer = setInterval(tick, 2800);
  const demo = $(".demo", root);
  demo.addEventListener("pointerenter", () => (paused = true));
  demo.addEventListener("pointerleave", () => (paused = false));
  demo.addEventListener("focusin", () => (paused = true));
  demo.addEventListener("focusout", () => (paused = false));
  demo.addEventListener("click", (e) => { const d = e.target.closest("[data-demo]"); if (d) showPlate(Number(d.dataset.demo)); });
  promptEl.addEventListener("pointerover", (e) => { const mk = e.target.closest(".mk"); if (mk) showMark(Number(mk.dataset.k)); });
  return { destroy: () => { clearInterval(timer); loopWatch?.disconnect(); unSnake(); } };
}

export function panels(root) {
  const images = filter({ kind: "image" });
  const videos = filter({ kind: "video" });
  const img = lead(images, 1);
  root.innerHTML = `<main id="main" tabindex="-1" class="panels">
    <a class="pane pane-images" href="/images/">
      ${img ? `<img src="${esc(img.mediaUrl)}" alt="" fetchpriority="high" decoding="async">` : ""}
      <span class="pane-label">Images<small>${fmt(images.length)} stills with their prompts</small></span>
    </a>
    <a class="pane pane-videos" href="/videos/">
      <video src="/media/video/hub-alpine-540.mp4" poster="/media/posters/landscapes-alpine-lake.jpg" muted loop playsinline autoplay preload="auto"></video>
      <span class="pane-label">Videos<small>${fmt(videos.length)} clips with their prompts</small></span>
    </a>
    <a class="pane pane-games ps-disc-pane--games" href="/games/">
      <span class="ps-disc-media" style="position:absolute;inset:0"><img src="/games/posters/hub-tech-bg-custom.webp" alt="" decoding="async"><span class="ps-disc-shade"></span></span>
      <span class="pane-label ps-disc-word">Games<small>${fmt(db.games.length)} playable, one prompt each</small></span>
    </a>
    <svg class="panels-line" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="M50 0V62.5M50 62.5 0 100M50 62.5 100 100" fill="none" stroke="rgba(255,255,255,.42)" stroke-width="1" vector-effect="non-scaling-stroke"/></svg>
    <div class="panels-say">
      <h1>The output, then the prompt.</h1>
      <p>AI images, videos and games, each beside the exact prompt that made it.</p>
    </div>
  </main>`;
  document.title = "PromptShare — The output, then the prompt";
  if (!window.__psSnakeLoaded) {
    window.__psSnakeLoaded = true;
    const s = document.createElement("script");
    s.src = "/app/hub-snake.js";
    s.defer = true;
    document.head.append(s);
  }
}
