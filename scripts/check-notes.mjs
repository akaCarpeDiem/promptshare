#!/usr/bin/env node
/**
 * Checks overlay/data/notes.json against the live catalogue.
 *
 *   node scripts/check-notes.mjs                         # against https://promptshare.co
 *   node scripts/check-notes.mjs http://127.0.0.1:4173   # against the local dev server
 *
 * Reports: notes whose phrase is not in the plate's prompt (or overlaps another note),
 * notes for plates that no longer exist, and plates that have no notes yet.
 * Exits with status 1 if a phrase does not match, so it can gate a deploy.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { segment } from "../overlay/app/marks.js";

const origin = (process.argv[2] || "https://promptshare.co").replace(/\/$/, "");
const notes = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../overlay/data/notes.json"), "utf8"));

async function plates() {
  const res = await fetch(origin + "/api/catalog");
  if (res.ok) return (await res.json()).plates;
  const all = []; // older deploys have no /api/catalog
  for (const kind of ["image", "video"]) {
    for (let offset = 0; offset < 6000; offset += 120) {
      const page = await (await fetch(`${origin}/api/feed?kind=${kind}&limit=120&offset=${offset}`)).json();
      all.push(...page.creations);
      if (!page.creations.length || offset + 120 >= page.total) break;
    }
  }
  return all;
}

const list = await plates();
const byId = new Map(list.map((p) => [p.id, p]));
let bad = 0;
for (const [id, set] of Object.entries(notes)) {
  const plate = byId.get(id);
  if (!plate) { console.log(`no such plate (remove its notes?): ${id}`); continue; }
  const found = new Set(segment(plate.prompt, set, null).filter((s) => s.note).map((s) => s.note));
  for (const note of set) {
    if (found.has(note)) continue;
    bad++;
    console.log(`${id}: phrase not in the prompt, or overlapping an earlier note: "${note.phrase}"`);
  }
}
const missing = list.filter((p) => !notes[p.id]);
for (const p of missing) console.log(`no notes yet: ${p.id}  (${p.title})`);
console.log(`${list.length} plates, ${Object.keys(notes).length} with notes, ${missing.length} without, ${bad} phrases that do not match`);
process.exit(bad ? 1 : 0);
