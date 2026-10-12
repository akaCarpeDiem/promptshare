// Images, Videos, Search and Words: four ways into the same set of plates.
import { db, filter, counts } from "../data.js";
import { CATEGORIES, CATEGORY, ROLES, ROLE } from "../roles.js";
import { plateCard, gameCard, mountGrid } from "../card.js";
import { esc, fmt, plural, icon, $ } from "../ui.js";

const store = {
  get: (k, d) => { try { return localStorage.getItem(k) || d; } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch {} },
};
const setQuery = (params) => {
  const url = new URL(location.href);
  for (const [k, v] of Object.entries(params)) {
    if (v) url.searchParams.set(k, v);
    else url.searchParams.delete(k);
  }
  history.replaceState(history.state, "", url.pathname + url.search);
};

function densityControl() {
  const d = store.get("ps-density", "study");
  return `<div class="seg" role="group" aria-label="Card style">
    <button type="button" data-density="study" aria-pressed="${d === "study"}">With prompts</button>
    <button type="button" data-density="gallery" aria-pressed="${d === "gallery"}">Pictures only</button>
  </div>`;
}
function wireDensity(root, grid) {
  grid.dataset.density = store.get("ps-density", "study");
  root.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-density]");
    if (!btn) return;
    store.set("ps-density", btn.dataset.density);
    grid.dataset.density = btn.dataset.density;
    root.querySelectorAll("[data-density]").forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
  });
}

/* ------------------------------------------------------------ Images / Videos */

