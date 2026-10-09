import type { AuthEnv, Creation, MediaKind, SocialLink, Store, User, Visibility } from "./types.ts";
import { evaluateUsername, isPlaceholderHandle, makePlaceholderHandle, cleanUsername } from "./username.ts";
import { hashPassword, validatePasswordStrength, verifyPassword } from "./password.ts";
import { gridThumbUrl } from "./mediaThumbs.ts";
import { displayModel } from "./modelLabel.ts";
import { cleanDisplayPrompt } from "./promptClean";

const IMAGE_LIMIT = 8 * 1024 * 1024;

const NSFW_REJECT = "This image was flagged by our safety check and can’t be published.";

/** Optional Sightengine vision check. Skips entirely when secrets are unset (honest — no fake scan). */
async function checkSightengineNsfw(env: AuthEnv, bytes: Uint8Array, contentType: string, filename: string): Promise<string | null> {
  const user = (env.SIGHTENGINE_API_USER || "").trim();
  const secret = (env.SIGHTENGINE_API_SECRET || "").trim();
  if (!user || !secret) return null;

  const form = new FormData();
  form.append("media", new Blob([bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)], { type: contentType || "application/octet-stream" }), filename || "upload.jpg");
  form.append("models", "nudity-2.0,face-attributes");
  form.append("api_user", user);
  form.append("api_secret", secret);

  let data: Record<string, unknown>;
  try {
    const res = await fetch("https://api.sightengine.com/1.0/check.json", { method: "POST", body: form });
    data = await res.json() as Record<string, unknown>;
  } catch {
    // Optional vendor down — do not invent a pass/fail; text blocklist still ran.
    return null;
  }
  if (data.status && data.status !== "success") return null;

  const nudity = (data.nudity || {}) as Record<string, unknown>;
  const sexualScores = [
    Number(nudity.sexual_activity || 0),
    Number(nudity.sexual_display || 0),
    Number(nudity.erotica || 0),
    Number(nudity.raw || 0),
  ];
  // Conservative adult-sexual thresholds (Sightengine scores are 0–1 confidence).
  if (Math.max(...sexualScores) >= 0.45) return NSFW_REJECT;
  if (Number(nudity.very_suggestive || 0) >= 0.75) return NSFW_REJECT;

  const faces = Array.isArray(data.faces) ? data.faces as Array<Record<string, unknown>> : [];
  for (const face of faces) {
    const attrs = (face.attributes || {}) as Record<string, unknown>;
    const minorDirect = Number(attrs.minor || 0);
    const age = (attrs.age || {}) as Record<string, unknown>;
    const minorAge = Number(age.minor || 0);
    // Any meaningful minors-related signal → reject (zero tolerance with sexual context handled above too).
    if (minorDirect >= 0.3 || minorAge >= 0.3) return NSFW_REJECT;
  }
  return null;
}


const MODELS = ["Flux", "Midjourney", "DALL·E", "Ideogram", "Grok"];

const REPORT_CATEGORIES = [
  "sexual",
  "sexual_minors",
  "csam",
  "illegal",
  "violence",
  "hate",
  "spam",
  "copyright",
  "other",
] as const;

/** Hard reject patterns for illegal / prohibited UGC (upload + report triage). */
function prohibitedContent(...parts: string[]): string | null {
  const text = parts.filter(Boolean).join("\n").toLowerCase();
  if (!text.trim()) return null;
  // Sexual content involving minors (including generated/fictional) — zero tolerance
  const minorSexual = [
    /\b(child\s*porn|cp\b|csam|cub\s*porn)\b/i,
    /\b(underage|preteen|pre-teen|loli|shota|toddler)\b.{0,40}\b(nude|naked|sex|porn|explicit|nsfw)\b/i,
    /\b(nude|naked|sex|porn|explicit|nsfw)\b.{0,40}\b(underage|preteen|pre-teen|loli|shota|toddler|minor|child)\b/i,
    /\b(sexual|erotic|pornograph)\w*.{0,40}\b(minor|child|children|kid|kids|teen\b|under\s*1[0-7])\b/i,
    /\b(minor|child|children|kid|kids|teen\b|under\s*1[0-7]).{0,40}\b(sexual|erotic|pornograph)\w*/i,
  ];
  for (const re of minorSexual) {
    if (re.test(text)) {
      return "Uploads may not include sexual content involving minors, including generated or fictional depictions.";
    }
  }
  const illegal = [
    /\b(how to (make|build|assemble) (a )?(bomb|explosive|pipe bomb))\b/i,
    /\b(sell|buy|ship).{0,20}\b(fentanyl|heroin|cocaine)\b/i,
  ];
  for (const re of illegal) {
    if (re.test(text)) {
      return "That content is not allowed on PromptShare.";
    }
  }
  // Obvious adult-sexual marketing in title/prompt (image scan covers the pixels when Sightengine is configured).
  const adult = [
    /\b(onlyfans|porn(hub)?|xxx|nsfw\s*only)\b/i,
    /\b(explicit\s+nude|full\s+nude|nude\s+selfie)\b/i,
    /\b(hardcore\s+sex|sex\s+tape|pornograph(y|ic))\b/i,
  ];
  for (const re of adult) {
    if (re.test(text)) {
      return "PromptShare doesn’t allow pornographic uploads. Keep plates suitable for a general creative audience.";
    }
  }
  return null;
}

