/** Strip Midjourney category style tails that were merged into the creative prompt. */
const STYLE_TAILS: RegExp[] = [
  /,?\s*Original invented creature concept art,\s*cinematic fantasy wildlife,\s*not a trademarked character\s*$/i,
  /,?\s*Wide expansive international city panorama from elevated\/distance — not street level,\s*photoreal cinematic cityscape\s*$/i,
  /,?\s*Photoreal urban street-level photography — not a skyline overview,\s*candid city street,\s*no readable logos\s*$/i,
  /,?\s*Ultra-realistic candid documentary photography of adults only \(21\+\),\s*natural light,\s*shallow depth of field,\s*no celebrities,\s*no minors\s*$/i,
  /,?\s*Editorial beauty portrait photography of an adult \(21\+\),\s*shallow depth of field,\s*natural skin texture,\s*no celebrities,\s*no minors\s*$/i,
  /,?\s*Cyberpunk megacity night scene,\s*dense neon invented-glyph signs,\s*rain-slick reflections,\s*cinematic photography,\s*no real brand logos\s*$/i,
  /,?\s*Sci-fi futuristic concept art of an original future setting,\s*volumetric light,\s*cinematic,\s*no real brands\s*$/i,
  /,?\s*Wildlife photography,\s*natural habitat,\s*soft naturalistic light,\s*no people,\s*no text\s*$/i,
  /,?\s*Atmospheric mythic\/cryptid documentary still of an original or public-domain myth subject,\s*moody light,\s*no copyrighted franchise characters\s*$/i,
  /,?\s*Classic American comic book splash,\s*bold black outlines,\s*Ben-Day dots,\s*flat primary colors,\s*speech-free,\s*original characters only\s*$/i,
  /,?\s*Cinematic modern anime still,\s*soft cel shading,\s*clean linework,\s*original adult characters only \(21\+\),\s*no franchise IPs\s*$/i,
  /,?\s*Photoreal food magazine editorial photography,\s*soft window light,\s*shallow depth of field,\s*no logos,\s*no text\s*$/i,
  /,?\s*Architectural photography,\s*no people,\s*clean geometry,\s*natural light\s*$/i,
  /,?\s*Photoreal cinematic space photography \/ sci-fi still,\s*no readable UI text\s*$/i,
  /,?\s*Photoreal vehicle photography,\s*cinematic still,\s*no real trademarked marque badges emphasized\s*$/i,
  /,?\s*Nature photography,\s*intimate or wide natural scene,\s*no people,\s*no text\s*$/i,
  /,?\s*Photoreal landscape photography,\s*ultra detailed nature,\s*natural color,\s*no people,\s*no text\s*$/i,
];

export function cleanDisplayPrompt(prompt: string): string {
  let p = String(prompt || "").trim();
  // Drop trailing Midjourney CLI params if any leaked into stored prompt
  p = p.replace(/\s+--\w+(?:\s+[^\s-][^\s]*)*/g, "").trim();
  for (const pat of STYLE_TAILS) {
    const next = p.replace(pat, "").trim().replace(/,\s*$/, "").trim();
    if (next.length >= 40) p = next;
  }
  return p;
}
