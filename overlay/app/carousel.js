// Category rows on Images and Videos (<nav class="chips carousel">): left/right arrow buttons in their
// own slots beside the row (never over a chip) that only show when the row can scroll that way, and a vertical mouse wheel that moves the row sideways
// while hovering it. Trackpad sideways scroll and touch swipe are left to the browser.
const STEP = 0.8; // an arrow click moves this share of the visible width

function update(nav) {
  const track = nav.querySelector(".chips-track");
  if (!track) return;
  const max = track.scrollWidth - track.clientWidth;
  nav.classList.toggle("has-overflow", max > 1);
  nav.classList.toggle("can-left", max > 1 && track.scrollLeft > 1);
  nav.classList.toggle("can-right", track.scrollLeft < max - 1);
}

function arrow(dir) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = `chips-arrow chips-arrow-${dir}`;
  b.dataset.dir = dir;
  b.setAttribute("aria-label", dir === "left" ? "Scroll categories left" : "Scroll categories right");
  b.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="${dir === "left" ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"}" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  return b;
}

const ro = typeof ResizeObserver === "function" ? new ResizeObserver((es) => es.forEach((e) => update(e.target.closest(".carousel")))) : null;

function enhance(nav) {
  if (nav.dataset.carousel) return;
  const track = nav.querySelector(".chips-track");
  if (!track) return;
  nav.dataset.carousel = "1";
  nav.prepend(arrow("left"));
  nav.append(arrow("right"));
  nav.addEventListener("click", (e) => {
    const b = e.target.closest(".chips-arrow");
    if (!b) return;
    const d = track.clientWidth * STEP * (b.dataset.dir === "left" ? -1 : 1);
    track.scrollBy({ left: d, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  });
  track.addEventListener("scroll", () => update(nav), { passive: true });
  track.addEventListener("wheel", (e) => {
    if (e.ctrlKey) return; // pinch zoom
    // Mostly-horizontal input (trackpad, tilt wheel) already scrolls the row natively.
    if (Math.abs(e.deltaX) >= Math.abs(e.deltaY)) return;
    const max = track.scrollWidth - track.clientWidth;
    if (max <= 0) return;
    let dy = e.deltaY;
    if (e.deltaMode === 1) dy *= 16; else if (e.deltaMode === 2) dy *= track.clientWidth;
    if ((dy < 0 && track.scrollLeft <= 0) || (dy > 0 && track.scrollLeft >= max - 1)) return; // at the end: let the page scroll
    e.preventDefault();
    track.scrollLeft = Math.max(0, Math.min(max, track.scrollLeft + dy));
  }, { passive: false });
  ro?.observe(track);
  update(nav);
}

function scan(root = document) {
  root.querySelectorAll?.("nav.carousel").forEach(enhance);
}

scan();
new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) if (n.nodeType === 1) { if (n.matches?.("nav.carousel")) enhance(n); else scan(n); } })
  .observe(document.documentElement, { childList: true, subtree: true });
addEventListener("load", () => document.querySelectorAll("nav.carousel").forEach(update));