function curatedPoster(creation: Pick<Creation, "mediaKind" | "mediaUrl">): string | undefined {
  if (creation.mediaKind !== "video") return undefined;
  if (creation.mediaUrl === "/media/video/us-cities-detroit-riverfront.mp4") {
    return "/media/posters/us-cities-detroit-riverfront.jpg?v=20261002detroit2";
  }
  if (creation.mediaUrl === "/media/video/us-cities-honolulu-waikiki.mp4") {
    return "/media/posters/us-cities-honolulu-waikiki.jpg?v=20261002honolulu1";
  }
  if (creation.mediaUrl === "/media/video/us-cities-pittsburgh-point.mp4") {
    return "/media/posters/us-cities-pittsburgh-point.jpg?v=20261002pittsburgh1";
  }
  if (creation.mediaUrl === "/media/video/us-cities-salt-lake-wasatch.mp4") {
    return "/media/posters/us-cities-salt-lake-wasatch.jpg?v=20261002saltlake60";
  }
  if (creation.mediaUrl === "/media/video/us-cities-charleston-battery.mp4") {
    return "/media/posters/us-cities-charleston-battery.jpg?v=20261002charleston60";
  }
  if (creation.mediaUrl === "/media/video/us-cities-seattle-elliott.mp4") {
    return "/media/posters/us-cities-seattle-elliott.jpg?v=20261002seattle60";
  }
  if (creation.mediaUrl === "/media/video/us-cities-new-orleans-rooftops.mp4") {
    return "/media/posters/us-cities-new-orleans-rooftops.jpg?v=20261002nola60";
  }
  if (creation.mediaUrl === "/media/video/us-cities-austin-lake.mp4") {
    return "/media/posters/us-cities-austin-lake.jpg?v=20261002austin60";
  }
  if (creation.mediaUrl === "/media/video/us-cities-miami-biscayne.mp4") {
    return "/media/posters/us-cities-miami-biscayne.jpg?v=20261002miami60";
  }
  if (creation.mediaUrl === "/media/video/us-cities-boston-zakim.mp4") {
    return "/media/posters/us-cities-boston-zakim.jpg?v=20261002boston60";
  }
  if (creation.mediaUrl === "/media/video/us-cities-denver-foothills.mp4") {
    return "/media/posters/us-cities-denver-foothills.jpg?v=20261002denver60";
  }
  if (creation.mediaUrl === "/media/video/us-cities-philadelphia-schuylkill.mp4") {
    return "/media/posters/us-cities-philadelphia-schuylkill.jpg?v=20261002philly60";
  }
  if (creation.mediaUrl === "/media/video/us-cities-nashville-cumberland.mp4") {
    return "/media/posters/us-cities-nashville-cumberland.jpg?v=20261002nashville60";
  }
  if (creation.mediaUrl === "/media/video/us-cities-portland-bridges.mp4") {
    return "/media/posters/us-cities-portland-bridges.jpg?v=20261002portland60";
  }
  if (creation.mediaUrl === "/media/video/us-cities-chicago-riverwalk.mp4") {
    return "/media/posters/us-cities-chicago-riverwalk.jpg?v=20261003chicago1080";
  }
  if (creation.mediaUrl === "/media/video/us-cities-st-louis-arch.mp4") {
    return "/media/posters/us-cities-st-louis-arch.jpg?v=20261003stlouis1080";
  }
  if (creation.mediaUrl === "/media/video/us-cities-baltimore-harbor.mp4") {
    return "/media/posters/us-cities-baltimore-harbor.jpg?v=20261003balti1080";
  }
  if (creation.mediaUrl === "/media/video/us-cities-savannah-river.mp4") {
    return "/media/posters/us-cities-savannah-river.jpg?v=20261003sav1080";
  }
  if (creation.mediaUrl === "/media/video/us-cities-san-antonio-river.mp4") {
    return "/media/posters/us-cities-san-antonio-river.jpg?v=20261003sa1080";
  }
  if (creation.mediaUrl === "/media/video/us-cities-cleveland-lake.mp4") {
    return "/media/posters/us-cities-cleveland-lake.jpg?v=20261003cle1080";
  }
  if (creation.mediaUrl === "/media/video/us-cities-kansas-city-skyline.mp4") {
    return "/media/posters/us-cities-kansas-city-skyline.jpg?v=20261003kc1080";
  }
  if (creation.mediaUrl === "/media/video/us-cities-cincinnati-river.mp4") {
    return "/media/posters/us-cities-cincinnati-river.jpg?v=20261003cin1080";
  }
  if (creation.mediaUrl === "/media/video/us-cities-milwaukee-lake.mp4") {
    return "/media/posters/us-cities-milwaukee-lake.jpg?v=20261003mke1080";
  }
  if (creation.mediaUrl === "/media/video/us-cities-providence-water.mp4") {
    return "/media/posters/us-cities-providence-water.jpg?v=20261003prov1080";
  }
  if (creation.mediaUrl === "/media/video/us-cities-richmond-river.mp4") {
    return "/media/posters/us-cities-richmond-river.jpg?v=20261003ric1080";
  }
  if (creation.mediaUrl === "/media/video/us-cities-albuquerque-plaza.mp4") {
    return "/media/posters/us-cities-albuquerque-plaza.jpg?v=20261003abq1080";
  }
  if (creation.mediaUrl === "/media/video/us-cities-anchorage-coast.mp4") {
    return "/media/posters/us-cities-anchorage-coast.jpg?v=20261003anc1080";
  }
  if (creation.mediaUrl === "/media/video/us-cities-boise-foothills.mp4") {
    return "/media/posters/us-cities-boise-foothills.jpg?v=20261003boi1080";
  }
  if (creation.mediaUrl === "/media/video/us-cities-tucson-downtown.mp4") {
    return "/media/posters/us-cities-tucson-downtown.jpg?v=20261003tuc1080";
  }
  if (creation.mediaUrl === "/media/video/landscapes-glacier-lagoon.mp4") {
    return "/media/posters/landscapes-glacier-lagoon.jpg?v=20261003glag1080";
  }
  if (creation.mediaUrl === "/media/video/landscapes-badlands-buttes.mp4") {
    return "/media/posters/landscapes-badlands-buttes.jpg?v=20261003badl1080";
  }
  if (creation.mediaUrl === "/media/video/landscapes-sea-stacks.mp4") {
    return "/media/posters/landscapes-sea-stacks.jpg?v=20261003seas1080";
  }
  if (creation.mediaUrl === "/media/video/landscapes-larch-valley.mp4") {
    return "/media/posters/landscapes-larch-valley.jpg?v=20261003larch1080";
  }
  if (creation.mediaUrl === "/media/video/landscapes-basalt-coast.mp4") {
    return "/media/posters/landscapes-basalt-coast.jpg?v=20261003basa1080";
  }
  if (creation.mediaUrl === "/media/video/landscapes-wildflower-desert.mp4") {
    return "/media/posters/landscapes-wildflower-desert.jpg?v=20261003wild1080";
  }
  if (creation.mediaUrl === "/media/video/landscapes-canyon-river.mp4") {
    return "/media/posters/landscapes-canyon-river.jpg?v=20261003canr1080";
  }
  if (creation.mediaUrl === "/media/video/landscapes-snow-volcano.mp4") {
    return "/media/posters/landscapes-snow-volcano.jpg?v=20261003svol1080";
  }
  if (creation.mediaUrl === "/media/video/landscapes-cottonwood-river.mp4") {
    return "/media/posters/landscapes-cottonwood-river.jpg?v=20261003cott1080";
  }
  if (creation.mediaUrl === "/media/video/landscapes-hoodoo-basin.mp4") {
    return "/media/posters/landscapes-hoodoo-basin.jpg?v=20261003hood1080";
  }
  if (creation.mediaUrl === "/media/video/landscapes-fjord-village.mp4") {
    return "/media/posters/landscapes-fjord-village.jpg?v=20261003fjsh1080";
  }
  if (creation.mediaUrl === "/media/video/landscapes-salt-marsh.mp4") {
    return "/media/posters/landscapes-salt-marsh.jpg?v=20261003saltm1080";
  }
  if (creation.mediaUrl === "/media/video/landscapes-joshua-dusk.mp4") {
    return "/media/posters/landscapes-joshua-dusk.jpg?v=20261003josh1080";
  }
  if (creation.mediaUrl === "/media/video/landscapes-waterfall-pool-v2.mp4") {
    return "/media/posters/landscapes-waterfall-pool-v2.jpg?v=20261003wpool60c";
  }
  if (creation.mediaUrl === "/media/video/landscapes-tundra-river.mp4") {
    return "/media/posters/landscapes-tundra-river.jpg?v=20261003tund1080";
  }
  if (creation.mediaUrl === "/media/video/cities-kyoto-kamo.mp4") {
    return "/media/posters/cities-kyoto-kamo.jpg?v=20261003citieskyot60";
  }
  if (creation.mediaUrl === "/media/video/cities-venice-dawn.mp4") {
    return "/media/posters/cities-venice-dawn.jpg?v=20261003citiesveni60";
  }
  if (creation.mediaUrl === "/media/video/cities-rio-hill.mp4") {
    return "/media/posters/cities-rio-hill.jpg?v=20261003citiesrioh60";
  }
  if (creation.mediaUrl === "/media/video/cities-singapore-marina.mp4") {
    return "/media/posters/cities-singapore-marina.jpg?v=20261003citiessing60";
  }
  if (creation.mediaUrl === "/media/video/cities-barcelona-gothic.mp4") {
    return "/media/posters/cities-barcelona-gothic.jpg?v=20261003citiesbarc60";
  }
  if (creation.mediaUrl === "/media/video/cities-amsterdam-canal.mp4") {
    return "/media/posters/cities-amsterdam-canal.jpg?v=20261003citiesamst60";
  }
  if (creation.mediaUrl === "/media/video/cities-seoul-han.mp4") {
    return "/media/posters/cities-seoul-han.jpg?v=20261003citiesseou60";
  }
  if (creation.mediaUrl === "/media/video/cities-dubrovnik-walls.mp4") {
    return "/media/posters/cities-dubrovnik-walls.jpg?v=20261003citiesdubr60";
  }
  if (creation.mediaUrl === "/media/video/cities-valparaiso-hills.mp4") {
    return "/media/posters/cities-valparaiso-hills.jpg?v=20261003citiesvalp60";
  }
  if (creation.mediaUrl === "/media/video/cities-bergen-harbor.mp4") {
    return "/media/posters/cities-bergen-harbor.jpg?v=20261003citiesberg60";
  }
  if (creation.mediaUrl === "/media/video/cities-queenstown-lake.mp4") {
    return "/media/posters/cities-queenstown-lake.jpg?v=20261003citiesquee60";
  }
  if (creation.mediaUrl === "/media/video/cities-luang-river.mp4") {
    return "/media/posters/cities-luang-river.jpg?v=20261003citiesluan60";
  }
  if (creation.mediaUrl === "/media/video/cities-santorini-caldera.mp4") {
    return "/media/posters/cities-santorini-caldera.jpg?v=20261003citiessant60";
  }
  if (creation.mediaUrl === "/media/video/cities-budapest-bridge.mp4") {
    return "/media/posters/cities-budapest-bridge.jpg?v=20261003citiesbuda60";
  }
  if (creation.mediaUrl === "/media/video/cities-vancouver-seawall.mp4") {
    return "/media/posters/cities-vancouver-seawall.jpg?v=20261003citiesvanc60";
  }
  if (creation.mediaUrl === "/media/video/street-tokyo-alley.mp4") {
    return "/media/posters/street-tokyo-alley.jpg?v=20261003streettoky60";
  }
  if (creation.mediaUrl === "/media/video/street-lisbon-tram.mp4") {
    return "/media/posters/street-lisbon-tram.jpg?v=20261003streetlisb60";
  }
  if (creation.mediaUrl === "/media/video/street-new-orleans.mp4") {
    return "/media/posters/street-new-orleans.jpg?v=20261003streetnewo60";
  }
  if (creation.mediaUrl === "/media/video/street-seoul-neon.mp4") {
    return "/media/posters/street-seoul-neon.jpg?v=20261003streetseou60";
  }
  if (creation.mediaUrl === "/media/video/street-paris-rain.mp4") {
    return "/media/posters/street-paris-rain.jpg?v=20261003streetpari60";
  }
  if (creation.mediaUrl === "/media/video/street-oaxaca-market.mp4") {
    return "/media/posters/street-oaxaca-market.jpg?v=20261003streetoaxa60";
  }
  if (creation.mediaUrl === "/media/video/street-melbourne-lane.mp4") {
    return "/media/posters/street-melbourne-lane.jpg?v=20261003streetmelb60";
  }
  if (creation.mediaUrl === "/media/video/street-hongkong-street.mp4") {
    return "/media/posters/street-hongkong-street.jpg?v=20261003streethong60";
  }
  if (creation.mediaUrl === "/media/video/street-rome-cobble.mp4") {
    return "/media/posters/street-rome-cobble.jpg?v=20261003streetrome60";
  }
  if (creation.mediaUrl === "/media/video/street-copenhagen-bike.mp4") {
    return "/media/posters/street-copenhagen-bike.jpg?v=20261003streetcope60";
  }
  if (creation.mediaUrl === "/media/video/street-istanbul-lane.mp4") {
    return "/media/posters/street-istanbul-lane.jpg?v=20261003streetista60";
  }
  if (creation.mediaUrl === "/media/video/street-havana-pastel.mp4") {
    return "/media/posters/street-havana-pastel.jpg?v=20261003streethava60";
  }
  if (creation.mediaUrl === "/media/video/street-mexico-colonia.mp4") {
    return "/media/posters/street-mexico-colonia.jpg?v=20261003streetmexi60";
  }
  if (creation.mediaUrl === "/media/video/street-chefchaouen.mp4") {
    return "/media/posters/street-chefchaouen.jpg?v=20261003streetchef60";
  }
  if (creation.mediaUrl === "/media/video/street-edinburgh-close.mp4") {
    return "/media/posters/street-edinburgh-close.jpg?v=20261003streetedin60";
  }
  if (creation.mediaUrl === "/media/video/people-cafe-terrace.mp4") {
    return "/media/posters/people-cafe-terrace.jpg?v=20261003peoplecafe60";
  }
  if (creation.mediaUrl === "/media/video/people-crosswalk-dusk.mp4") {
    return "/media/posters/people-crosswalk-dusk.jpg?v=20261003peoplecros60";
  }
  if (creation.mediaUrl === "/media/video/people-night-market.mp4") {
    return "/media/posters/people-night-market.jpg?v=20261003peoplenigh60";
  }
  if (creation.mediaUrl === "/media/video/people-station-platform.mp4") {
    return "/media/posters/people-station-platform.jpg?v=20261003peoplestat60";
  }
  if (creation.mediaUrl === "/media/video/people-park-path.mp4") {
    return "/media/posters/people-park-path.jpg?v=20261003peoplepark60";
  }
  if (creation.mediaUrl === "/media/video/people-bookstore.mp4") {
    return "/media/posters/people-bookstore.jpg?v=20261003peoplebook60";
  }
  return creation.mediaUrl.replace("/media/video/", "/media/posters/").replace(/\.(webm|mp4|mov)(\?|$)/i, ".jpg$2");
}

