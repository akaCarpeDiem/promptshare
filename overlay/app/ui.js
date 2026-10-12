// Small shared pieces: escaping, icons, toast, clipboard, theme.
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export const fmt = (n) => Number(n).toLocaleString("en-US");
export const plural = (n, one, many = one + "s") => `${fmt(n)} ${n === 1 ? one : many}`;
export const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

const svg = (body, vb = "0 0 24 24") => `<svg viewBox="${vb}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
export const icon = {
  left: svg('<path d="M15 5l-7 7 7 7"/>'),
  right: svg('<path d="M9 5l7 7-7 7"/>'),
  chevron: svg('<path d="M4.5 2.5 8 6l-3.5 3.5"/>', "0 0 12 12"),
  copy: svg('<rect x="9" y="9" width="11" height="11" rx="2.5"/><path d="M5 15V6.5A2.5 2.5 0 0 1 7.5 4H15"/>'),
  link: svg('<path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1"/>'),
  flag: svg('<path d="M5 21V4"/><path d="M5 4h11l-2 4 2 4H5"/>'),
  play: `<svg viewBox="0 0 12 12" fill="currentColor" aria-hidden="true"><path d="M3 1.6v8.8a.6.6 0 0 0 .9.5l7-4.4a.6.6 0 0 0 0-1L3.9 1.1a.6.6 0 0 0-.9.5z"/></svg>`,
  expand: svg('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'),
};

let toastTimer = 0;
export function toast(message) {
  $(".toast")?.remove();
  const el = document.createElement("div");
  el.className = "toast";
  el.setAttribute("role", "status");
  el.textContent = message;
  document.body.append(el);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.remove(), 2200);
}

export async function copy(text, done) {
  try {
    await navigator.clipboard.writeText(text);
    toast(done);
  } catch {
    toast("Couldn't copy. Select the text and copy it by hand.");
  }
}

/** Theme: follows the device until the visitor picks one; the choice is remembered. */
export function initTheme() {
  const root = document.documentElement;
  const btn = $(".theme-btn");
  if (!btn) return;
  const systemDark = () => matchMedia("(prefers-color-scheme: dark)").matches;
  const current = () => root.dataset.theme || (systemDark() ? "dark" : "light");
  const label = () => {
    const next = current() === "dark" ? "light" : "dark";
    btn.setAttribute("aria-label", `Switch to ${next} mode`);
    btn.title = `Switch to ${next} mode`;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", current() === "dark" ? "#0c0e12" : "#f2f3f5");
  };
  btn.addEventListener("click", () => {
    const next = current() === "dark" ? "light" : "dark";
    if (next === (systemDark() ? "dark" : "light")) delete root.dataset.theme;
    else root.dataset.theme = next;
    try {
      if (root.dataset.theme) localStorage.setItem("ps-theme", root.dataset.theme);
      else localStorage.removeItem("ps-theme");
    } catch {}
    label();
  });
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", label);
  label();
}

/** A small card anchored to an element; closes on outside click, Escape or scroll. */
let popEl = null;
export function closePop() {
  popEl?.remove();
  popEl = null;
}
export function pop(anchor, html, role) {
  closePop();
  popEl = document.createElement("div");
  popEl.className = "pop";
  if (role) popEl.dataset.role = role;
  popEl.setAttribute("role", "dialog");
  popEl.innerHTML = html;
  document.body.append(popEl);
  const a = anchor.getBoundingClientRect();
  const p = popEl.getBoundingClientRect();
  const left = Math.max(12, Math.min(a.left, innerWidth - p.width - 12));
  const below = a.bottom + 8 + p.height < innerHeight || a.top < p.height + 16;
  popEl.style.left = `${left}px`;
  popEl.style.top = `${below ? a.bottom + 8 : a.top - p.height - 8}px`;
  return popEl;
}
addEventListener("pointerdown", (e) => { if (popEl && !popEl.contains(e.target) && !e.target.closest?.(".mk")) closePop(); });
addEventListener("keydown", (e) => { if (e.key === "Escape") closePop(); });
addEventListener("scroll", () => closePop(), { passive: true });
