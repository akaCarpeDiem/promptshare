import { createD1Store, type D1Database, type R2Bucket } from "../lib/d1.ts";
import type { AuthEnv, Creation, User } from "../lib/types.ts";
import { displayModel } from "../lib/modelLabel.ts";

interface Env extends AuthEnv {
  DB?: D1Database;
  MEDIA?: R2Bucket;
  ASSETS: { fetch(input: Request | URL): Promise<Response> };
}

const CANONICAL = "https://promptshare.fun";

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
    <meta property="og:site_name" content="PromptShare" />
    <meta property="og:url" content="${escapeHtml(canonical)}" />
    <meta property="og:title" content="${escapeHtml(docTitle)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:image" content="${escapeHtml(imageAbs)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(docTitle)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="${escapeHtml(imageAbs)}" />
    <script type="application/ld+json">${jsonLd}</script>
    <script>document.documentElement.setAttribute("data-ps-plate-kind", ${JSON.stringify(creation.mediaKind === "video" ? "video" : "image")});</script>
  `;

  html = html.replace("</head>", `${headInject}</head>`);

  const bodyHtml = renderPlateBody(creation, author, imageAbs, alt, canonical);
  // Replace homepage SSR inside #root with plate content (crawlers + first paint)
  html = html.replace(
    /<div id="root">[\s\S]*?<\/div>\s*<noscript>[\s\S]*?<\/noscript>/,
    `<div id="root">${bodyHtml}</div>
    <noscript>${bodyHtml}</noscript>`,
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
  const body = `<main style="font-family:system-ui,sans-serif;max-width:42rem;margin:2rem auto;padding:0 1.25rem;color:#f4f1ff;background:#1a1b26">
    <h1>Plate not found</h1>
    <p>This plate is unavailable or was never public.</p>
    <p><a href="/" style="color:#7ee7f5">Back to PromptShare</a></p>
  </main>`;
  html = html.replace(
    /<div id="root">[\s\S]*?<\/div>\s*<noscript>[\s\S]*?<\/noscript>/,
    `<div id="root">${body}</div><noscript>${body}</noscript>`,
  );
  return new Response(html, {
    status: 404,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=60" },
  });
}

function buildDescription(creation: Creation, author: User | null): string {
  const who = author ? ` by ${author.displayName}` : "";
  const modelLabel = displayModel(creation);
  const model = modelLabel ? ` Model: ${modelLabel}.` : "";
  const excerpt = creation.prompt.replace(/\s+/g, " ").trim().slice(0, 140);
  return `${creation.title || "Plate"}${who}.${model} Prompt: ${excerpt}`.slice(0, 180);
}

function buildJsonLd(
  creation: Creation,
  author: User | null,
  canonical: string,
  imageAbs: string,
): string {
  const steps = [...creation.steps].sort((a, b) => a.position - b.position);
  const notes = steps
    .map((s) => s.note)
    .filter(Boolean)
    .join(" ");
  const obj: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: creation.title || creation.prompt.slice(0, 80),
    url: canonical,
    text: creation.prompt,
    description: creation.prompt.slice(0, 300),
    image: imageAbs,
    dateCreated: creation.createdAt,
    keywords: creation.tags?.join(", ") || undefined,
  };
  const modelLabel = displayModel(creation);
  if (modelLabel) {
    obj.creativeWorkStatus = modelLabel;
    obj.additionalProperty = [
      { "@type": "PropertyValue", name: "model", value: modelLabel },
    ];
  }
  if (author) {
    obj.author = {
      "@type": "Person",
      name: author.displayName,
      url: `${CANONICAL}/u/${encodeURIComponent(author.handle)}`,
      alternateName: `@${author.handle}`,
    };
  }
  if (notes) obj.comment = notes;
  // Also expose ImageObject for share scrapers
  obj.associatedMedia = {
    "@type": "ImageObject",
    contentUrl: imageAbs,
    name: creation.title || "Plate image",
    caption: creation.prompt.slice(0, 200),
    author: author
      ? { "@type": "Person", name: author.displayName }
      : undefined,
  };
  return JSON.stringify(obj).replace(/</g, "\\u003c");
}

function renderPlateBody(
  creation: Creation,
  author: User | null,
  imageAbs: string,
  alt: string,
  canonical: string,
): string {
  const steps = [...creation.steps].sort((a, b) => a.position - b.position);
  const hasBreakdown = steps.length > 0;
  const published = creation.createdAt
    ? `<p class="plate-date">Published <time datetime="${escapeHtml(creation.createdAt)}">${escapeHtml(formatPlateDate(creation.createdAt))}</time></p>`
    : "";
  const breakdown =
    hasBreakdown
      ? `<section aria-label="Breakdown" id="plate-breakdown-section">
          <h2>Breakdown</h2>
          <p class="fine" style="opacity:.85">PromptShare interpretations of earlier steps — not the creator’s commentary. Notes are written when provided; we do not invent filler linguistics.</p>
          <ol>${steps
            .map(
              (s, i) => `<li>
              <h3>Step ${i + 1}${s.model ? ` · ${escapeHtml(s.model)}` : ""}</h3>
              ${s.note ? `<p><em>PromptShare interpretation:</em> ${escapeHtml(s.note)}</p>` : `<p style="opacity:.75">Breakdown not written yet for this step.</p>`}
              <pre style="white-space:pre-wrap;word-break:break-word">${escapeHtml(s.prompt)}</pre>
            </li>`,
            )
            .join("")}</ol>
        </section>`
      : `<section aria-label="Breakdown" id="plate-breakdown-section">
          <h2>Breakdown</h2>
          <p><strong>Breakdown not written yet.</strong> Word-level study notes are PromptShare interpretations when present — not the creator’s commentary. This plate has no notes yet.</p>
        </section>`;

  const credit = author
    ? `<p>Creator: <a href="/u/${escapeHtml(author.handle)}" style="color:#7ee7f5">${escapeHtml(author.displayName)}</a> (@${escapeHtml(author.handle)})</p>`
    : "";

  const modelLabel = displayModel(creation);
  const model = modelLabel
    ? `<p>Model: <strong>${escapeHtml(modelLabel)}</strong></p>`
    : "";
  const mediaUrl = appMediaUrl(creation);
  const mediaMarkup =
    creation.mediaKind === "video"
      ? `<video class="ps-plate-video" src="${escapeHtml(platePreviewUrl(mediaUrl))}" data-ps-master="${escapeHtml(mediaUrl)}" poster="${escapeHtml(appPosterUrl(creation))}" controls playsinline webkit-playsinline preload="auto" width="1200" style="max-width:100%;height:auto;border-radius:12px"></video><script>try{if(localStorage.getItem("ps-video-quality")==="1080"){var v=document.currentScript.previousElementSibling;if(v&&v.dataset.psMaster)v.src=v.dataset.psMaster}}catch(e){}</script>`
      : `<img src="${escapeHtml(mediaUrl)}" alt="${alt}" width="1200" style="max-width:100%;height:auto;border-radius:12px" />`;

  return `<article class="net-page creation" data-ps-media-kind="${escapeHtml(creation.mediaKind || "image")}" style="font-family:system-ui,sans-serif;max-width:48rem;margin:1.5rem auto;padding:0 1.25rem 3rem;color:#f4f1ff;background:#1a1b26">
    <p class="kicker" style="opacity:.75">${creation.visibility === "unlisted" ? "Unlisted" : "Public"} plate</p>
    <h1>${escapeHtml(creation.title || "Untitled")}</h1>
    ${credit}
    ${published}
    ${model}
    <figure style="margin:1.25rem 0">
