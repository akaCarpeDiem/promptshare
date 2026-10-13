// One output with its prompt: the page the whole site exists for.
import { db, related, previewOf } from "../data.js";
import { CATEGORY, ROLES, ROLE } from "../roles.js";
import { renderPrompt } from "../marks.js";
import { plateCard } from "../card.js";
import { esc, icon, copy, pop, closePop, $, $$ } from "../ui.js";

const QUALITY_KEY = "ps-video-quality"; // same key the previous player used, so a visitor's choice carries over
const quality = () => { try { return localStorage.getItem(QUALITY_KEY) === "1080" ? "1080" : "720"; } catch { return "720"; } };

/** The list this plate was opened from (a filtered grid), or its category if it was opened directly. */
function neighbours(plate) {
  let ids = [];
  try { ids = JSON.parse(sessionStorage.getItem("ps-ctx") || "[]"); } catch {}
  if (!ids.includes(plate.id)) {
    ids = db.plates.filter((p) => p.mediaKind === plate.mediaKind && (!plate.category || p.category === plate.category)).map((p) => p.id);
  }
  const at = ids.indexOf(plate.id);
  return { prev: db.byId.get(ids[at - 1]), next: db.byId.get(ids[at + 1]), at, total: ids.length };
}

function mediaHtml(p) {
  if (p.mediaKind !== "video") return `<img src="${esc(p.mediaUrl)}" alt="${esc(p.title)}" width="1280" height="720" decoding="async" fetchpriority="high">`;
  const src = quality() === "1080" ? p.mediaUrl : previewOf(p);
  return `<video src="${esc(src)}" data-master="${esc(p.mediaUrl)}" data-preview="${esc(previewOf(p))}" poster="${esc(p.poster || "")}" controls loop muted autoplay playsinline preload="auto" width="1280" height="720"></video>`;
}

