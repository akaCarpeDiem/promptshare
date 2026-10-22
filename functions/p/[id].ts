import { createD1Store, type D1Database, type R2Bucket } from "../lib/d1.ts";
import type { AuthEnv, Creation, User } from "../lib/types.ts";
import { displayModel } from "../lib/modelLabel.ts";
import { cleanDisplayPrompt } from "../lib/promptClean.ts";
import { dimsOf } from "../lib/mediaDims.ts";
// The same marking the browser does (overlay/app/marks.js), done here so the marked phrases and
// their explanations are in the HTML that crawlers and no-JS readers get.
import { compileLexicon, segment, renderPrompt } from "../../overlay/app/marks.js";
import { ROLES, ROLE } from "../../overlay/app/roles.js";
import NOTES from "../../overlay/data/notes.json" with { type: "json" };
import LEXICON from "../../overlay/data/lexicon.json" with { type: "json" };

let matcher: ReturnType<typeof compileLexicon> | null = null;
function marksFor(id: string, prompt: string) {
  matcher ||= compileLexicon(LEXICON as any);
  return segment(prompt, (NOTES as Record<string, any[]>)[id] || [], matcher) as any[];
}

interface Env extends AuthEnv {
  DB?: D1Database;
  MEDIA?: R2Bucket;
  ASSETS: { fetch(input: Request | URL): Promise<Response> };
}

const CANONICAL = "https://promptshare.co";

export const onRequest = async (context: {
  request: Request;
  env: Env;
  params: { id?: string };
}) => {
  const id = String(context.params.id || "").trim();
  const pageUrl = new URL(context.request.url);
  const canonical = `${CANONICAL}/p/${encodeURIComponent(id)}`;

  if (!id || !context.env.DB) {
    return notFound(context, pageUrl);
  }

  const store = createD1Store(context.env.DB, context.env.MEDIA);
  await store.ready();
  const creation = await store.getCreation(id);
  if (!creation || creation.hidden) {
    return notFound(context, pageUrl);
  }

  const author = await store.getUserById(creation.userId);
  const isUnlisted = creation.visibility === "unlisted";
  const titleBase = (creation.title || creation.prompt.slice(0, 60) || "Plate").trim();
  const docTitle = `${titleBase} — PromptShare`;
  const description = buildDescription(creation, author);
  const imageAbs =
    creation.mediaKind === "image"
      ? new URL(creation.mediaUrl, CANONICAL).toString()
      : creation.mediaKind === "video"
        ? new URL(appPosterUrl(creation), CANONICAL).toString()
        : `${CANONICAL}/og.png`;
  const alt = escapeHtml(creation.title || creation.prompt.slice(0, 120) || "Plate image");

  const asset = await context.env.ASSETS.fetch(new URL("/index.html", pageUrl));
  let html = await asset.text();

  // Strip default homepage title/description/canonical/og so plate tags win
  html = html
    .replace(/<title>[\s\S]*?<\/title>/i, "")
    .replace(/<meta\s+name="description"[^>]*>/i, "")
    .replace(/<link\s+rel="canonical"[^>]*>/i, "")
    .replace(/<meta\s+name="robots"[^>]*>/i, "")
    .replace(/<meta\s+property="og:url"[^>]*>/i, "")
    .replace(/<meta\s+property="og:title"[^>]*>/i, "")
    .replace(/<meta\s+property="og:description"[^>]*>/i, "")
    .replace(/<meta\s+property="og:image"[^>]*>/i, "")
    .replace(/<meta\s+property="og:type"[^>]*>/i, "")
    .replace(/<meta\s+name="twitter:title"[^>]*>/i, "")
    .replace(/<meta\s+name="twitter:description"[^>]*>/i, "")
    .replace(/<meta\s+name="twitter:image"[^>]*>/i, "");

  const robots = isUnlisted ? "noindex,nofollow" : "index,follow";
  const jsonLd = buildJsonLd(creation, author, canonical, imageAbs);
  const headInject = `
    <title>${escapeHtml(docTitle)}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <meta name="robots" content="${robots}" />
    <link rel="canonical" href="${escapeHtml(canonical)}" />
    <meta property="og:type" content="article" />
    <meta property="og:url" content="${escapeHtml(canonical)}" />
    <meta property="og:title" content="${escapeHtml(docTitle)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:image" content="${escapeHtml(imageAbs)}" />
    <meta name="twitter:title" content="${escapeHtml(docTitle)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="${escapeHtml(imageAbs)}" />
    <script type="application/ld+json">${jsonLd}</script>
  `;

  html = html.replace("</head>", `${headInject}</head>`);

  // The home document is the shell for every gallery page. Put this plate inside #root so
  // crawlers and the first paint get the picture and its prompt; /app/app.js then redraws it
  // with the marked phrases and notes. The markup mirrors overlay/app/views/plate.js.
  html = swapRoot(
    html,
    renderPlateBody(creation, alt),
    "The picture, its prompt and the notes are above. Copying the prompt and stepping between plates need JavaScript.",
  );

  return new Response(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": isUnlisted ? "private, max-age=60" : "public, max-age=120",
    },
  });
};