${mediaMarkup}
    </figure>
    <section aria-label="Final prompt">
      <h2>The prompt</h2>
      <pre id="plate-prompt" style="white-space:pre-wrap;word-break:break-word;background:#12131c;padding:1rem;border-radius:10px;border:1px solid #2a2b3a">${escapeHtml(creation.prompt)}</pre>
      <p style="display:flex;flex-wrap:wrap;gap:.5rem;margin-top:.75rem">
        <button type="button" class="btn btn-line" data-copy-prompt>Copy prompt</button>
        <button type="button" class="btn btn-ghost" data-copy-link="${escapeHtml(canonical)}">Copy link</button>
        <a class="btn btn-ghost" href="#plate-breakdown" style="color:#7ee7f5">Open breakdown</a>
      </p>
      <script>
        (function(){
          var p=document.getElementById('plate-prompt');
          document.querySelectorAll('[data-copy-prompt]').forEach(function(b){
            b.addEventListener('click',function(){ if(p) navigator.clipboard.writeText(p.innerText); });
          });
          document.querySelectorAll('[data-copy-link]').forEach(function(b){
            b.addEventListener('click',function(){ navigator.clipboard.writeText(b.getAttribute('data-copy-link')||location.href); });
          });
        })();
      </script>
    </section>
    <div id="plate-breakdown">${breakdown}</div>
    <p style="margin-top:1.5rem;opacity:.9">
      <a href="${escapeHtml(canonical)}" style="color:#7ee7f5">Report this plate</a>
      — open the interactive view and sign in to submit an in-app report, or email
      <a href="mailto:support@promptshare.fun?subject=${encodeURIComponent("Report plate " + creation.id)}" style="color:#7ee7f5">support@promptshare.fun</a>.
    </p>
    <p style="margin-top:1rem;opacity:.8"><a href="/" style="color:#7ee7f5">Discover</a> · <a href="/creators/" style="color:#7ee7f5">Creators</a> · <a href="/about/" style="color:#7ee7f5">About</a></p>
  </article>`;
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
  return creation.mediaUrl.replace("/media/video/", "/media/posters/").replace(/\.(webm|mp4|mov)$/i, ".jpg");
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

function formatPlateDate(iso: string) {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      timeZone: "America/Los_Angeles",
    });
  } catch {
    return iso;
  }
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char] || char),
  );
}
