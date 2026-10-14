// Loads the gallery once and answers questions about it: which plates, which notes, which words.
import { CATEGORY } from "./roles.js";
import { compileLexicon, segment } from "./marks.js";

const V = "20261014hd60"; // bump when the files in /data change
const getJson = async (url) => {
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.json();
};

/** One request for everything; if that endpoint is missing, page through the older feed instead. */
async function loadPlates() {
  try {
    const data = await getJson("/api/catalog");
    if (Array.isArray(data.plates) && data.plates.length) return data.plates;
  } catch {
    /* fall through */
  }
  const plates = [];
  for (const kind of ["image", "video"]) {
    for (let offset = 0; offset < 6000; offset += 120) {
      const page = await getJson(`/api/feed?kind=${kind}&limit=120&offset=${offset}`);
      plates.push(...page.creations);
      if (!page.creations.length || offset + 120 >= page.total) break;
    }
  }
  return plates;
}

let ready = null;
export const db = {
  plates: [],
  byId: new Map(),
  notes: {},
  lexicon: [],
  games: [],
  matcher: null,
  /** term text → { term, plates: [ids] } for every glossary phrase that appears at least once */
  words: new Map(),
};

export function load() {
  if (ready) return ready;
  ready = (async () => {
    const [plates, notes, lexicon, games] = await Promise.all([
      loadPlates(),
      getJson(`/data/notes.json?v=${V}`).catch(() => ({})),
      getJson(`/data/lexicon.json?v=${V}`).catch(() => []),
      getJson(`/data/games.json?v=${V}`).catch(() => []),
    ]);
    db.plates = plates.map((p) => ({ ...p, category: (p.tags || []).find((t) => CATEGORY[t]) || "" }));
    db.byId = new Map(db.plates.map((p) => [p.id, p]));
    db.notes = notes;
    db.lexicon = lexicon;
    db.games = games;
    db.matcher = compileLexicon(lexicon);
    for (const p of db.plates) {
      p.segments = segment(p.prompt, notes[p.id] || [], db.matcher);
      for (const s of p.segments) {
        for (const term of s.term ? [s.term] : s.terms || []) {
          let entry = db.words.get(term.t);
          if (!entry) db.words.set(term.t, (entry = { term, plates: [] }));
          if (entry.plates[entry.plates.length - 1] !== p.id) entry.plates.push(p.id);
        }
      }
    }
    return db;
  })();
  ready.catch(() => (ready = null));
  return ready;
}

export const posterOf = (p) => (p.mediaKind === "video" ? p.poster || "" : p.mediaUrl);
export const thumbOf = (p) => p.thumbUrl || posterOf(p);
/** Lighter 720p copy of a video, used for hover previews and default playback. */
export const previewOf = (p) => String(p.mediaUrl || "").replace("/media/video/", "/media/video-preview/");

export function filter({ kind = "", tag = "", model = "", word = "", q = "" } = {}) {
  let list = db.plates;
  if (kind) list = list.filter((p) => p.mediaKind === kind);
  if (tag) list = list.filter((p) => p.tags.includes(tag));
  if (model) list = list.filter((p) => p.displayModel === model);
  if (word) {
    const ids = new Set(db.words.get(word)?.plates || []);
    list = list.filter((p) => ids.has(p.id));
  }
  const needle = q.trim().toLowerCase();
  if (needle) {
    const parts = needle.split(/\s+/);
    const score = (p) => {
      const title = p.title.toLowerCase();
      const hay = `${title} ${p.prompt.toLowerCase()} ${p.tags.join(" ")} ${p.displayModel.toLowerCase()}`;
      if (!parts.every((w) => hay.includes(w))) return 0;
      return (title.includes(needle) ? 4 : 0) + (p.prompt.toLowerCase().includes(needle) ? 2 : 0) + 1;
    };
    list = list.map((p) => [score(p), p]).filter(([s]) => s).sort((a, b) => b[0] - a[0]).map(([, p]) => p);
  }
  return list;
}

export function counts(list, key) {
  const out = new Map();
  for (const p of list) {
    for (const v of [].concat(key(p))) if (v) out.set(v, (out.get(v) || 0) + 1);
  }
  return out;
}

/** Plates that share this one's category (then model), newest first, not including itself. */
export function related(plate, n = 8) {
  const same = db.plates.filter((p) => p.id !== plate.id && p.mediaKind === plate.mediaKind && p.category && p.category === plate.category);
  const rest = db.plates.filter((p) => p.id !== plate.id && p.mediaKind === plate.mediaKind && p.category !== plate.category && p.displayModel === plate.displayModel);
  return [...same, ...rest].slice(0, n);
}