async function notFound(
  context: { env: Env; request: Request },
  pageUrl: URL,
): Promise<Response> {
  const asset = await context.env.ASSETS.fetch(new URL("/index.html", pageUrl));
  let html = await asset.text();
  html = html
    .replace(/<title>[\s\S]*?<\/title>/i, "<title>Not found — PromptShare</title>")
    .replace(/<meta\s+name="robots"[^>]*>/i, '<meta name="robots" content="noindex" />');
  if (!/name="robots"/.test(html)) {
    html = html.replace("</head>", '<meta name="robots" content="noindex" /></head>');
  }
  html = swapRoot(
    html,
    `<main class="wrap" id="main"><div class="status"><h1 class="h2">This plate isn't available</h1><p>It may have been removed. <a href="/images/">Browse images</a> or <a href="/videos/">videos</a>.</p></div></main>`,
    "",
  );
  return new Response(html, {
    status: 404,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=60" },
  });
}

/**
 * Replace the contents of #root (and the <noscript> right after it) in the shell document.
 * scripts/build-site.mjs writes that pair as `<div id="root">…</div>` directly followed by `<noscript>…</noscript>`.
 */
function swapRoot(html: string, body: string, noscript: string): string {
  return html.replace(
    /<div id="root">[\s\S]*?<\/div>\s*<noscript>[\s\S]*?<\/noscript>/,
    () => `<div id="root">${body}</div>\n    <noscript>${noscript ? `<p class="wrap fine" style="padding-block:16px">${noscript}</p>` : ""}</noscript>`,
  );
}

function buildDescription(creation: Creation, _author: User | null): string {
  const modelLabel = displayModel(creation);
  const model = modelLabel ? ` Model: ${modelLabel}.` : "";
  const head = `${creation.title || "Plate"}.${model} Prompt: `;
  return head + wholePhrases(cleanDisplayPrompt(creation.prompt), Math.max(60, 180 - head.length));
}

/** As much of the prompt as fits in `max` characters, cut after a whole comma-separated phrase. */
function wholePhrases(prompt: string, max: number): string {
  const text = prompt.replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  const parts = text.split(/,\s*/);
  let out = "";
  for (const part of parts) {
    const next = out ? `${out}, ${part}` : part;
    if (next.length > max - 1) break;
    out = next;
  }
  if (!out) {
    // One very long phrase: stop at the last whole word.
    out = text.slice(0, max - 1).replace(/\s+\S*$/, "");
  }
  return `${out.replace(/[,;:\s]+$/, "")}…`;
}

function buildJsonLd(
  creation: Creation,
  _author: User | null,
  canonical: string,
  imageAbs: string,
): string {
  const prompt = cleanDisplayPrompt(creation.prompt);
  const dims = dimsOf(creation.id);
  const studio = { "@type": "Organization", name: "PromptShare studio", url: CANONICAL };
  const notes = ((NOTES as Record<string, Array<{ phrase: string; means: string }>>)[creation.id] || [])
    .map((n) => `${n.phrase}: ${n.means}`)
    .join(" ");
  const obj: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: creation.title || prompt.slice(0, 80),
    url: canonical,
    text: prompt,
    description: wholePhrases(prompt, 300),
    image: imageAbs,
    dateCreated: creation.createdAt,
    keywords: creation.tags?.join(", ") || undefined,
    creator: studio,
    publisher: { "@type": "Organization", name: "PromptShare", url: CANONICAL },
    isAccessibleForFree: true,
  };
  const modelLabel = displayModel(creation);
  if (modelLabel) {
    obj.additionalProperty = [{ "@type": "PropertyValue", name: "model", value: modelLabel }];
  }
  if (notes) obj.comment = notes;
  obj.associatedMedia =
    creation.mediaKind === "video"
      ? {
          "@type": "VideoObject",
          name: creation.title || "Plate video",
          description: wholePhrases(prompt, 200),
          contentUrl: new URL(creation.mediaUrl, CANONICAL).toString(),
          thumbnailUrl: new URL(appPosterUrl(creation), CANONICAL).toString(),
          uploadDate: creation.createdAt,
          width: dims.width,
          height: dims.height,
          creator: studio,
        }
      : {
          "@type": "ImageObject",
          contentUrl: imageAbs,
          name: creation.title || "Plate image",
          caption: wholePhrases(prompt, 200),
          width: dims.width,
          height: dims.height,
          creator: studio,
          creditText: "PromptShare studio",
        };
  return JSON.stringify(obj).replace(/</g, "\\u003c");
}

