// Games index (difficulty filter) and game pages (leaderboard, player name, prompt notes).
// The game itself runs in an iframe from /games/play/ and reports scores by postMessage.
import { $, $$, esc, copy } from "./ui.js";

/* ---- index: filter by difficulty ---- */
const seg = $("[data-diff-filter]");
if (seg) {
  const apply = (diff) => {
    $$("button", seg).forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.diff === diff)));
    $$(".game-card").forEach((c) => (c.hidden = !!diff && c.dataset.diff !== diff));
    const url = new URL(location.href);
    if (diff) url.searchParams.set("diff", diff);
    else url.searchParams.delete("diff");
    history.replaceState(null, "", url.pathname + url.search);
  };
  seg.addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) apply(b.dataset.diff); });
  const initial = new URLSearchParams(location.search).get("diff") || "";
  apply(["simple", "mid", "advanced"].includes(initial) ? initial : "");
}

/* ---- game page ---- */
const stage = $("[data-game]");
if (stage) {
  const slug = stage.dataset.game;
  const list = $("#ps-board");
  const empty = $("#ps-score-empty");
  const who = $("#ps-who");

  const paintBoard = (rows) => {
    list.innerHTML = "";
    empty.hidden = rows.length > 0;
    const mine = window.psPlayer?.id?.();
    for (const row of rows) {
      const li = document.createElement("li");
      if (row.pid && mine && row.pid === mine) li.className = "is-mine";
      li.innerHTML = `<span class="nm">${esc(row.name || "Guest")}</span><span class="sc">${esc(row.score)}</span>`;
      list.append(li);
    }
  };
  const loadBoard = () =>
    fetch(`/api/games/${encodeURIComponent(slug)}/scores`, { credentials: "same-origin", cache: "no-store" })
      .then((r) => r.json())
      .then((d) => paintBoard((d && d.top) || []))
      .catch(() => paintBoard([]));

  // The name chip and rename dialog come from the same script the game frame uses.
  const paintWho = () => { if (who && window.psPlayer) window.psPlayer.chip(who); };
  const s = document.createElement("script");
  s.src = "/games/play/ps-score.js?v=20261007id1";
  s.addEventListener("load", () => { paintWho(); loadBoard(); });
  document.head.append(s);

  addEventListener("message", (e) => {
    if (e.origin !== location.origin) return;
    const d = e.data || {};
    if (d.type === "ps-name") { paintWho(); loadBoard(); }
    if (d.type === "ps-score" && d.game === slug) loadBoard();
  });
  addEventListener("ps:name", () => { paintWho(); loadBoard(); });
  loadBoard();

  /* Marks in the prompt and the notes under it point at each other. */
  const prompt = $("#prompt");
  const focus = (n, on) => {
    prompt?.classList.toggle("is-focusing", on);
    $$(`[data-n="${n}"]`).forEach((el) => el.classList.toggle("is-on", on));
  };
  document.addEventListener("pointerover", (e) => { const el = e.target.closest?.("[data-n]"); if (el) focus(el.dataset.n, true); });
  document.addEventListener("pointerout", (e) => { const el = e.target.closest?.("[data-n]"); if (el && !el.contains(e.relatedTarget)) focus(el.dataset.n, false); });
  document.addEventListener("focusin", (e) => { const el = e.target.closest?.("[data-n]"); if (el) focus(el.dataset.n, true); });
  document.addEventListener("focusout", (e) => { const el = e.target.closest?.("[data-n]"); if (el) focus(el.dataset.n, false); });
  document.addEventListener("click", (e) => {
    if (e.target.closest?.("[data-copy-prompt]")) copy(prompt.textContent, "Prompt copied");
    if (e.target.closest?.("[data-full]")) {
      const frame = $(".game-frame");
      frame.requestFullscreen?.();
    }
    const mark = e.target.closest?.("#prompt .mk");
    if (mark) $(`.note[data-n="${mark.dataset.n}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" });
  });
}
