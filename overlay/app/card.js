// Cards and the grids they sit in.
import { renderPrompt, hasTerm } from "./marks.js";
import { thumbOf, previewOf } from "./data.js";
import { esc, icon } from "./ui.js";

/** Trim the start of a long prompt so a given glossary phrase is visible inside a three-line card. */
function excerpt(segments, termText) {
  const at = segments.findIndex((s) => hasTerm(s, termText));
  if (at < 1) return segments;
  let before = 0;
  for (let i = 0; i < at; i++) before += segments[i].text.length;
  if (before <= 90) return segments;
  const out = segments.slice(at);
  let room = 60;
  for (let i = at - 1; i >= 0 && room > 0; i--) {
    const s = segments[i];
    if (s.text.length <= room) { out.unshift(s); room -= s.text.length; continue; }
    if (!s.role) {
      const cut = s.text.slice(-room).replace(/^\S*\s/, "");
      out.unshift({ text: cut });
    }
    break;
  }
  out.unshift({ text: "… " });
  return out;
}

export function plateCard(p, { highlight = "", word = "", heading = "h3" } = {}) {
  const segments = word ? excerpt(p.segments, word) : p.segments;
  const video = p.mediaKind === "video";
  return `<a class="card" href="/p/${encodeURIComponent(p.id)}" data-id="${esc(p.id)}"${video ? ` data-preview="${esc(previewOf(p))}" data-master="${esc(p.mediaUrl)}"` : ""}>
  <div class="card-media"><img src="${esc(thumbOf(p))}" data-full="${esc(video ? p.poster || "" : p.mediaUrl)}" alt="${esc(p.title)}" width="${p.thumbWidth || 640}" height="${p.thumbHeight || 360}" loading="lazy" decoding="async">${video ? `<span class="card-kind">${icon.play}Video</span>` : ""}</div>
  <div class="card-body">
    <div class="card-head"><${heading} class="card-title">${highlight ? renderPrompt([{ text: p.title }], { highlight }) : esc(p.title)}</${heading}><span class="card-model">${esc(p.displayModel || "")}</span></div>
    <p class="prompt">${renderPrompt(segments, { highlight, emphasize: word })}</p>
  </div>
</a>`;
}

export function gameCard(g, { heading = "h3" } = {}) {
  return `<a class="card game-card" href="/games/${esc(g.slug)}/" data-diff="${esc(g.diff)}">
  <div class="card-media"><img src="${esc(g.poster)}" alt="" width="640" height="480" loading="lazy" decoding="async"><span class="card-kind">${icon.play}Play</span></div>
  <div class="card-body">
    <div class="card-head"><${heading} class="card-title">${esc(g.title)}</${heading}><span class="diff" data-diff="${esc(g.diff)}">${esc(g.label)}</span></div>
    <p class="prompt">${esc(g.prompt)}</p>
  </div>
</a>`;
}

/**
 * Fill a container with cards a batch at a time; more load as the end comes into view.
 * The ids are kept on the element so a plate opened from here knows its neighbours.
 */
export function mountGrid(el, list, { batch = 36, initial = 0, card = plateCard, opts = {} } = {}) {
  let shown = 0;
  el._ids = list.map((p) => p.id);
  el.innerHTML = "";
  const sentinel = document.createElement("div");
  sentinel.style.cssText = "grid-column:1/-1;height:1px";
  const add = (n) => {
    const next = list.slice(shown, shown + n);
    if (!next.length) return;
    sentinel.insertAdjacentHTML("beforebegin", next.map((p) => card(p, opts)).join(""));
    shown += next.length;
    el.dataset.shown = String(shown);
    if (shown >= list.length) { io.disconnect(); sentinel.remove(); }
  };
  const io = new IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting)) add(batch); }, { rootMargin: "900px 0px" });
  el.append(sentinel);
  add(Math.max(batch, initial));
  if (shown < list.length) io.observe(sentinel);
  return { get shown() { return shown; }, destroy: () => io.disconnect() };
}

/* Video cards play a light preview while pointed at. One at a time, mouse only. */
let playing = null;
function stopPreview() {
  if (!playing) return;
  playing.video.remove();
  playing = null;
}
document.addEventListener("pointerover", (e) => {
  if (e.pointerType !== "mouse") return;
  const card = e.target.closest?.(".card[data-preview]");
  if (!card || playing?.card === card) return;
  stopPreview();
  const video = document.createElement("video");
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = card.dataset.preview;
  video.addEventListener("error", () => { if (video.src.includes("/video-preview/")) video.src = card.dataset.master; }, { once: true });
  video.addEventListener("playing", () => video.classList.add("is-playing"), { once: true });
  card.querySelector(".card-media").append(video);
  video.play().catch(() => {});
  playing = { card, video };
});
document.addEventListener("pointerout", (e) => {
  if (!playing) return;
  if (!e.relatedTarget || !playing.card.contains(e.relatedTarget)) stopPreview();
});
// A missing browse thumbnail falls back to the full picture instead of a broken image.
document.addEventListener("error", (e) => {
  const img = e.target;
  if (img?.tagName !== "IMG" || !img.dataset.full || img.dataset.fellBack) return;
  img.dataset.fellBack = "1";
  img.src = img.dataset.full;
}, true);