// The first Pages deploy briefly cached the SPA fallback at this new path.
// Keep the stored mediaUrl canonical, but let app-facing media fields bypass
// that stale edge entry while it expires.
function appMediaUrl(creation: Pick<Creation, "mediaKind" | "mediaUrl">): string {
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/landscapes-salt-flat.mp4") {
    return `${creation.mediaUrl}?v=20261002salt1`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/landscapes-highland-ridge.mp4") {
    return `${creation.mediaUrl}?v=20261002highland1`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/landscapes-lavender-field.mp4") {
    return `${creation.mediaUrl}?v=20261002lavender1`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/landscapes-bamboo-grove.mp4") {
    return `${creation.mediaUrl}?v=20261002b5`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/landscapes-frozen-lake.mp4") {
    return `${creation.mediaUrl}?v=20261002frozen1`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/landscapes-rolling-hills.mp4") {
    return `${creation.mediaUrl}?v=20261002rolling1`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/landscapes-waterfall-gorge.mp4") {
    return `${creation.mediaUrl}?v=20261002waterfall1`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/landscapes-tropical-lagoon.mp4") {
    return `${creation.mediaUrl}?v=20261002lagoon1`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/landscapes-glacial-river.mp4") {
    return `${creation.mediaUrl}?v=20261002glacial1`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/landscapes-marsh-sunrise.mp4") {
    return `${creation.mediaUrl}?v=20261002marsh1`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/landscapes-black-sand-beach.mp4") {
    return `${creation.mediaUrl}?v=20261002black1`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/landscapes-slot-canyon.mp4") {
    return `${creation.mediaUrl}?v=20261002slotcanyon1`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/landscapes-chalk-cliff.mp4") {
    return `${creation.mediaUrl}?v=20261002chalk1`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/landscapes-rice-terrace.mp4") {
    return `${creation.mediaUrl}?v=20261002rice1`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/landscapes-mangrove.mp4") {
    return `${creation.mediaUrl}?v=20261002mangrove1`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/landscapes-wheat-field.mp4") {
    return `${creation.mediaUrl}?v=20261002wheat1`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/landscapes-alpine-tarn.mp4") {
    return `${creation.mediaUrl}?v=20261002alpine1`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/landscapes-olive-grove.mp4") {
    return `${creation.mediaUrl}?v=20261002olive1`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/landscapes-cedar-mist.mp4") {
    return `${creation.mediaUrl}?v=20261002cedar1`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/landscapes-river-delta.mp4") {
    return `${creation.mediaUrl}?v=20261002riverdelta2`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/landscapes-kelp-forest.mp4") {
    return `${creation.mediaUrl}?v=20261002kelp1`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/landscapes-dry-lake.mp4") {
    return `${creation.mediaUrl}?v=20261002drylake1`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/us-cities-detroit-riverfront.mp4") {
    return `${creation.mediaUrl}?v=20261002detroit60`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/us-cities-honolulu-waikiki.mp4") {
    return `${creation.mediaUrl}?v=20261002honolulu60`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/us-cities-pittsburgh-point.mp4") {
    return `${creation.mediaUrl}?v=20261002pittsburgh60`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/us-cities-salt-lake-wasatch.mp4") {
    return `${creation.mediaUrl}?v=20261002saltlake60b`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/us-cities-charleston-battery.mp4") {
    return `${creation.mediaUrl}?v=20261002charleston60`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/us-cities-seattle-elliott.mp4") {
    return `${creation.mediaUrl}?v=20261002seattle60`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/us-cities-new-orleans-rooftops.mp4") {
    return `${creation.mediaUrl}?v=20261002nola60`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/us-cities-austin-lake.mp4") {
    return `${creation.mediaUrl}?v=20261002austin60`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/us-cities-miami-biscayne.mp4") {
    return `${creation.mediaUrl}?v=20261002miami60`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/us-cities-boston-zakim.mp4") {
    return `${creation.mediaUrl}?v=20261002boston60`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/us-cities-denver-foothills.mp4") {
    return `${creation.mediaUrl}?v=20261002denver60`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/us-cities-philadelphia-schuylkill.mp4") {
    return `${creation.mediaUrl}?v=20261002philly60`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/us-cities-nashville-cumberland.mp4") {
    return `${creation.mediaUrl}?v=20261002nashville60`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/us-cities-portland-bridges.mp4") {
    return `${creation.mediaUrl}?v=20261002portland60`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/us-cities-chicago-riverwalk.mp4") {
    return `${creation.mediaUrl}?v=20261003chicago1080`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/us-cities-st-louis-arch.mp4") {
    return `${creation.mediaUrl}?v=20261003stlouis1080`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/us-cities-baltimore-harbor.mp4") {
    return `${creation.mediaUrl}?v=20261003balti1080`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/us-cities-savannah-river.mp4") {
    return `${creation.mediaUrl}?v=20261003sav1080`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/us-cities-san-antonio-river.mp4") {
    return `${creation.mediaUrl}?v=20261003sa1080`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/us-cities-cleveland-lake.mp4") {
    return `${creation.mediaUrl}?v=20261003cle1080`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/us-cities-kansas-city-skyline.mp4") {
    return `${creation.mediaUrl}?v=20261003kc1080`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/us-cities-cincinnati-river.mp4") {
    return `${creation.mediaUrl}?v=20261003cin1080`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/us-cities-milwaukee-lake.mp4") {
    return `${creation.mediaUrl}?v=20261003mke1080`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/us-cities-providence-water.mp4") {
    return `${creation.mediaUrl}?v=20261003prov1080`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/us-cities-richmond-river.mp4") {
    return `${creation.mediaUrl}?v=20261003ric1080`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/us-cities-albuquerque-plaza.mp4") {
    return `${creation.mediaUrl}?v=20261003abq1080`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/us-cities-anchorage-coast.mp4") {
    return `${creation.mediaUrl}?v=20261003anc1080`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/us-cities-boise-foothills.mp4") {
    return `${creation.mediaUrl}?v=20261003boi1080`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/us-cities-tucson-downtown.mp4") {
    return `${creation.mediaUrl}?v=20261003tuc1080`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/landscapes-glacier-lagoon.mp4") {
    return `${creation.mediaUrl}?v=20261003glag1080`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/landscapes-badlands-buttes.mp4") {
    return `${creation.mediaUrl}?v=20261003badl1080`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/landscapes-sea-stacks.mp4") {
    return `${creation.mediaUrl}?v=20261003seas1080`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/landscapes-larch-valley.mp4") {
    return `${creation.mediaUrl}?v=20261003larch1080`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/landscapes-basalt-coast.mp4") {
    return `${creation.mediaUrl}?v=20261003basa1080`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/landscapes-wildflower-desert.mp4") {
    return `${creation.mediaUrl}?v=20261003wild1080`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/landscapes-canyon-river.mp4") {
    return `${creation.mediaUrl}?v=20261003canr1080`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/landscapes-snow-volcano.mp4") {
    return `${creation.mediaUrl}?v=20261003svol1080`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/landscapes-cottonwood-river.mp4") {
    return `${creation.mediaUrl}?v=20261003cott1080`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/landscapes-hoodoo-basin.mp4") {
    return `${creation.mediaUrl}?v=20261003hood1080`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/landscapes-fjord-village.mp4") {
    return `${creation.mediaUrl}?v=20261003fjsh1080`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/landscapes-salt-marsh.mp4") {
    return `${creation.mediaUrl}?v=20261003saltm1080`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/landscapes-joshua-dusk.mp4") {
    return `${creation.mediaUrl}?v=20261003josh1080`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/landscapes-waterfall-pool-v2.mp4") {
    return `${creation.mediaUrl}?v=20261003wpool60c`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/landscapes-tundra-river.mp4") {
    return `${creation.mediaUrl}?v=20261003tund1080`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/cities-kyoto-kamo.mp4") {
    return `${creation.mediaUrl}?v=20261003citieskyot60`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/cities-venice-dawn.mp4") {
    return `${creation.mediaUrl}?v=20261003citiesveni60`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/cities-rio-hill.mp4") {
    return `${creation.mediaUrl}?v=20261003citiesrioh60`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/cities-singapore-marina.mp4") {
    return `${creation.mediaUrl}?v=20261003citiessing60`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/cities-barcelona-gothic.mp4") {
    return `${creation.mediaUrl}?v=20261003citiesbarc60`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/cities-amsterdam-canal.mp4") {
    return `${creation.mediaUrl}?v=20261003citiesamst60`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/cities-seoul-han.mp4") {
    return `${creation.mediaUrl}?v=20261003citiesseou60`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/cities-dubrovnik-walls.mp4") {
    return `${creation.mediaUrl}?v=20261003citiesdubr60`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/cities-valparaiso-hills.mp4") {
    return `${creation.mediaUrl}?v=20261003citiesvalp60`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/cities-bergen-harbor.mp4") {
    return `${creation.mediaUrl}?v=20261003citiesberg60`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/cities-queenstown-lake.mp4") {
    return `${creation.mediaUrl}?v=20261003citiesquee60`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/cities-luang-river.mp4") {
    return `${creation.mediaUrl}?v=20261003citiesluan60`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/cities-santorini-caldera.mp4") {
    return `${creation.mediaUrl}?v=20261003citiessant60`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/cities-budapest-bridge.mp4") {
    return `${creation.mediaUrl}?v=20261003citiesbuda60`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/cities-vancouver-seawall.mp4") {
    return `${creation.mediaUrl}?v=20261003citiesvanc60`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/street-tokyo-alley.mp4") {
    return `${creation.mediaUrl}?v=20261003streettoky60`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/street-lisbon-tram.mp4") {
    return `${creation.mediaUrl}?v=20261003streetlisb60`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/street-new-orleans.mp4") {
    return `${creation.mediaUrl}?v=20261003streetnewo60`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/street-seoul-neon.mp4") {
    return `${creation.mediaUrl}?v=20261003streetseou60`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/street-paris-rain.mp4") {
    return `${creation.mediaUrl}?v=20261003streetpari60`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/street-oaxaca-market.mp4") {
    return `${creation.mediaUrl}?v=20261003streetoaxa60`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/street-melbourne-lane.mp4") {
    return `${creation.mediaUrl}?v=20261003streetmelb60`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/street-hongkong-street.mp4") {
    return `${creation.mediaUrl}?v=20261003streethong60`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/street-rome-cobble.mp4") {
    return `${creation.mediaUrl}?v=20261003streetrome60`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/street-copenhagen-bike.mp4") {
    return `${creation.mediaUrl}?v=20261003streetcope60`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/street-istanbul-lane.mp4") {
    return `${creation.mediaUrl}?v=20261003streetista60`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/street-havana-pastel.mp4") {
    return `${creation.mediaUrl}?v=20261003streethava60`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/street-mexico-colonia.mp4") {
    return `${creation.mediaUrl}?v=20261003streetmexi60`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/street-chefchaouen.mp4") {
    return `${creation.mediaUrl}?v=20261003streetchef60`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/street-edinburgh-close.mp4") {
    return `${creation.mediaUrl}?v=20261003streetedin60`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/people-cafe-terrace.mp4") {
    return `${creation.mediaUrl}?v=20261003peoplecafe60`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/people-crosswalk-dusk.mp4") {
    return `${creation.mediaUrl}?v=20261003peoplecros60`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/people-night-market.mp4") {
    return `${creation.mediaUrl}?v=20261003peoplenigh60`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/people-station-platform.mp4") {
    return `${creation.mediaUrl}?v=20261003peoplestat60`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/people-park-path.mp4") {
    return `${creation.mediaUrl}?v=20261003peoplepark60`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/people-bookstore.mp4") {
    return `${creation.mediaUrl}?v=20261003peoplebook60`;
  }
  return creation.mediaUrl;
}