export function browse(kind) {
  const noun = kind === "video" ? "video" : "image";
  const title = kind === "video" ? "Videos" : "Images";
  return (root, ctx) => {
    const all = filter({ kind });
    const params = ctx.url.searchParams;
    const state = { tag: CATEGORY[params.get("tag")] ? params.get("tag") : "", model: params.get("model") || "" };
    const models = [...counts(all, (p) => p.displayModel)].sort((a, b) => b[1] - a[1]);
    if (!models.some(([m]) => m === state.model)) state.model = "";
    const perTag = counts(all, (p) => p.tags);

    root.innerHTML = `<main class="wrap" id="main" tabindex="-1">
  <header class="ph">
    <div class="ph-top">
      <h1 class="h1">${title} <small class="num">${fmt(all.length)}</small></h1>
      <div class="toolbar">
        <select class="select" aria-label="Model"><option value="">All models</option>${models.map(([m, n]) => `<option value="${esc(m)}"${m === state.model ? " selected" : ""}>${esc(m)} (${n})</option>`).join("")}</select>
        ${densityControl()}
      </div>
    </div>
    <p class="lede">${kind === "video" ? "Short clips, each beside the exact prompt that made it. Hover a card to play it." : "Each picture sits beside the exact prompt that made it."} Marked phrases are the ones doing the work.</p>
  </header>
  <div class="filters">
    <nav class="chips" aria-label="Categories"><div class="chips-track">
      <button type="button" class="chip" data-tag="">All</button>
      ${CATEGORIES.filter((c) => perTag.get(c.slug)).map((c) => `<button type="button" class="chip" data-tag="${c.slug}">${esc(c.label)} <span class="num">${perTag.get(c.slug)}</span></button>`).join("")}
    </div></nav>
  </div>
  <p class="fine" data-count aria-live="polite"></p>
  <div class="grid" style="margin-top:12px"></div>
</main>`;

    const grid = $(".grid", root);
    const count = $("[data-count]", root);
    let mounted = null;
    let first = true;
    const paint = () => {
      const list = filter({ kind, tag: state.tag, model: state.model });
      root.querySelectorAll("[data-tag]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.tag === state.tag)));
      const where = [state.tag && CATEGORY[state.tag].label, state.model].filter(Boolean).join(", ");
      count.textContent = list.length ? (where ? `${plural(list.length, noun)} in ${where}` : "") : "";
      mounted?.destroy();
      if (!list.length) {
        grid.innerHTML = `<div class="status" style="grid-column:1/-1"><p class="h2">No ${noun}s match both filters</p><p>Clear the category or the model to see more.</p></div>`;
        return;
      }
      mounted = mountGrid(grid, list, { initial: first ? Number(ctx.state?.shown) || 0 : 0 });
      first = false;
    };
    paint();
    wireDensity(root, grid);
    root.addEventListener("click", (e) => {
      const chip = e.target.closest("[data-tag]");
      if (!chip) return;
      state.tag = chip.dataset.tag;
      setQuery({ tag: state.tag });
      paint();
    });
    $(".select", root).addEventListener("change", (e) => {
      state.model = e.target.value;
      setQuery({ model: state.model });
      paint();
    });
    const pressed = root.querySelector('[data-tag][aria-pressed="true"]');
    pressed?.scrollIntoView({ block: "nearest", inline: "center" });
    document.title = `${state.tag ? CATEGORY[state.tag].label + " · " : ""}${title} — PromptShare`;
    return { snapshot: () => ({ shown: mounted?.shown || 0 }) };
  };
}

/* -------------------------------------------------------------------- Search */

export function search(root, ctx) {
  const q = (ctx.url.searchParams.get("q") || "").trim();
  const input = document.querySelector(".search input");
  if (input && document.activeElement !== input) input.value = q;
  const list = q ? filter({ q }) : [];
  const needle = q.toLowerCase();
  const words = q ? [...db.words.values()].filter((w) => [w.term.t, ...(w.term.also || [])].some((f) => f.includes(needle))).slice(0, 8) : [];
  const games = q ? db.games.filter((g) => `${g.title} ${g.prompt}`.toLowerCase().includes(needle)) : [];
  const nImg = list.filter((p) => p.mediaKind === "image").length;

  root.innerHTML = `<main class="wrap" id="main" tabindex="-1">
  <header class="ph">
    <div class="ph-top">
      <h1 class="h1">${q ? `Results for “${esc(q)}”` : "Search"}</h1>
      ${list.length ? `<div class="toolbar">${densityControl()}</div>` : ""}
    </div>
    <p class="lede">${q ? (list.length || games.length ? `${plural(nImg, "image")}, ${plural(list.length - nImg, "video")}${games.length ? `, ${plural(games.length, "game")}` : ""}.` : "") : "Search titles, prompts, categories and model names."}</p>
  </header>
  ${words.length ? `<div class="filters"><p class="fine">In the word list</p><div class="terms">${words.map((w) => `<a class="term" data-role="${w.term.role}" href="/words/?w=${encodeURIComponent(w.term.t)}">${esc(w.term.t)} <span class="num">${w.plates.length}</span></a>`).join("")}</div></div>` : ""}
  ${games.length ? `<section style="margin-bottom:28px"><div class="row-head"><h2 class="h2">Games</h2></div><div class="grid">${games.map((g) => gameCard(g)).join("")}</div></section>` : ""}
  ${q && !list.length && !games.length ? `<div class="status"><p class="h2">Nothing matches “${esc(q)}”</p><p>Try one word: a subject, a style, a category or a model name.</p></div>` : ""}
  ${!q ? `<div class="filters"><p class="fine">Try one of these</p><div class="chips-track">${["neon", "golden hour", "portrait", "anime", "fog", "Midjourney", "aerial"].map((s) => `<a class="chip" href="/search/?q=${encodeURIComponent(s)}">${esc(s)}</a>`).join("")}</div></div>` : ""}
  <div class="grid"></div>
</main>`;
  const grid = $(".grid:last-of-type", root);
  let mounted = null;
  if (list.length) {
    mounted = mountGrid(grid, list, { initial: Number(ctx.state?.shown) || 0, opts: { highlight: q.length > 1 ? q : "" } });
    wireDensity(root, grid);
  }
  document.title = `${q ? q + " · " : ""}Search — PromptShare`;
  return { snapshot: () => ({ shown: mounted?.shown || 0 }) };
}

/* --------------------------------------------------------------------- Words */

export function words(root, ctx) {
  const pick = ctx.url.searchParams.get("w") || "";
  const entry = db.words.get(pick);
  const byRole = new Map(ROLES.map((r) => [r.id, []]));
  for (const w of db.words.values()) byRole.get(w.term.role)?.push(w);
  for (const list of byRole.values()) list.sort((a, b) => b.plates.length - a.plates.length);
  const termLink = (w) => `<a class="term" data-role="${w.term.role}" href="/words/?w=${encodeURIComponent(w.term.t)}"${w === entry ? ' aria-current="true"' : ""}>${esc(w.term.t)} <span class="num">${w.plates.length}</span></a>`;

  // No phrase picked: the whole list on one page, grouped by the job each phrase does.
  if (!entry) {
    root.innerHTML = `<main class="wrap" id="main" tabindex="-1">
  <header class="ph">
    <h1 class="h1">Words <small class="num">${fmt(db.words.size)}</small></h1>
    <p class="lede">The phrases that turn up again and again in the prompts here, grouped by the job they do. Pick one to read what it usually changes, then compare every image and video that used it.</p>
  </header>
  ${pick ? `<p class="status-line">“${esc(pick)}” isn't in the list. Here is everything that is.</p>` : ""}
  <div class="lex">${ROLES.filter((r) => byRole.get(r.id).length).map((r) => `<section class="lex-role" data-role="${r.id}" id="${r.id}">
      <h2><i class="role-dot"></i>${esc(r.name)} <span class="num">${byRole.get(r.id).length}</span></h2>
      <p>${esc(r.blurb)}</p>
      <div class="terms">${byRole.get(r.id).map(termLink).join("")}</div>
    </section>`).join("")}</div>
  <p class="fine lex-foot">The number beside a phrase is how many prompts here use it. Explanations are PromptShare's reading of common prompt wording: models differ, and the same phrase can land differently from one prompt to the next.</p>
</main>`;
    document.title = "Words — PromptShare";
    return;
  }

  const t = entry.term;
  const role = ROLE[t.role];
  const n = entry.plates.length;
  const list = entry.plates.map((id) => db.byId.get(id)).filter(Boolean);
  const nVid = list.filter((p) => p.mediaKind === "video").length;
  const siblings = byRole.get(t.role).filter((w) => w !== entry);
  root.innerHTML = `<main class="wrap" id="main" tabindex="-1">
  <nav class="crumbs" aria-label="Where you are"><a href="/words/">Words</a>${icon.chevron}<a href="/words/#${t.role}">${esc(role.name)}</a></nav>
  <article class="term-card" data-role="${t.role}">
    <p class="role-name">${esc(role.name)}</p>
    <h1 class="prompt">${esc(t.t)}</h1>
    <p class="term-means">${esc(t.means)}</p>
    <p class="fine">Used in ${plural(n, "prompt")} here${nVid && nVid < n ? ` (${plural(n - nVid, "image")}, ${plural(nVid, "video")})` : ""}${t.also?.length ? `. Also counted: ${t.also.map(esc).join(", ")}` : ""}. Look across the results below: what do they share?</p>
  </article>
  ${siblings.length ? `<div class="filters"><nav class="chips" aria-label="Other ${esc(role.name)} phrases"><div class="chips-track">${siblings.map(termLink).join("")}</div></nav></div>` : ""}
  <div class="toolbar-line"><p class="fine">${plural(n, "prompt")} with “${esc(t.t)}” marked</p>${densityControl()}</div>
  <div class="grid"></div>
</main>`;
  const grid = $(".grid", root);
  const mounted = mountGrid(grid, list, { initial: Number(ctx.state?.shown) || 0, opts: { word: t.t } });
  wireDensity(root, grid);
  document.title = `${t.t} · Words — PromptShare`;
  return { snapshot: () => ({ shown: mounted.shown }) };
}
