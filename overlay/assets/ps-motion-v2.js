/**
 * PromptShare motion layer v2 — bright playful motion.
 * IntersectionObserver fade-up / stagger, floating stickers,
 * springy hover helpers, prefers-reduced-motion + data-motion gate.
 * Additive only — does not touch React mounts.
 */
const REDUCED =
  window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
  document.documentElement.getAttribute("data-motion") === "off";

const REVEAL_SEL = [
  ".card-grid > .card",
  ".card-grid > a.card",
  ".featured-slot",
  ".prompt-panel",
  ".creation .stage",
  ".page-head",
  ".welcome-banner",
  ".empty-panel",
  ".creator-row",
  ".sheet",
  ".feature",
  ".frame",
].join(",");

function markReveals(root) {
  const nodes = root.querySelectorAll(REVEAL_SEL);
  let i = 0;
  nodes.forEach((el) => {
    if (el.dataset.psReveal === "1") return;
    el.dataset.psReveal = "1";
    el.classList.add("ps-reveal");
    el.classList.add(`ps-reveal-delay-${(i % 6) + 1}`);
    i += 1;
  });
}

function observeReveals() {
  if (REDUCED) {
    document.querySelectorAll(".ps-reveal").forEach((el) => el.classList.add("is-in"));
    return null;
  }
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-in");
          io.unobserve(entry.target);
        }
      }
    },
    { rootMargin: "0px 0px -5% 0px", threshold: 0.06 },
  );
  document.querySelectorAll(".ps-reveal:not(.is-in)").forEach((el) => io.observe(el));
  return io;
}

function injectStickers() {
  if (document.querySelector(".ps-stickers")) return;
  const wrap = document.createElement("div");
  wrap.className = "ps-stickers";
  wrap.setAttribute("aria-hidden", "true");
  if (REDUCED) {
    wrap.style.display = "none";
  }
  const kinds = ["sky", "pink", "apricot", "dot", "dot2"];
  for (const k of kinds) {
    const s = document.createElement("div");
    s.className = `ps-sticker ps-sticker--${k}`;
    wrap.appendChild(s);
  }
  document.body.appendChild(wrap);
}

function polishChips() {
  document.querySelectorAll(".chips, .chip-row").forEach((row) => {
    const on = row.querySelector(".chip.is-on");
    if (on && typeof on.scrollIntoView === "function") {
      try {
        on.scrollIntoView({
          inline: "center",
          block: "nearest",
          behavior: REDUCED ? "auto" : "smooth",
        });
      } catch (_) {
        /* ignore */
      }
    }
  });
}

function springHoverHelpers() {
  if (REDUCED || window.matchMedia("(pointer: coarse)").matches) return;
  // Light tilt on cards — CSS handles most; this adds a tiny pointer parallax on featured badges
  document.addEventListener(
    "pointermove",
    (e) => {
      const badge = e.target.closest?.(".card-flag, .featured-slot > .kicker");
      if (!badge) return;
      const r = badge.getBoundingClientRect();
      const dx = (e.clientX - (r.left + r.width / 2)) / 30;
      const dy = (e.clientY - (r.top + r.height / 2)) / 30;
      badge.style.transform = `translate(${dx}px, ${dy}px)`;
    },
    { passive: true },
  );
  document.addEventListener(
    "pointerleave",
    (e) => {
      const badge = e.target.closest?.(".card-flag, .featured-slot > .kicker");
      if (badge) badge.style.transform = "";
    },
    true,
  );
}

function pageLoadPulse() {
  if (REDUCED) return;
  document.documentElement.classList.add("ps-booted");
  // Ensure first paint hero fades in even if already in view
  requestAnimationFrame(() => {
    document.querySelectorAll(".page-head.ps-reveal").forEach((el) => {
      el.classList.add("is-in");
    });
  });
}

function boot() {
  document.documentElement.classList.add("ps-redesign-v2");
  document.documentElement.classList.remove("ps-redesign");
  if (REDUCED) {
    document.documentElement.setAttribute("data-motion", "off");
  }

  injectStickers();
  markReveals(document);
  let io = observeReveals();
  polishChips();
  springHoverHelpers();
  pageLoadPulse();

  const mo = new MutationObserver(() => {
    markReveals(document);
    if (io) {
      document.querySelectorAll(".ps-reveal:not(.is-in)").forEach((el) => io.observe(el));
    } else if (REDUCED) {
      document.querySelectorAll(".ps-reveal").forEach((el) => el.classList.add("is-in"));
    }
    polishChips();
  });
  mo.observe(document.getElementById("root") || document.body, {
    childList: true,
    subtree: true,
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot, { once: true });
} else {
  boot();
}