/** App-oriented plate payload (canonical names + current API aliases). */
export function plateAppFields(creation: Creation & { author?: { handle: string; displayName: string; avatarUrl: string } | null }) {
  const notes = [...creation.steps]
    .sort((a, b) => a.position - b.position)
    .map((s) => ({
      id: s.id,
      position: s.position,
      prompt: s.prompt,
      model: s.model,
      text: s.note || "",
      // current API name on the step object:
      note: s.note || "",
    }))
    .filter((n) => n.text || n.prompt);
  return {
    id: creation.id,
    imageURL: appMediaUrl(creation),
    poster: curatedPoster(creation),
    prompt: cleanDisplayPrompt(creation.prompt),
    model: creation.model,
    modelVersion: creation.modelVersion || "",
    displayModel: displayModel(creation),
    notes,
    creatorHandle: creation.author?.handle || "",
    visibility: creation.visibility,
    createdAt: creation.createdAt,
    // current API field names (kept for existing clients)
    mediaUrl: appMediaUrl(creation),
    userId: creation.userId,
    title: creation.title,
    tags: creation.tags,
    mediaKind: creation.mediaKind,
    steps: creation.steps,
    author: creation.author || null,
  };
}


function json(data: unknown, status = 200, headers?: Record<string, string>) {
  const responseHeaders = new Headers(headers);
  responseHeaders.set("content-type", "application/json; charset=utf-8");
  if (!responseHeaders.has("cache-control")) {
    responseHeaders.set("cache-control", "no-store");
  }
  return new Response(JSON.stringify(data), { status, headers: responseHeaders });
}