export function plate(root, ctx) {
  const p = db.byId.get(ctx.params[0]);
  if (!p) {
    root.innerHTML = `<main class="wrap" id="main" tabindex="-1"><div class="status"><h1 class="h2">This plate isn't available</h1><p>It may have been removed. <a href="/images/">Browse images</a> or <a href="/videos/">videos</a>.</p></div></main>`;
    document.title = "Not found — PromptShare";
    return;
  }
  const video = p.mediaKind === "video";
  const home = video ? "/videos/" : "/images/";
  const { prev, next, at, total } = neighbours(p);
  const marks = p.segments.filter((s) => s.role);
  const rolesUsed = ROLES.filter((r) => marks.some((m) => m.role === r.id));
  const cat = CATEGORY[p.category];
  const more = related(p, 8);

  const noteItem = (m) => {
    const role = ROLE[m.role];
    if (m.note) {
      // Glossary phrases inside this noted phrase link on to their Words page.
      const also = (m.terms || []).map((t) => `<a class="term" data-role="${t.role}" href="/words/?w=${encodeURIComponent(t.t)}">${esc(t.t)}</a>`).join("");
      return `<li><div class="note" data-role="${m.role}" data-n="${m.n}" data-jump>
        <span><span class="note-kind">${esc(role.name)}</span><span class="note-phrase">${esc(m.text)}</span><span class="note-means">${esc(m.note.means)}</span>${also ? `<span class="note-also"><span class="fine">In the word list</span>${also}</span>` : ""}</span></div></li>`;
    }
    const uses = db.words.get(m.term.t)?.plates.length || 0;
    return `<li><a class="note" data-role="${m.role}" data-n="${m.n}" href="/words/?w=${encodeURIComponent(m.term.t)}">
        <span><span class="note-kind">${esc(role.name)}</span><span class="note-phrase">${esc(m.text)}</span><span class="note-means">${esc(m.term.means)}</span>${uses > 1 ? `<span class="note-more">Compare ${uses} prompts that use it</span>` : ""}</span></a></li>`;
  };
  // A phrase that appears twice in one prompt is explained once.
  const seen = new Set();
  const listed = marks.filter((m) => {
    const key = m.note ? "n:" + m.n : "t:" + m.term.t;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const written = listed.filter((m) => m.note).length;

  root.innerHTML = `<main class="wrap" id="main" tabindex="-1">
  <nav class="crumbs" aria-label="Where you are">
    <a href="${home}">${video ? "Videos" : "Images"}</a>
    ${cat ? `${icon.chevron}<a href="${home}?tag=${cat.slug}">${esc(cat.label)}</a>` : ""}
    <span class="step">
      <span class="fine num" style="align-self:center;margin-right:6px">${at + 1} of ${total}</span>
      <a class="btn step-btn" ${prev ? `href="/p/${encodeURIComponent(prev.id)}" data-step` : 'aria-disabled="true"'} aria-label="Previous" title="Previous (←)">${icon.left}</a>
      <a class="btn step-btn" ${next ? `href="/p/${encodeURIComponent(next.id)}" data-step` : 'aria-disabled="true"'} aria-label="Next" title="Next (→)">${icon.right}</a>
    </span>
  </nav>
  <article class="plate">
    <div class="stage">
      <figure class="stage-media">${mediaHtml(p)}</figure>
      <div class="stage-tools">
        ${video ? `<div class="seg" role="group" aria-label="Video quality"><button type="button" data-q="720" aria-pressed="${quality() === "720"}">720p</button><button type="button" data-q="1080" aria-pressed="${quality() === "1080"}">1080p</button></div>` : `<span class="fine">AI-generated image</span>`}
        <button type="button" class="btn btn-quiet btn-sm" data-full>${icon.expand}Full screen</button>
      </div>
    </div>
    <div class="reading">
      <h1 class="h1">${esc(p.title)}</h1>
      <p class="facts">
        <span class="tag">${esc(p.displayModel)}</span>
        ${cat ? `<a class="tag" href="${home}?tag=${cat.slug}">${esc(cat.label)}</a>` : ""}
        <span class="tag">${video ? "Video" : "Image"}</span>
      </p>
      <section class="panel" aria-label="The prompt">
        <div class="panel-head"><h2>The prompt</h2><button type="button" class="btn btn-solid btn-sm" data-copy-prompt>${icon.copy}Copy prompt</button></div>
        <p class="prompt" id="prompt">${renderPrompt(p.segments, { interactive: true })}</p>
        ${rolesUsed.length ? `<ul class="legend">${rolesUsed.map((r) => `<li data-role="${r.id}"><i></i>${esc(r.name)}</li>`).join("")}</ul>` : ""}
      </section>
      ${listed.length ? `<section class="notes">
        <h2 class="h2">What each part does</h2>
        <p class="fine">${written ? "Notes are PromptShare's reading of this prompt, not the creator's commentary." : "These are general notes on common prompt phrases, not a study of this picture."}</p>
        <ol>${listed.map(noteItem).join("")}</ol>
      </section>` : ""}
      <div class="plate-actions">
        <button type="button" class="btn" data-copy-link>${icon.link}Copy link</button>
      </div>
      <p class="fine disclaimer">A study pair: this file, this prompt. Outputs can be fictional or stylised, and running the same prompt again will not give the same result.</p>
    </div>
  </article>
  ${more.length ? `<section class="related"><div class="row-head"><h2 class="h2">More ${cat ? "in " + esc(cat.label) : "like this"}</h2>${cat ? `<a href="${home}?tag=${cat.slug}">See all</a>` : ""}</div><div class="grid">${more.map((m) => plateCard(m)).join("")}</div></section>` : ""}
</main>`;
  $(".related .grid", root) && ($(".related .grid", root)._ids = more.map((m) => m.id));
  document.title = `${p.title} — PromptShare`;

  /* Marks and notes point at each other. */
  const prompt = $("#prompt", root);
  const focus = (n, on) => {
    prompt.classList.toggle("is-focusing", on);
    $$(`[data-n="${n}"]`, root).forEach((el) => el.classList.toggle("is-on", on));
  };
  root.addEventListener("pointerover", (e) => { const el = e.target.closest?.("[data-n]"); if (el) focus(el.dataset.n, true); });
  root.addEventListener("pointerout", (e) => { const el = e.target.closest?.("[data-n]"); if (el && !el.contains(e.relatedTarget)) focus(el.dataset.n, false); });
  root.addEventListener("focusin", (e) => { const el = e.target.closest?.("[data-n]"); if (el) focus(el.dataset.n, true); });
  root.addEventListener("focusout", (e) => { const el = e.target.closest?.("[data-n]"); if (el) focus(el.dataset.n, false); });

  // Marks are spans with role="button", so Enter and Space have to be wired by hand.
  root.addEventListener("keydown", (e) => {
    if ((e.key === "Enter" || e.key === " ") && e.target.matches?.("#prompt .mk")) { e.preventDefault(); e.target.click(); }
  });
  root.addEventListener("click", (e) => {
    const mark = e.target.closest?.("#prompt .mk");
    if (mark) {
      const m = marks.find((x) => String(x.n) === mark.dataset.n);
      const role = ROLE[m.role];
      const uses = m.term ? db.words.get(m.term.t)?.plates.length || 0 : 0;
      const inner = (m.terms || []).map((t) => `<a class="term" data-role="${t.role}" href="/words/?w=${encodeURIComponent(t.t)}">${esc(t.t)}</a>`).join("");
      pop(mark, `<b>${esc(role.name)}</b><strong>${esc(m.text)}</strong><p>${esc(m.note ? m.note.means : m.term.means)}</p>${m.term && uses > 1 ? `<a href="/words/?w=${encodeURIComponent(m.term.t)}">Compare ${uses} prompts that use it</a>` : ""}${inner ? `<span class="note-also">${inner}</span>` : ""}`, m.role);
      return;
    }
    const jump = e.target.closest?.(".note[data-jump]");
    if (jump && !e.target.closest("a")) {
      // On a phone the prompt may have scrolled away: bring the phrase this note is about back into view.
      $(`#prompt [data-n="${jump.dataset.n}"]`, root)?.scrollIntoView({ block: "center", behavior: "smooth" });
      return;
    }
    if (e.target.closest?.("[data-copy-prompt]")) return void copy(p.prompt, "Prompt copied");
    if (e.target.closest?.("[data-copy-link]")) return void copy(`${location.origin}/p/${encodeURIComponent(p.id)}`, "Link copied");
    if (e.target.closest?.("[data-full]")) {
      const el = $(".stage-media", root);
      const media = el.querySelector("video, img");
      (el.requestFullscreen || media.webkitEnterFullscreen || (() => {})).call(el.requestFullscreen ? el : media);
      return;
    }
    const q = e.target.closest?.("[data-q]");
    if (q) {
      const v = $("video", root);
      if (!v) return;
      try { localStorage.setItem(QUALITY_KEY, q.dataset.q); } catch {}
      $$("[data-q]", root).forEach((b) => b.setAttribute("aria-pressed", String(b === q)));
      const want = q.dataset.q === "1080" ? v.dataset.master : v.dataset.preview;
      if (!v.src.endsWith(want)) {
        const t = v.currentTime;
        const paused = v.paused;
        v.src = want;
        v.addEventListener("loadedmetadata", () => { v.currentTime = t; if (!paused) v.play().catch(() => {}); }, { once: true });
      }
    }
  });

  // Most pictures are 16:9. One that isn't gets a frame of its own shape instead of black bars.
  const img = $(".stage-media img", root);
  const fit = () => { if (img.naturalWidth) img.style.setProperty("--ar", `${img.naturalWidth} / ${img.naturalHeight}`); };
  if (img) img.complete ? fit() : img.addEventListener("load", fit, { once: true });

  // If the lighter copy of a clip is missing, play the full one.
  const v = $("video", root);
  v?.addEventListener("error", () => { if (v.src.includes("/video-preview/")) v.src = v.dataset.master; }, { once: true });

  /* Keyboard and swipe step through the list the plate was opened from. */
  const step = (to) => { if (to) ctx.go(`/p/${encodeURIComponent(to.id)}`, { replace: true, step: true }); };
  const onKey = (e) => {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName)) return;
    if (document.activeElement?.tagName === "VIDEO") return;
    if (e.key === "ArrowLeft") step(prev);
    if (e.key === "ArrowRight") step(next);
  };
  addEventListener("keydown", onKey);
  let sx = 0, sy = 0;
  const stage = $(".stage-media", root);
  stage.addEventListener("touchstart", (e) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
  stage.addEventListener("touchend", (e) => {
    const dx = e.changedTouches[0].clientX - sx;
    const dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.6) step(dx < 0 ? next : prev);
  }, { passive: true });

  // Warm the neighbours so stepping is instant.
  for (const n of [next, prev]) if (n) { const img = new Image(); img.src = n.mediaKind === "video" ? n.poster || "" : n.mediaUrl; }

  return { destroy: () => { removeEventListener("keydown", onKey); closePop(); } };
}
