function familyOnly(model) {
  const n = String(model || "").trim();
  if (/^grok$/i.test(n)) return "grok";
  if (/^midjourney$/i.test(n)) return "midjourney";
  return null;
}

const OVERRIDES = { seed_future_mj: "Midjourney V8.2" };

function displayModel(row, opts) {
  if (opts && opts.games) return String((row && row.model) || "").trim() || "Grok";
  row = row || {};
  const id = String(row.id || "").trim();
  if (id && OVERRIDES[id]) return OVERRIDES[id];
  const explicit = String(row.modelVersion || row.model_version || "").trim();
  if (explicit && !familyOnly(explicit)) return explicit;
  const model = String(row.model || "").trim();
  if (model && !familyOnly(model)) return model;
  const family = familyOnly(explicit || model);
  if (family === "midjourney") return "Midjourney V7";
  if (family === "grok") return row.mediaKind === "video" ? "Grok Imagine Video 1.5" : "Grok Imagine 2.0";
  return model || "Grok";
}

function modelMatches(row, needle) {
  const q = String(needle || "").trim().toLowerCase();
  if (!q) return true;
  const model = String(row.model || "").toLowerCase();
  const label = displayModel(row).toLowerCase();
  return model.includes(q) || label.includes(q);
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(displayModel({ model: "Grok", mediaKind: "image" }) === "Grok Imagine 2.0", "grok image");
assert(displayModel({ model: "Grok", mediaKind: "video" }) === "Grok Imagine Video 1.5", "grok video");
assert(displayModel({ model: "Midjourney" }) === "Midjourney V7", "mj default v7");
assert(displayModel({ model: "Midjourney V8.2" }) === "Midjourney V8.2", "verbatim versioned");
assert(displayModel({ model: "Grok Imagine 2.0" }) === "Grok Imagine 2.0", "verbatim grok");
assert(displayModel({ id: "seed_future_mj", model: "Midjourney" }) === "Midjourney V8.2", "id override");
assert(displayModel({ model: "Grok" }, { games: true }) === "Grok", "games stay grok");
assert(modelMatches({ model: "Grok", mediaKind: "image" }, "grok"), "search grok");
assert(modelMatches({ model: "Midjourney" }, "midjourney"), "search midjourney");
assert(modelMatches({ model: "Grok", mediaKind: "image" }, "imagine"), "search imagine label");

const pageSize = 9;
function pages(total) { return Math.max(1, Math.ceil(total / pageSize)); }
assert(pages(9) === 1, "9 is one page");
assert(pages(10) === 2, "10 splits");
assert(pages(18) === 2, "18 is two pages");
assert(pages(19) === 3, "no 18 cap");
assert((2 - 1) * pageSize === 9, "page 2 offset");

console.log("cat-page + modelLabel checks ok");