function renderPlateBody(creation: Creation, alt: string): string {
  const video = creation.mediaKind === "video";
  const home = video ? "/videos/" : "/images/";
  const mediaUrl = appMediaUrl(creation);
  // preload="none": the app swaps in its own player a moment later, so don't fetch the clip twice.
  const { width, height } = dimsOf(creation.id);
  const media = video
    ? `<video src="${escapeHtml(platePreviewUrl(mediaUrl))}" poster="${escapeHtml(appPosterUrl(creation))}" controls playsinline preload="none" width="${width}" height="${height}"></video>`
    : `<img src="${escapeHtml(mediaUrl)}" alt="${alt}" width="${width}" height="${height}" decoding="async" fetchpriority="high">`;
  const prompt = cleanDisplayPrompt(creation.prompt);
  const segments = marksFor(creation.id, prompt);
  const marks = segments.filter((m) => m.role);
  const rolesUsed = ROLES.filter((r) => marks.some((m) => m.role === r.id));
  const seen = new Set<string>();
  const listed = marks.filter((m) => {
    const key = m.note ? "n:" + m.n : "t:" + m.term.t;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const written = listed.filter((m) => m.note).length;
  const noteItem = (m: any) => {
    const role = (ROLE as Record<string, { name: string }>)[m.role];
    const means = m.note ? m.note.means : m.term.means;
    const inner = `<span><span class="note-kind">${escapeHtml(role.name)}</span><span class="note-phrase">${escapeHtml(m.text)}</span><span class="note-means">${escapeHtml(means)}</span></span>`;
    return m.note
      ? `<li><div class="note" data-role="${m.role}" data-n="${m.n}">${inner}</div></li>`
      : `<li><a class="note" data-role="${m.role}" data-n="${m.n}" href="/words/?w=${encodeURIComponent(m.term.t)}">${inner}</a></li>`;
  };
  const modelLabel = displayModel(creation);
  return `<main class="wrap" id="main">
  <nav class="crumbs" aria-label="Where you are"><a href="${home}">${video ? "Videos" : "Images"}</a></nav>
  <article class="plate">
    <div class="stage"><figure class="stage-media">${media}</figure></div>
    <div class="reading">
      <h1 class="h1">${escapeHtml(creation.title || "Untitled")}</h1>
      <p class="facts">${modelLabel ? `<span class="tag">${escapeHtml(modelLabel)}</span>` : ""}<span class="tag">${video ? "Video" : "Image"}</span></p>
      <section class="panel" aria-label="The prompt">
        <div class="panel-head"><h2>The prompt</h2></div>
        <p class="prompt" id="prompt">${renderPrompt(segments)}</p>
        ${rolesUsed.length ? `<ul class="legend">${rolesUsed.map((r) => `<li data-role="${r.id}"><i></i>${escapeHtml(r.name)}</li>`).join("")}</ul>` : ""}
      </section>
      ${listed.length ? `<section class="notes">
        <h2 class="h2">What each part does</h2>
        <p class="fine">${written ? "Notes are PromptShare's reading of this prompt, not the creator's commentary." : "These are general notes on common prompt phrases, not a study of this picture."}</p>
        <ol>${listed.map(noteItem).join("")}</ol>
      </section>` : ""}
      <p class="fine disclaimer">A study pair: this file, this prompt. Outputs can be fictional or stylised, and running the same prompt again will not give the same result.</p>
    </div>
  </article>
</main>`;
}

function appPosterUrl(creation: Pick<Creation, "mediaKind" | "mediaUrl">): string {
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
  // Keep any ?v= cache-buster: the old /\.(mp4)$/ test missed URLs that carry one and left ".mp4" posters (404).
  return creation.mediaUrl.replace("/media/video/", "/media/posters/").replace(/\.(webm|mp4|mov)(\?|$)/i, ".jpg$2");
}

/** Default inline playback = 720p@60 proxy (R2 media/video-preview/). Master stays in data-ps-master
 *  for fullscreen upgrade / error fallback (client: ps-gallery-v1-20261006browse1.js). */
function platePreviewUrl(master: string): string {
  const m = /^\/media\/video\/([^/?#]+\.mp4)(\?[^#]*)?$/i.exec(master || "");
  if (!m) return master;
  return `/media/video-preview/${m[1]}${m[2] ? m[2] + "&" : "?"}pv=720a`;
}

function appMediaUrl(creation: Pick<Creation, "mediaKind" | "mediaUrl">): string {
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/landscapes-rice-terrace.mp4") {
    return `${creation.mediaUrl}?v=20261002rice1`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/landscapes-salt-flat.mp4") {
    return `${creation.mediaUrl}?v=20261002salt1`;
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
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/landscapes-waterfall-gorge.mp4") {
    return `${creation.mediaUrl}?v=20261002waterfall1`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/landscapes-tropical-lagoon.mp4") {
    return `${creation.mediaUrl}?v=20261002lagoon1`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/landscapes-marsh-sunrise.mp4") {
    return `${creation.mediaUrl}?v=20261002marsh1`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/landscapes-slot-canyon.mp4") {
    return `${creation.mediaUrl}?v=20261002slotcanyon1`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/landscapes-chalk-cliff.mp4") {
    return `${creation.mediaUrl}?v=20261002chalk1`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/landscapes-glacier-lake.mp4") {
    return `${creation.mediaUrl}?v=20261002glacier1`;
  }
  if (creation.mediaKind === "video" && creation.mediaUrl === "/media/video/landscapes-alpine-tarn.mp4") {
    return `${creation.mediaUrl}?v=20261002alpine1`;
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

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char] || char),
  );
}