function cookie(sessionId: string, maxAge: number, request: Request) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `ps_session=${encodeURIComponent(sessionId)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

function readSession(request: Request) {
  const raw = request.headers.get("cookie") || "";
  const match = raw.match(/(?:^|; )ps_session=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

function originOf(request: Request, env: AuthEnv) {
  if (env.PUBLIC_ORIGIN) return env.PUBLIC_ORIGIN.replace(/\/$/, "");
  return new URL(request.url).origin;
}

function clientIp(request: Request) {
  return request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
}

async function viewer(store: Store, request: Request) {
  const id = readSession(request);
  if (!id) return null;
  return store.userForSession(id);
}

function cleanHandle(value: string) {
  return cleanUsername(value);
}

function validHandle(value: string) {
  return evaluateUsername(value).ok;
}

function validHttp(value: string) {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function imageExt(type: string, name: string): string | null {
  const mime = type.toLowerCase().split(";")[0].trim();
  const file = name.toLowerCase();
  if (mime.startsWith("video/") || mime.startsWith("audio/") || mime === "image/svg+xml") return null;
  if (mime === "image/jpeg" || mime === "image/jpg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/gif") return "gif";
  if (mime && mime !== "application/octet-stream") return null;
  if (/\.jpe?g$/.test(file)) return "jpg";
  if (file.endsWith(".png")) return "png";
  if (file.endsWith(".webp")) return "webp";
  if (file.endsWith(".gif")) return "gif";
  return null;
}

async function uniqueHandle(store: Store, base: string) {
  let handle = cleanHandle(base);
  if (handle.length < 3) handle = `${handle}user`.slice(0, 20);
  if (!validHandle(handle)) handle = "maker";
  let candidate = handle;
  let n = 2;
  while (await store.handleTaken(candidate)) {
    candidate = `${handle.slice(0, 16)}${n}`;
    n += 1;
  }
  return candidate;
}

function needsUsername(user: User) {
  return !user.usernameSet || isPlaceholderHandle(user.handle);
}

function publicUserView(user: User) {
  return {
    id: user.id,
    email: user.email,
    handle: user.handle,
    displayName: user.displayName,
    bio: user.bio,
    website: user.website,
    avatarUrl: user.avatarUrl,
    socials: user.socials,
    needsUsername: needsUsername(user),
    hasPassword: Boolean(user.passwordHash),
  };
}

async function sendLoginCodeMail(env: AuthEnv, email: string, code: string) {
  if (!env.RESEND_API_KEY) return false;
  const from = env.MAIL_FROM || "PromptShare <support@promptshare.fun>";
  const origin = (env.PUBLIC_ORIGIN || "https://promptshare.fun").replace(/\/$/, "");
  const logoUrl = `${origin}/media/email-logo.png`;
  const codeDisplay = code.split("").join(" ");
  const text = [
    "PromptShare",
    "The output, then the prompt.",
    "",
    `Your login code: ${code}`,
    "",
    "Enter this code on the sign-in screen. No link needed.",
    "It expires in 15 minutes.",
    "",
    "If you did not request this code, you can ignore this email.",
    "",
    origin.replace(/^https?:\/\//, ""),
  ].join("\n");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light only">
  <meta name="supported-color-schemes" content="light only">
  <title>PromptShare login code</title>
</head>
<body style="margin:0;padding:0;background:#ebe6ff;font-family:Segoe UI,Helvetica Neue,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ebe6ff;padding:40px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:460px;border-collapse:separate;border-spacing:0;background:#12131c;border-radius:20px;overflow:hidden;border:1px solid #3a2f5c;">
        <tr>
          <td style="padding:0;background:linear-gradient(135deg,#7ee7f5 0%,#9b8cff 55%,#c4a6ff 100%);height:6px;font-size:0;line-height:0;">&nbsp;</td>
        </tr>
        <tr>
          <td align="center" style="padding:28px 28px 10px;background:#161826;">
            <img src="${logoUrl}" width="72" height="72" alt="PromptShare" style="display:block;border:0;outline:none;margin:0 auto 14px;border-radius:16px;">
            <p style="margin:0;font-size:22px;line-height:1.2;font-weight:700;letter-spacing:-0.02em;color:#f4f1ff;">PromptShare</p>
            <p style="margin:8px 0 0;font-size:13px;line-height:1.4;color:#7ee7f5;font-style:italic;">The output, then the prompt.</p>
          </td>
        </tr>
        <tr>
          <td style="padding:8px 28px 8px;background:#161826;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
              <td style="height:1px;background:#2f3150;font-size:0;line-height:0;">&nbsp;</td>
            </tr></table>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:18px 32px 8px;background:#161826;">
            <h1 style="margin:0;font-size:24px;line-height:1.25;color:#ffffff;font-weight:700;">Your login code</h1>
            <p style="margin:12px 0 0;font-size:15px;line-height:1.55;color:#d2cce6;">Use this code on the PromptShare sign-in screen.<br>No link needed — just type it in.</p>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:18px 28px 10px;background:#161826;">
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;border-collapse:separate;border-spacing:0;">
              <tr>
                <td align="center" style="background:#0b0c14;border:2px solid #7ee7f5;border-radius:14px;padding:20px 28px;box-shadow:0 0 0 4px rgba(126,231,245,0.12);">
                  <p style="margin:0;font-size:34px;letter-spacing:0.32em;font-weight:700;color:#ffffff;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;line-height:1.2;">${codeDisplay}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:14px 32px 8px;background:#161826;">
            <p style="margin:0;font-size:13px;line-height:1.5;color:#a39cba;">Expires in <strong style="color:#c4a6ff;">15 minutes</strong>. If you didn’t request this, you can ignore the email.</p>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:22px 28px 28px;background:#161826;">
            <a href="${origin}" style="display:inline-block;background:linear-gradient(90deg,#7ee7f5,#c4a6ff);color:#12131c;text-decoration:none;font-weight:700;font-size:14px;padding:12px 22px;border-radius:999px;">Open PromptShare</a>
            <p style="margin:16px 0 0;font-size:12px;color:#7a7593;"><a href="${origin}" style="color:#7ee7f5;text-decoration:none;">promptshare.fun</a></p>
          </td>
        </tr>
      </table>
      <p style="margin:18px 0 0;font-size:11px;line-height:1.4;color:#8a84a3;max-width:460px;">You’re receiving this because someone used this address to sign in to PromptShare.</p>
    </td></tr>
  </table>
</body>
</html>`;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({
      from,
      to: [email],
      subject: "Your PromptShare login code",
      text,
      html,
    }),
  });
  return response.ok;
}


async function sendReportMail(
  env: AuthEnv,
  opts: {
    creationId: string;
    category: string;
    reason: string;
    reporterHandle: string;
    reporterEmail: string;
    title?: string;
  },
) {
  if (!env.RESEND_API_KEY) return false;
  const from = env.MAIL_FROM || "PromptShare <support@promptshare.fun>";
  const origin = (env.PUBLIC_ORIGIN || "https://promptshare.fun").replace(/\/$/, "");
  const to = "support@promptshare.fun";
  const plateUrl = `${origin}/p/${encodeURIComponent(opts.creationId)}`;
  const subject = `[PromptShare report] ${opts.category} — ${opts.creationId}`;
  const text = [
    "A plate was reported on PromptShare.",
    "",
    `Category: ${opts.category}`,
    `Creation: ${opts.creationId}`,
    `Title: ${opts.title || "(unknown)"}`,
    `URL: ${plateUrl}`,
    "",
    `Reporter: @${opts.reporterHandle} <${opts.reporterEmail}>`,
    "",
    "Details:",
    opts.reason,
  ].join("\n");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject, text }),
  });
  return response.ok;
}

async function finishLogin(store: Store, email: string) {
  let user = await store.getUserByEmail(email);
  if (!user) {
    const local = email.split("@")[0] || "maker";
    let handle = makePlaceholderHandle();
    while (await store.handleTaken(handle)) handle = makePlaceholderHandle();
    const display = local.replace(/[._]/g, " ").replace(/[^a-zA-Z0-9 ]/g, "").trim().slice(0, 40) || "New creator";
    user = await store.createUser({ email, handle, displayName: display || "New creator", usernameSet: false });
  }
  const session = await store.createSession(user.id);
  return { user, session };
}

export function authStatus(env: AuthEnv) {
  return {
    google: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
    microsoft: Boolean(env.MICROSOFT_CLIENT_ID && env.MICROSOFT_CLIENT_SECRET),
    email: Boolean(env.RESEND_API_KEY),
    devLink: env.DEV_AUTH === "1",
  };
}

