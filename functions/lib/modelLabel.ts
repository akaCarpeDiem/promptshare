export type ModelLabelRow = {
  id?: string | null;
  model?: string | null;
  modelVersion?: string | null;
  model_version?: string | null;
  displayModel?: string | null;
  mediaKind?: string | null;
};

/** Optional per-plate chip overrides. Future Midjourney V8.2 plates go here (or store the full string in `model`). */
export const MODEL_LABEL_OVERRIDES: Record<string, string> = {
  // "seed_example": "Midjourney V8.2",
};

function familyOnly(model: string): "grok" | "midjourney" | null {
  const n = model.trim();
  if (/^grok$/i.test(n)) return "grok";
  if (/^midjourney$/i.test(n)) return "midjourney";
  return null;
}

/** Chip / plate label at display time. Does not rewrite D1 or seed rows. */
export function displayModel(row: ModelLabelRow, opts?: { games?: boolean }): string {
  if (opts?.games) {
    const raw = String(row.model || "").trim();
    return raw || "Grok";
  }
  const id = String(row.id || "").trim();
  if (id && MODEL_LABEL_OVERRIDES[id]) return MODEL_LABEL_OVERRIDES[id];

  const explicit = String(row.modelVersion || row.model_version || "").trim();
  if (explicit && !familyOnly(explicit)) return explicit;

  const model = String(row.model || "").trim();
  if (model && !familyOnly(model)) return model;

  const family = familyOnly(explicit || model);
  if (family === "midjourney") return "Midjourney V7";
  if (family === "grok") {
    return row.mediaKind === "video" ? "Grok Imagine Video 1.5" : "Grok Imagine 2.0";
  }
  return model || "Grok";
}

/** Family / search match: "grok" and "midjourney" still hit versioned labels. */
export function modelMatches(row: ModelLabelRow, needle: string): boolean {
  const q = String(needle || "").trim().toLowerCase();
  if (!q) return true;
  const model = String(row.model || "").toLowerCase();
  const label = displayModel(row).toLowerCase();
  return model.includes(q) || label.includes(q);
}
