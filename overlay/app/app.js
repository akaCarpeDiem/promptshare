// Entry point. Every page loads this: it wires the header, and on gallery pages it runs the
// views (home, images, videos, search, words, plate) with in-page navigation between them.
import { load } from "./data.js";
import { initTheme, $, $$, reducedMotion } from "./ui.js";
import "./card.js";
import "./carousel.js";

const root = $("#root");
const html = document.documentElement;

/* ----------------------------------------------------------------- header */

initTheme();

function markNav(pathname, kind = "") {
  const here = kind === "video" ? "/videos/" : kind === "image" ? "/images/" : pathname;
  $$(".nav a").forEach((a) => {
    const on = here.startsWith(new URL(a.href).pathname);
    if (on) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
}
markNav(location.pathname);

const searchInput = $(".search input");
// The field is narrow on a phone; a shorter hint fits.
const narrow = matchMedia("(max-width: 760px)");
const hint = () => searchInput && (searchInput.placeholder = narrow.matches ? "Search" : "Search prompts");
narrow.addEventListener("change", hint);
hint();
addEventListener("keydown", (e) => {
  if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName) || document.activeElement?.isContentEditable) return;
  e.preventDefault();
  searchInput?.focus();
  searchInput?.select();
});

/* ------------------------------------------------------------- game pages */

if (document.body.dataset.page === "game" || document.body.dataset.page === "games") import("./game.js");

/* ------------------------------------------------------------------ views */

if (root && document.body.dataset.shell === "app") startApp();

async function startApp() {
  const [{ browse, search, words }, { plate }, { home, panels }] = await Promise.all([
    import("./views/browse.js"),
    import("./views/plate.js"),
    import("./views/home.js"),
  ]);
  const defaultHome = html.dataset.home === "panels" ? panels : home;
  const ROUTES = [
    [/^\/$/, defaultHome],
    [/^\/start\/?$/, home],
    [/^\/panels\/?$/, panels],
    [/^\/images\/?$/, browse("image")],
    [/^\/videos\/?$/, browse("video")],
    [/^\/search\/?$/, search],
    [/^\/words\/?$/, words],
    [/^\/p\/([^/]+)\/?$/, plate],
  ];
  const match = (url) => {
    for (const [re, view] of ROUTES) {
      const m = re.exec(url.pathname);
      if (m) return { view, params: m.slice(1).map(decodeURIComponent) };
    }
    return null;
  };

  history.scrollRestoration = "manual";
  let current = null; // what the live view returned: { destroy?, snapshot? }
  let currentView = null;
  let currentPlate = "";
  const save = () => history.replaceState({ ...(history.state || {}), y: scrollY, ...(current?.snapshot?.() || {}) }, "");

  async function show(url, { state = null, fromCard = null, back = false, instant = false } = {}) {
    const hit = match(url);
    if (!hit) return void location.assign(url);
    let db;
    try {
      db = await load();
    } catch {
      root.innerHTML = `<main class="wrap" id="main"><div class="status"><p class="h2">The gallery didn't load</p><p>Check your connection, then <a href="${location.pathname}">try again</a>.</p></div></main>`;
      return;
    }
    const leaving = currentPlate;
    const named = [];
    const update = () => {
      current?.destroy?.();
      // Each view gets a fresh element, so the listeners it adds go away with it.
      const stage = document.createElement("div");
      stage.className = "view";
      root.replaceChildren(stage);
      current = hit.view(stage, { url, params: hit.params, state, go }) || null;
      currentView = hit.view;
      currentPlate = hit.view === plate ? hit.params[0] : "";
      const kind = currentPlate ? db.byId.get(currentPlate)?.mediaKind : "";
      markNav(url.pathname, kind);
      document.body.classList.toggle("panels-page", hit.view === panels);
      scrollTo(0, state?.y || 0);
      // Going back to a grid: the picture flies home to its card.
      if (back && leaving && !currentPlate) {
        const img = root.querySelector(`.card[data-id="${CSS.escape(leaving)}"] img`);
        if (img) { img.style.viewTransitionName = "plate-media"; named.push(img); }
      }
    };
    const animate = !instant && document.startViewTransition && !reducedMotion();
    if (!animate) return void update();
    // Opening a plate from a grid: its thumbnail grows into the big picture.
    if (fromCard && !leaving) { fromCard.style.viewTransitionName = "plate-media"; named.push(fromCard); }
    const t = document.startViewTransition(update);
    t.finished.catch(() => {}).finally(() => named.forEach((el) => (el.style.viewTransitionName = "")));
    await t.updateCallbackDone.catch(() => {});
  }

  /** Navigate inside the app. `replace` swaps the current history entry (used when stepping plate to plate). */
  function go(href, { replace = false, fromCard = null } = {}) {
    const url = new URL(href, location.href);
    if (url.origin !== location.origin || !match(url)) return void location.assign(url);
    save();
    if (replace) history.replaceState({}, "", url);
    else history.pushState({}, "", url);
    return show(url, { fromCard });
  }

  addEventListener("popstate", () => show(new URL(location.href), { state: history.state, back: true }));
  addEventListener("pagehide", save);

  document.addEventListener("click", (e) => {
    if (e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest?.("a[href]");
    if (!a || a.target || a.hasAttribute("download")) return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin || !match(url)) return;
    if (url.pathname === location.pathname && url.search === location.search && url.hash) return;
    e.preventDefault();
    const card = a.closest(".card[data-id]");
    if (card) {
      // Remember the list this card sits in, so the plate knows its neighbours.
      const ids = card.closest(".grid, .rail")?._ids;
      try { if (ids) sessionStorage.setItem("ps-ctx", JSON.stringify(ids)); } catch {}
    }
    go(url, { replace: a.hasAttribute("data-step"), fromCard: card?.querySelector(".card-media img") || null });
  });

  /* Search: Enter goes to results; on the results page it updates as you type. */
  const form = $(".search");
  form?.addEventListener("submit", (e) => {
    e.preventDefault();
    const q = searchInput.value.trim();
    go(`/search/${q ? "?q=" + encodeURIComponent(q) : ""}`);
  });
  let typing = 0;
  searchInput?.addEventListener("input", () => {
    if (currentView !== search) return;
    clearTimeout(typing);
    typing = setTimeout(() => {
      const q = searchInput.value.trim();
      const url = new URL(`/search/${q ? "?q=" + encodeURIComponent(q) : ""}`, location.href);
      history.replaceState({}, "", url);
      show(url, { instant: true });
    }, 180);
  });

  await show(new URL(location.href), { state: history.state, instant: true });
  root.dataset.ready = "1";
}