export async function handleApi(request: Request, store: Store, env: AuthEnv): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";
  const parts = path.split("/").filter(Boolean);

  if (parts[0] !== "api") return json({ error: "Not found" }, 404);
  await store.ready();

  if (request.method === "GET" && path === "/api/health") {
    return json({
      ok: true,
      store: store.kind,
      media: store.mediaKind,
      auth: authStatus(env),
      models: MODELS,
      games: { identity: true, aiNameFilter: !!(env as any).AI },
    });
  }

  if (request.method === "GET" && parts[1] === "media" && parts[2]) {
    const file = await store.getMedia(parts[2]);
    if (!file) return json({ error: "Media not found" }, 404);
    // User uploads (profile photos): only serve known image types, never as a document or script.
    const SAFE_TYPES: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif" };
    const stored = String(file.contentType || "").toLowerCase().split(";")[0].trim();
    const ext = (parts[2].split(".").pop() || "").toLowerCase();
    const safeType = Object.values(SAFE_TYPES).includes(stored) ? stored : SAFE_TYPES[ext] || "";
    return new Response(file.bytes, {
      headers: {
        "content-type": safeType || "application/octet-stream",
        "content-disposition": safeType ? "inline" : "attachment",
        "x-content-type-options": "nosniff",
        "content-security-policy": "default-src 'none'; sandbox",
        "cache-control": "public, max-age=31536000, immutable",
      },
    });
  }

  if (request.method === "POST" && path === "/api/auth/magic") {
    const body = await readJson(request);
    const email = String(body.email || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Enter a valid email address." }, 400);
    const allowed = await store.rateLimit(`magic:${email}`, 5, 60 * 60 * 1000)
      && await store.rateLimit(`magic-ip:${clientIp(request)}`, 20, 60 * 60 * 1000);
    if (!allowed) return json({ error: "Too many sign-in codes. Try again in an hour." }, 429);
    const challenge = await store.createLoginCode(email);
    const sent = await sendLoginCodeMail(env, email, challenge.code);
    if (sent) return json({ ok: true, sent: true });
    if (env.DEV_AUTH === "1") return json({ ok: true, sent: false, devCode: challenge.code });
    return json({ ok: true, sent: false, message: "Email delivery is not configured yet. Add RESEND_API_KEY, or set DEV_AUTH=1 on a local host." });
  }

  if (request.method === "POST" && path === "/api/auth/verify-code") {
    const body = await readJson(request);
    const email = String(body.email || "").trim().toLowerCase();
    const code = String(body.code || "").trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Enter a valid email address." }, 400);
    if (!/^\d{6}$/.test(code)) return json({ error: "Enter the 6-digit code from your email." }, 400);
    const allowed = await store.rateLimit(`verify-code:${email}`, 20, 60 * 60 * 1000)
      && await store.rateLimit(`verify-code-ip:${clientIp(request)}`, 60, 60 * 60 * 1000);
    if (!allowed) return json({ error: "Too many attempts. Try again later." }, 429);
    const result = await store.verifyLoginCode(email, code);
    if (result === "expired") return json({ error: "That code has expired. Request a new one." }, 400);
    if (result === "locked") return json({ error: "Too many incorrect codes. Request a new one." }, 429);
    if (result !== "ok") return json({ error: "That code is incorrect." }, 401);
    const { user, session } = await finishLogin(store, email);
    const view = publicUserView(user);
    return json(
      { ok: true, user: view, needsUsername: view.needsUsername },
      200,
      { "set-cookie": cookie(session.id, 60 * 60 * 24 * 30, request) },
    );
  }

  if (request.method === "GET" && path === "/api/auth/verify") {
    return json({ error: "Magic links are no longer used. Enter the 6-digit code from your email on the sign-in screen." }, 410);
  }

  if (request.method === "GET" && (path === "/api/auth/google" || path === "/api/auth/microsoft")) {
    const provider = path.endsWith("google") ? "google" : "microsoft";
    const status = authStatus(env);
    if (provider === "google" && !status.google) {
      return json({ error: "Google sign-in needs GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET on the Pages project." }, 501);
    }
    if (provider === "microsoft" && !status.microsoft) {
      return json({ error: "Microsoft sign-in needs MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET on the Pages project." }, 501);
    }
    const state = await store.createOauthState(provider);
    const redirectUri = `${originOf(request, env)}/api/auth/callback/${provider}`;
    const target = provider === "google"
      ? `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(env.GOOGLE_CLIENT_ID!)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent("openid email profile")}&state=${state}&prompt=select_account`
      : `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${encodeURIComponent(env.MICROSOFT_CLIENT_ID!)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent("openid email profile User.Read")}&state=${state}&response_mode=query`;
    return Response.redirect(target, 302);
  }

  if (request.method === "GET" && parts[1] === "auth" && parts[2] === "callback" && (parts[3] === "google" || parts[3] === "microsoft")) {
    const provider = parts[3];
    const state = url.searchParams.get("state") || "";
    const code = url.searchParams.get("code") || "";
    if (!(await store.consumeOauthState(state, provider)) || !code) return json({ error: "Sign-in could not be confirmed. Try again." }, 400);
    const emailResult = provider === "google"
      ? await googleEmail(env, code, `${originOf(request, env)}/api/auth/callback/google`)
      : await microsoftEmail(env, code, `${originOf(request, env)}/api/auth/callback/microsoft`);
    const email = typeof emailResult === "string" ? emailResult : emailResult?.email;
    if (!email) {
      const detail = typeof emailResult === "object" && emailResult?.error
        ? emailResult.error
        : "The provider did not return an email address.";
      return json({ error: detail }, 400);
    }
    const { session } = await finishLogin(store, email);
    return new Response(null, {
      status: 302,
      headers: { location: "/me?welcome=1", "set-cookie": cookie(session.id, 60 * 60 * 24 * 30, request) },
    });
  }

  if (request.method === "POST" && path === "/api/auth/logout") {
    const id = readSession(request);
    if (id) await store.deleteSession(id);
    return json({ ok: true }, 200, { "set-cookie": cookie("", 0, request) });
  }

  if (request.method === "GET" && path === "/api/me") {
    const user = await viewer(store, request);
    return json({ user: user ? publicUserView(user) : null, auth: authStatus(env) });
  }

  if (request.method === "PATCH" && path === "/api/me") {
    const user = await viewer(store, request);
    if (!user) return json({ error: "Sign in first." }, 401);
    const body = await readJson(request);
    let handle = user.handle;
    let usernameSet = user.usernameSet;
    if (body.handle != null) {
      const checked = evaluateUsername(String(body.handle));
      if (!checked.ok) return json({ error: checked.error }, 400);
      handle = checked.username;
      if (await store.handleTaken(handle, user.id)) return json({ error: "That username is taken." }, 409);
      usernameSet = true;
    }
    const website = body.website != null ? String(body.website).trim() : user.website;
    if (!validHttp(website)) return json({ error: "Website must be an http(s) URL." }, 400);
    const socials = body.socials != null ? cleanSocials(body.socials) : user.socials;
    if (socials === null) return json({ error: "Add at most 3 social links, each with a label and an http(s) URL." }, 400);
    const next = await store.updateUser(user.id, {
      handle,
      usernameSet,
      displayName: clip(body.displayName != null ? String(body.displayName) : user.displayName, 40) || handle,
      bio: clip(body.bio != null ? String(body.bio) : user.bio, 280),
      website,
      socials,
    });
    return json({ user: publicUserView(next) });
  }


  if (request.method === "DELETE" && path === "/api/me") {
    const user = await viewer(store, request);
    if (!user) return json({ error: "Sign in first." }, 401);
    await store.deleteAccount(user.id);
    return json({ ok: true }, 200, { "set-cookie": cookie("", 0, request) });
  }

  if (request.method === "GET" && path === "/api/username/available") {
    const raw = url.searchParams.get("u") || "";
    const checked = evaluateUsername(raw);
    if (!checked.ok) return json({ available: false, error: checked.error, username: cleanHandle(raw) });
    const viewerUser = await viewer(store, request);
    const taken = await store.handleTaken(checked.username, viewerUser?.id);
    if (taken) return json({ available: false, error: "That username is taken.", username: checked.username });
    return json({ available: true, username: checked.username });
  }

  if (request.method === "POST" && path === "/api/username/check") {
    const body = await readJson(request);
    const checked = evaluateUsername(String(body.username || body.u || body.handle || ""));
    if (!checked.ok) return json({ available: false, error: checked.error, username: cleanHandle(String(body.username || body.u || body.handle || "")) });
    const viewerUser = await viewer(store, request);
    const taken = await store.handleTaken(checked.username, viewerUser?.id);
    if (taken) return json({ available: false, error: "That username is taken.", username: checked.username });
    return json({ available: true, username: checked.username });
  }

  if (request.method === "POST" && path === "/api/me/username") {
    const user = await viewer(store, request);
    if (!user) return json({ error: "Sign in first." }, 401);
    const body = await readJson(request);
    const checked = evaluateUsername(String(body.username || body.handle || ""));
    if (!checked.ok) return json({ error: checked.error }, 400);
    if (await store.handleTaken(checked.username, user.id)) return json({ error: "That username is taken." }, 409);
    const displayName = body.displayName != null
      ? (clip(String(body.displayName), 40) || checked.username)
      : (needsUsername(user) ? checked.username : user.displayName);
    const next = await store.updateUser(user.id, {
      handle: checked.username,
      usernameSet: true,
      displayName,
    });
    return json({ ok: true, user: publicUserView(next) });
  }

  if (request.method === "POST" && path === "/api/me/password") {
    const user = await viewer(store, request);
    if (!user) return json({ error: "Sign in first." }, 401);
    const body = await readJson(request);
    const nextPassword = String(body.password || body.newPassword || "");
    const currentPassword = String(body.currentPassword || "");
    const strength = validatePasswordStrength(nextPassword);
    if (strength) return json({ error: strength }, 400);
    if (user.passwordHash) {
      if (!currentPassword) return json({ error: "Enter your current password." }, 400);
      const ok = await verifyPassword(currentPassword, user.passwordHash, user.passwordSalt);
      if (!ok) return json({ error: "Current password is incorrect." }, 401);
    }
    const allowed = await store.rateLimit(`set-password:${user.id}`, 10, 60 * 60 * 1000);
    if (!allowed) return json({ error: "Too many password changes. Try again later." }, 429);
    const hashed = await hashPassword(nextPassword);
    const next = await store.updateUser(user.id, {
      passwordHash: hashed.hash,
      passwordSalt: hashed.salt,
      passwordUpdatedAt: new Date().toISOString(),
    });
    return json({ ok: true, user: publicUserView(next) });
  }

  if (request.method === "POST" && path === "/api/auth/password") {
    const body = await readJson(request);
    const username = cleanHandle(String(body.username || body.handle || ""));
    const password = String(body.password || "");
    if (!username || !password) return json({ error: "Enter your username and password." }, 400);
    const allowed = await store.rateLimit(`pw-login:${username}`, 20, 60 * 60 * 1000)
      && await store.rateLimit(`pw-login-ip:${clientIp(request)}`, 60, 60 * 60 * 1000);
    if (!allowed) return json({ error: "Too many sign-in attempts. Try again later." }, 429);
    const user = await store.getUserByHandle(username);
    if (!user || !user.passwordHash) {
      return json({ error: "Incorrect username or password." }, 401);
    }
    const ok = await verifyPassword(password, user.passwordHash, user.passwordSalt);
    if (!ok) return json({ error: "Incorrect username or password." }, 401);
    const session = await store.createSession(user.id);
    const view = publicUserView(user);
    return json(
      { ok: true, user: view, needsUsername: view.needsUsername },
      200,
      { "set-cookie": cookie(session.id, 60 * 60 * 24 * 30, request) },
    );
  }

  if (request.method === "POST" && path === "/api/me/avatar") {
    const user = await viewer(store, request);
    if (!user) return json({ error: "Sign in first." }, 401);
    const body = await readJson(request);
    const stored = await takeMedia(store, body.media, "image", env);
    if ("error" in stored) return json({ error: stored.error }, 400);
    const next = await store.updateUser(user.id, { avatarUrl: stored.url });
    return json({ user: publicUserView(next) });
  }

  if (request.method === "GET" && path === "/api/feed") {
    const user = await viewer(store, request);
    const q = url.searchParams.get("q") || "";
    const kindParam = (url.searchParams.get("kind") || "").toLowerCase();
    const limit = Math.min(120, Math.max(1, Number(url.searchParams.get("limit") || 40) || 40));
    const fields = (url.searchParams.get("fields") || "").toLowerCase();
    const pageRaw = Number(url.searchParams.get("page") || 0);
    const offsetParam = url.searchParams.get("offset");
    const offset = offsetParam != null && offsetParam !== ""
      ? Math.max(0, Number(offsetParam) || 0)
      : pageRaw > 1
        ? (Math.floor(pageRaw) - 1) * limit
        : 0;
    const mediaKind = kindParam === "video" ? "video" : kindParam === "image" ? "image" : q.trim() ? "all" : "image";
    const page = Math.floor(offset / limit) + 1;
    try {
      const { items, total } = await store.listFeed({
        q,
        model: url.searchParams.get("model") || "",
        tag: url.searchParams.get("tag") || "",
        following: url.searchParams.get("following") === "1",
        limit,
        offset,
        viewerId: user?.id,
        mediaKind,
      });
      const withAuthors = await attachAuthors(store, items);
      const creations = fields === "card" ? withAuthors.map(toCardFields) : withAuthors;
      const headers: Record<string, string> = {};
      if (!user && url.searchParams.get("following") !== "1" && !q.trim()) {
        headers["cache-control"] = "public, max-age=60, stale-while-revalidate=300";
      }
      return json({ creations, total, limit, offset, page }, 200, headers);
    } catch {
      // Search must never 500 for ordinary queries — empty wall beats a Worker exception.
      return json({ creations: [], total: 0, limit, offset, page });
    }
  }

  if (request.method === "GET" && path === "/api/creators") {
    try {
      return json({ creators: await store.listCreators(url.searchParams.get("q") || "") });
    } catch {
      return json({ creators: [] });
    }
  }

  if (request.method === "GET" && parts[1] === "users" && parts[2] && !parts[3]) {
    const user = await viewer(store, request);
    const profile = await store.publicUser(parts[2].toLowerCase(), user?.id);
    if (!profile) return json({ error: "No creator with that handle." }, 404);
    const includeHidden = user?.id === profile.id;
    const creations = await attachAuthors(store, await store.listByUser(profile.id, user?.id, includeHidden));
    return json({ profile, creations });
  }

  if (request.method === "GET" && parts[1] === "creations" && parts[2] && !parts[3]) {
    const user = await viewer(store, request);
    const creation = await store.getCreation(parts[2], user?.id);
    if (!creation || creation.hidden) return json({ error: "That creation is not available." }, 404);
    if (creation.visibility === "unlisted" && user?.id !== creation.userId) {
      /* unlisted is reachable by link */
    }
    const [card] = await attachAuthors(store, [creation]);
    return json({ creation: card });
  }

  if (request.method === "POST" && path === "/api/creations") {
    // Gallery-only pivot: public visitor publishing disabled (auth may stay dormant).
    return json({ error: "Public uploads are closed. PromptShare is a curated educational gallery." }, 403);
    const user = await viewer(store, request);
    if (!user) return json({ error: "Sign in first." }, 401);
    if (!(await store.rateLimit(`upload:${user.id}`, 20, 60 * 60 * 1000))) return json({ error: "Upload limit reached for this hour." }, 429);
    const body = await readJson(request);
    const prompt = String(body.prompt || "").trim();
    const model = clip(String(body.model || "").trim(), 80);
    const title = clip(String(body.title || "").trim(), 80);
    if (!prompt) return json({ error: "The final prompt is required. Paste the exact prompt that produced this image." }, 400);
    if (prompt.length < 3) return json({ error: "Add the exact prompt that produced this image (at least a few words)." }, 400);
    // Model is optional; prompt + image remain the required pair
    const blocked = prohibitedContent(prompt, title, model, JSON.stringify(body.tags || ""), JSON.stringify(body.steps || []));
    if (blocked) return json({ error: blocked }, 400);
    const stored = await takeMedia(store, body.media, "image", env);
    if ("error" in stored) return json({ error: stored.error }, 400);
    const visibility: Visibility = body.visibility === "unlisted" ? "unlisted" : "public";
    const steps = Array.isArray(body.steps) ? body.steps.slice(0, 8).map((step: { prompt?: string; model?: string; note?: string }) => ({
      position: 0,
      prompt: clip(String(step?.prompt || ""), 4000),
      model: clip(String(step?.model || model), 60),
      note: clip(String(step?.note || ""), 200),
    })).filter((step: { prompt: string }) => step.prompt.length > 0) : [];
    const creation = await store.createCreation({
      id: crypto.randomUUID(),
      userId: user.id,
      title: title || "Untitled",
      prompt: clip(prompt, 8000),
      model,
      tags: cleanTags(body.tags),
      visibility,
      mediaUrl: stored.url,
      mediaKind: stored.kind,
      featured: false,
      hidden: false,
      createdAt: new Date().toISOString(),
      steps,
    });
    const [card] = await attachAuthors(store, [creation]);
    return json({ creation: card }, 201);
  }

  if (request.method === "POST" && parts[1] === "creations" && parts[2] && parts[3] === "feature") {
    const user = await viewer(store, request);
    if (!user) return json({ error: "Sign in first." }, 401);
    const creation = await store.getCreation(parts[2], user.id);
    if (!creation || creation.userId !== user.id) return json({ error: "Not your creation." }, 404);
    await store.setFeatured(user.id, creation.id);
    return json({ ok: true });
  }

  if (request.method === "POST" && parts[1] === "creations" && parts[2] && parts[3] === "hide") {
    const user = await viewer(store, request);
    if (!user) return json({ error: "Sign in first." }, 401);
    const ok = await store.hideCreation(user.id, parts[2]);
    if (!ok) return json({ error: "Not your creation." }, 404);
    return json({ ok: true });
  }

  if (request.method === "POST" && parts[1] === "creations" && parts[2] && (parts[3] === "like" || parts[3] === "save")) {
    const user = await viewer(store, request);
    if (!user) return json({ error: "Sign in first." }, 401);
    const creation = await store.getCreation(parts[2], user.id);
    if (!creation || creation.hidden) return json({ error: "That creation is not available." }, 404);
    const result = parts[3] === "like" ? await store.toggleLike(user.id, parts[2]) : await store.toggleSave(user.id, parts[2]);
    return json(result);
  }

  if (request.method === "POST" && parts[1] === "creations" && parts[2] && parts[3] === "report") {
    const user = await viewer(store, request);
    if (!user) return json({ error: "Sign in first." }, 401);
    const body = await readJson(request);
    const category = String(body.category || body.reasonCategory || "other").trim().toLowerCase();
    const allowed = new Set<string>(REPORT_CATEGORIES as unknown as string[]);
    const cat = allowed.has(category) ? category : "other";
    const reasonRaw = clip(String(body.reason || "").trim(), 400);
    if (reasonRaw.length < 3) return json({ error: "Say briefly what is wrong." }, 400);
    const reason = `[${cat}] ${reasonRaw}`;
    const creationId = parts[2];
    await store.report({ id: crypto.randomUUID(), creationId, reporterId: user.id, reason, createdAt: new Date().toISOString() });
    const creation = await store.getCreation(creationId, user.id);
    // Always accept the report; email is best-effort triage to the public inbox.
    await sendReportMail(env, {
      creationId,
      category: cat,
      reason: reasonRaw,
      reporterHandle: user.handle,
      reporterEmail: user.email,
      title: creation?.title,
    });
    return json({ ok: true, category: cat });
  }

  if (request.method === "POST" && parts[1] === "users" && parts[2] && parts[3] === "follow") {
    const user = await viewer(store, request);
    if (!user) return json({ error: "Sign in first." }, 401);
    const target = await store.getUserByHandle(parts[2].toLowerCase());
    if (!target) return json({ error: "No creator with that handle." }, 404);
    if (target.id === user.id) return json({ error: "You cannot follow yourself." }, 400);
    const body = await readJson(request);
    await store.setFollow(user.id, target.id, body.follow !== false);
    const profile = await store.publicUser(target.handle, user.id);
    return json({ profile });
  }

  return json({ error: "Not found" }, 404);
}


