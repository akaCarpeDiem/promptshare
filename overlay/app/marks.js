// Turns a prompt into segments: plain text, and marked phrases with a role.
//
// Two sources of marks:
//   notes   — written for one plate: this phrase, in this prompt, did this.
//   lexicon — the site-wide glossary: a known phrase and what it usually does.
// A plate's own notes win where the two overlap.
import { roleOf } from "./roles.js";

const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const fold = (s) => s.toLowerCase().replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/[‐‑–—]/g, "-");

/** Build a matcher for the glossary once; it finds every term in one pass over a prompt. */
export function compileLexicon(lexicon) {
  const byForm = new Map();
  for (const term of lexicon) {
    for (const form of [term.t, ...(term.also || [])]) byForm.set(fold(form), term);
  }
  const forms = [...byForm.keys()].sort((a, b) => b.length - a.length).map((f) => escRe(f).replace(/ /g, "[\\s-]+"));
  const re = forms.length ? new RegExp(`(?<![\\p{L}\\p{N}])(?:${forms.join("|")})(?![\\p{L}\\p{N}])`, "giu") : null;
  return {
    find(prompt) {
      if (!re) return [];
      const out = [];
      const folded = fold(prompt);
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(folded))) {
        const term = byForm.get(m[0].replace(/[\s-]+/g, " ")) || byForm.get(m[0]);
        if (!term) continue;
        // Some words have a second, unrelated sense ("wide river", "snow leopard", "overhead lamps").
        // A term can list what must not follow or precede it for the match to count.
        const after = folded.slice(m.index + m[0].length).trimStart();
        const before = folded.slice(0, m.index).trimEnd();
        if (term.notBefore?.some((w) => after.startsWith(w)) || term.notAfter?.some((w) => before.endsWith(w))) continue;
        out.push({ start: m.index, end: m.index + m[0].length, role: term.role, term });
      }
      return out;
    },
  };
}

function findNote(folded, phrase, from) {
  const needle = fold(phrase).trim().replace(/[\s,.;:]+$/, "");
  if (needle.length < 2) return null;
  let at = folded.indexOf(needle, from);
  if (at < 0) at = folded.indexOf(needle);
  return at < 0 ? null : { start: at, end: at + needle.length };
}

/**
 * @returns {{text:string, role?:string, note?:object, term?:object, terms?:object[], n?:number}[]}
 *   Segments in reading order. `n` numbers the marks so a list beside the prompt can point at them.
 *   A mark is either a plate note (`note`, plus `terms`: glossary phrases found inside it) or a
 *   glossary phrase on its own (`term`).
 */
export function segment(prompt, notes = [], matcher = null) {
  const folded = fold(prompt);
  const spans = [];
  let cursor = 0;
  for (const note of notes) {
    const hit = findNote(folded, note.phrase, cursor);
    if (!hit) continue;
    if (spans.some((s) => hit.start < s.end && s.start < hit.end)) continue;
    spans.push({ ...hit, role: roleOf(note.kind), note });
    cursor = hit.end;
  }
  if (matcher) {
    for (const hit of matcher.find(prompt)) {
      // A glossary phrase inside a noted phrase stays attached to that note, so the plate is still
      // listed under the phrase on the Words pages.
      const inside = spans.find((s) => s.note && hit.start >= s.start && hit.end <= s.end);
      if (inside) { (inside.terms ||= []).includes(hit.term) || inside.terms.push(hit.term); continue; }
      if (spans.some((s) => hit.start < s.end && s.start < hit.end)) continue;
      spans.push(hit);
    }
  }
  spans.sort((a, b) => a.start - b.start);
  const out = [];
  let at = 0;
  let n = 0;
  for (const s of spans) {
    if (s.start > at) out.push({ text: prompt.slice(at, s.start) });
    out.push({ text: prompt.slice(s.start, s.end), role: s.role, note: s.note, term: s.term, terms: s.terms, n: n++ });
    at = s.end;
  }
  if (at < prompt.length) out.push({ text: prompt.slice(at) });
  return out;
}

/** Does this mark carry the glossary phrase `t`, either as itself or inside its note? */
export const hasTerm = (s, t) => (s.term && s.term.t === t) || (s.terms ? s.terms.some((x) => x.t === t) : false);

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

/** Mark-up for a prompt. `interactive` makes each mark focusable and clickable (plate page); otherwise plain spans (cards). */
export function renderPrompt(segments, { interactive = false, highlight = "", emphasize = "" } = {}) {
  const hi = highlight ? new RegExp(`(${escRe(highlight)})`, "gi") : null;
  const paint = (text) => (hi ? esc(text).replace(hi, '<span class="hit">$1</span>') : esc(text));
  return segments
    .map((s) => {
      if (!s.role) return paint(s.text);
      // A span, not a <button>: a button is one unbreakable box, and a marked phrase has to wrap like text.
      const attrs = interactive ? ` role="button" tabindex="0" data-n="${s.n}"` : "";
      const on = emphasize && hasTerm(s, emphasize) ? " is-on" : "";
      return `<span class="mk${on}" data-role="${s.role}"${attrs}>${paint(s.text)}</span>`;
    })
    .join("");
}