function toCardFields(card: Creation & {
  author?: { handle: string; displayName: string; avatarUrl: string } | null;
  imageURL?: string;
  poster?: string;
}) {
  const mediaUrl = appMediaUrl(card);
  const poster = curatedPoster(card);
  const preview = card.mediaKind === "video" ? poster || mediaUrl : mediaUrl;
  return {
    id: card.id,
    title: card.title,
    prompt: cleanDisplayPrompt(card.prompt),
    model: card.model,
    modelVersion: card.modelVersion || "",
    displayModel: displayModel(card),
    tags: card.tags,
    mediaUrl,
    mediaKind: card.mediaKind,
    imageURL: mediaUrl,
    poster,
    thumbUrl: gridThumbUrl(preview),
  };
}

async function attachAuthors(store: Store, items: Creation[]) {
  const cache = new Map<string, Awaited<ReturnType<Store["getUserById"]>>>();
  const ids = [...new Set(items.map((item) => item.userId))];
  await Promise.all(
    ids.map(async (id) => {
      cache.set(id, await store.getUserById(id));
    }),
  );
  return items.map((item) => {
    const author = cache.get(item.userId);
    const card = {
      ...item,
      author: author ? { handle: author.handle, displayName: author.displayName, avatarUrl: author.avatarUrl } : null,
    };
    return {
      ...card,
      prompt: cleanDisplayPrompt(card.prompt),
      modelVersion: card.modelVersion || "",
      displayModel: displayModel(card),
      imageURL: appMediaUrl(card),
      poster: curatedPoster(card),
      thumbUrl: gridThumbUrl(card.mediaKind === "video" ? curatedPoster(card) || appMediaUrl(card) : appMediaUrl(card)),
      creatorHandle: card.author?.handle || "",
      notes: [...card.steps]
        .sort((a, b) => a.position - b.position)
        .map((s) => ({ id: s.id, position: s.position, prompt: s.prompt, model: s.model, text: s.note || "", note: s.note || "" })),
      plate: plateAppFields(card),
    };
  });
}

function clip(value: string, max: number) {
  return value.trim().slice(0, max);
}

function cleanTags(value: unknown) {
  const list = Array.isArray(value) ? value : String(value || "").split(",");
  const tags: string[] = [];
  for (const item of list) {
    const tag = String(item).trim().toLowerCase().replace(/^#/, "").slice(0, 24);
    if (tag && !tags.includes(tag)) tags.push(tag);
    if (tags.length === 8) break;
  }
  return tags;
}

function cleanSocials(value: unknown): SocialLink[] | null {
  if (!Array.isArray(value)) return null;
  if (value.length > 3) return null;
  const socials: SocialLink[] = [];
  for (const item of value) {
    const label = clip(String((item as SocialLink)?.label || ""), 24);
    const url = String((item as SocialLink)?.url || "").trim();
    if (!label && !url) continue;
    if (!label || !validHttp(url) || !url) return null;
    socials.push({ label, url });
  }
  return socials;
}

async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const data = await request.json();
    return data && typeof data === "object" ? data as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

async function takeMedia(store: Store, raw: unknown, force: MediaKind | null, env?: AuthEnv): Promise<{ url: string; kind: MediaKind } | { error: string }> {
  const media = raw as { name?: string; type?: string; data?: string } | null;
  if (!media?.data) return { error: "Choose an image." };
  const name = String(media.name || "upload");
  const type = String(media.type || "");
  const ext = imageExt(type, name);
  if (!ext) return { error: "PromptShare accepts images only: JPEG, PNG, WebP, or GIF." };
  if (force && force !== "image") return { error: "PromptShare accepts images only: JPEG, PNG, WebP, or GIF." };
  let bytes: Uint8Array;
  try {
    const binary = atob(media.data);
    bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  } catch {
    return { error: "That file could not be read." };
  }
  if (bytes.byteLength > IMAGE_LIMIT) return { error: "Images are limited to 8 MB." };
  if (env) {
    const nsfw = await checkSightengineNsfw(env, bytes, type || `image/${ext === "jpg" ? "jpeg" : ext}`, name);
    if (nsfw) return { error: nsfw };
  }
  const url = await store.putMedia(bytes, type || `image/${ext === "jpg" ? "jpeg" : ext}`, ext);
  return { url, kind: "image" };
}

async function googleEmail(env: AuthEnv, code: string, redirectUri: string) {
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID || "",
      client_secret: env.GOOGLE_CLIENT_SECRET || "",
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!tokenRes.ok) return null;
  const token = await tokenRes.json() as { access_token?: string };
  if (!token.access_token) return null;
  const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", { headers: { authorization: `Bearer ${token.access_token}` } });
  if (!profileRes.ok) return null;
  const profile = await profileRes.json() as { email?: string };
  return profile.email?.toLowerCase() || null;
}

function emailFromJwt(idToken?: string) {
  if (!idToken) return null;
  try {
    const payload = idToken.split(".")[1];
    if (!payload) return null;
    const b64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    const json = JSON.parse(atob(padded)) as {
      email?: string;
      preferred_username?: string;
      upn?: string;
      unique_name?: string;
    };
    const raw = json.email || json.preferred_username || json.upn || json.unique_name || "";
    return looksLikeEmail(raw) ? raw.toLowerCase() : null;
  } catch {
    return null;
  }
}

function looksLikeEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function pickMicrosoftEmail(input: {
  mail?: string | null;
  userPrincipalName?: string | null;
  otherMails?: string[] | null;
  email?: string | null;
  preferred_username?: string | null;
}) {
  const candidates = [
    input.mail,
    input.email,
    input.preferred_username,
    ...(input.otherMails || []),
    input.userPrincipalName,
  ];
  for (const candidate of candidates) {
    if (candidate && looksLikeEmail(candidate)) return candidate.toLowerCase();
  }
  return null;
}

async function microsoftEmail(env: AuthEnv, code: string, redirectUri: string): Promise<string | { error: string }> {
  const tokenRes = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.MICROSOFT_CLIENT_ID || "",
      client_secret: env.MICROSOFT_CLIENT_SECRET || "",
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!tokenRes.ok) {
    let hint = `Microsoft token exchange failed (${tokenRes.status}).`;
    try {
      const err = await tokenRes.json() as { error?: string; error_description?: string };
      if (err.error === "invalid_client") {
        hint = "Microsoft rejected the app secret. In Entra → Certificates & secrets, copy the secret Value (not the Secret ID) and update MICROSOFT_CLIENT_SECRET.";
      } else if (err.error_description) {
        hint = `Microsoft sign-in failed: ${err.error_description}`;
      } else if (err.error) {
        hint = `Microsoft sign-in failed: ${err.error}`;
      }
    } catch { /* ignore */ }
    return { error: hint };
  }
  const token = await tokenRes.json() as { access_token?: string; id_token?: string };
  const fromId = emailFromJwt(token.id_token);
  if (fromId) return fromId;
  if (!token.access_token) return { error: "Microsoft did not return an access token." };

  const headers = { authorization: `Bearer ${token.access_token}` };
  const profileRes = await fetch(
    "https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName,otherMails",
    { headers },
  );
  if (profileRes.ok) {
    const profile = await profileRes.json() as {
      mail?: string;
      userPrincipalName?: string;
      otherMails?: string[];
    };
    const picked = pickMicrosoftEmail(profile);
    if (picked) return picked;
  }

  const userInfoRes = await fetch("https://graph.microsoft.com/oidc/userinfo", { headers });
  if (userInfoRes.ok) {
    const info = await userInfoRes.json() as { email?: string; preferred_username?: string };
    const picked = pickMicrosoftEmail(info);
    if (picked) return picked;
  }
  return { error: "Microsoft signed you in but did not provide an email on the profile. Add the email optional claim under Token configuration, then try again." };
}

export function creationMeta(creation: { title: string; prompt: string; author?: { displayName: string } | null }) {
  const title = `${creation.title} — PromptShare`;
  const description = cleanDisplayPrompt(creation.prompt).slice(0, 180);
  return { title, description };
}
