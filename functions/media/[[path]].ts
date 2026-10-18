/**
 * Serve the newly published bamboo plate directly from R2.
 * This keeps the stable /media/... URL correct even if Pages cached an earlier
 * SPA fallback before the object was added to the site shell.
 */
import { thumbR2Key } from "../lib/mediaThumbs.ts";
interface MediaObject {
  arrayBuffer(): Promise<ArrayBuffer>;
  httpMetadata?: { contentType?: string };
}
interface MediaBucket {
  get(key: string, options?: { range?: { offset: number; length: number } }): Promise<MediaObject | null>;
  head?(key: string): Promise<{ size: number; httpEtag?: string; httpMetadata?: { contentType?: string } } | null>;
}

/** Card-hover preview proxies (720p@60): /media/video-preview/<name>.mp4 -> R2 media/video-preview/<name>.mp4 */
const PREVIEW_RE = /^\/media\/video-preview\/([a-zA-Z0-9._-]+\.mp4)$/;

async function servePreviewObject(bucket: MediaBucket, key: string, request: Request): Promise<Response> {
  const method = request.method;
  const notFound = () => new Response("Not found", {
    status: 404,
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
  });
  if (!bucket.head) {
    const whole = await bucket.get(key);
    return whole ? serveMediaObject(whole, "video/mp4", method) : notFound();
  }
  const meta = await bucket.head(key);
  if (!meta) return notFound();
  const size = meta.size;
  const base: Record<string, string> = {
    "content-type": "video/mp4",
    "cache-control": "public, max-age=31536000, immutable",
    "accept-ranges": "bytes",
    "access-control-allow-origin": "*",
  };
  if (meta.httpEtag) base.etag = meta.httpEtag;
  const rangeHeader = request.headers.get("range");
  let start = 0;
  let end = size - 1;
  let partial = false;
  if (rangeHeader) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
    if (m && (m[1] !== "" || m[2] !== "")) {
      if (m[1] === "") {
        const suffix = Math.min(Number(m[2]), size);
        start = size - suffix;
      } else {
        start = Number(m[1]);
        if (m[2] !== "") end = Math.min(Number(m[2]), size - 1);
      }
      if (start >= size || start > end) {
        return new Response(null, { status: 416, headers: { ...base, "content-range": `bytes */${size}` } });
      }
      partial = true;
    }
  }
  const length = end - start + 1;
  const headers = new Headers({ ...base, "content-length": String(length) });
  if (partial) headers.set("content-range", `bytes ${start}-${end}/${size}`);
  if (method === "HEAD") return new Response(null, { status: partial ? 206 : 200, headers });
  const obj = (await bucket.get(key, partial ? { range: { offset: start, length } } : undefined)) as
    | (MediaObject & { body?: ReadableStream })
    | null;
  if (!obj) return notFound();
  const body = obj.body ?? new Uint8Array(await obj.arrayBuffer());
  return new Response(body, { status: partial ? 206 : 200, headers });
}
interface Env {
  MEDIA?: MediaBucket;
}

const OBJECTS: Record<string, { key: string; contentType: string }> = {
  "/media/video/landscapes-salt-flat.mp4": {
    key: "media/video/landscapes-salt-flat.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/landscapes-salt-flat.jpg": {
    key: "media/posters/landscapes-salt-flat.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/landscapes-highland-ridge.mp4": {
    key: "media/video/landscapes-highland-ridge.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/landscapes-highland-ridge.jpg": {
    key: "media/posters/landscapes-highland-ridge.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/landscapes-lavender-field.mp4": {
    key: "media/video/landscapes-lavender-field.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/landscapes-lavender-field.jpg": {
    key: "media/posters/landscapes-lavender-field.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/landscapes-bamboo-grove.mp4": {
    key: "media/video/landscapes-bamboo-grove.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/landscapes-bamboo-grove.jpg": {
    key: "media/posters/landscapes-bamboo-grove.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/landscapes-frozen-lake.mp4": {
    key: "media/video/landscapes-frozen-lake.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/landscapes-frozen-lake.jpg": {
    key: "media/posters/landscapes-frozen-lake.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/landscapes-rolling-hills.mp4": {
    key: "media/video/landscapes-rolling-hills.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/landscapes-rolling-hills.jpg": {
    key: "media/posters/landscapes-rolling-hills.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/landscapes-waterfall-gorge.mp4": {
    key: "media/video/landscapes-waterfall-gorge.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/landscapes-waterfall-gorge.jpg": {
    key: "media/posters/landscapes-waterfall-gorge.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/landscapes-tropical-lagoon.mp4": {
    key: "media/video/landscapes-tropical-lagoon.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/landscapes-tropical-lagoon.jpg": {
    key: "media/posters/landscapes-tropical-lagoon.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/landscapes-autumn-maple.mp4": {
    key: "media/video/landscapes-autumn-maple.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/landscapes-autumn-maple.jpg": {
    key: "media/posters/landscapes-autumn-maple.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/landscapes-glacial-river.mp4": {
    key: "media/video/landscapes-glacial-river.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/landscapes-glacial-river.jpg": {
    key: "media/posters/landscapes-glacial-river.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/landscapes-marsh-sunrise.mp4": {
    key: "media/video/landscapes-marsh-sunrise.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/landscapes-marsh-sunrise.jpg": {
    key: "media/posters/landscapes-marsh-sunrise.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/landscapes-black-sand-beach.mp4": {
    key: "media/video/landscapes-black-sand-beach.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/landscapes-black-sand-beach.jpg": {
    key: "media/posters/landscapes-black-sand-beach.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/landscapes-slot-canyon.mp4": {
    key: "media/video/landscapes-slot-canyon.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/landscapes-slot-canyon.jpg": {
    key: "media/posters/landscapes-slot-canyon.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/landscapes-snow-spruce.mp4": {
    key: "media/video/landscapes-snow-spruce.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/landscapes-snow-spruce.jpg": {
    key: "media/posters/landscapes-snow-spruce.jpg",
    contentType: "image/jpeg",
  },


  "/media/video/landscapes-chalk-cliff.mp4": {
    key: "media/video/landscapes-chalk-cliff.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/landscapes-chalk-cliff.jpg": {
    key: "media/posters/landscapes-chalk-cliff.jpg",
    contentType: "image/jpeg",
  },


  "/media/video/landscapes-alpine-meadow.mp4": {
    key: "media/video/landscapes-alpine-meadow.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/landscapes-alpine-meadow.jpg": {
    key: "media/posters/landscapes-alpine-meadow.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/landscapes-rice-terrace.mp4": {
    key: "media/video/landscapes-rice-terrace.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/landscapes-rice-terrace.jpg": {
    key: "media/posters/landscapes-rice-terrace.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/landscapes-mangrove.mp4": {
    key: "media/video/landscapes-mangrove.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/landscapes-mangrove.jpg": {
    key: "media/posters/landscapes-mangrove.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/landscapes-wheat-field.mp4": {
    key: "media/video/landscapes-wheat-field.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/landscapes-wheat-field.jpg": {
    key: "media/posters/landscapes-wheat-field.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/landscapes-eucalyptus-fog.mp4": {
    key: "media/video/landscapes-eucalyptus-fog.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/landscapes-eucalyptus-fog.jpg": {
    key: "media/posters/landscapes-eucalyptus-fog.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/landscapes-glacier-lake.mp4": {
    key: "media/video/landscapes-glacier-lake.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/landscapes-glacier-lake.jpg": {
    key: "media/posters/landscapes-glacier-lake.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/landscapes-alpine-tarn.mp4": {
    key: "media/video/landscapes-alpine-tarn.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/landscapes-alpine-tarn.jpg": {
    key: "media/posters/landscapes-alpine-tarn.jpg",
    contentType: "image/jpeg",
  },
  "/media/images/cities-q-amsterdam-canals.webp": {
    key: "media/images/cities-q-amsterdam-canals.webp",
    contentType: "image/webp",
  },
  "/media/images/cities-q-barcelona-grid.webp": {
    key: "media/images/cities-q-barcelona-grid.webp",
    contentType: "image/webp",
  },
  "/media/images/cities-q-chicago-lake.webp": {
    key: "media/images/cities-q-chicago-lake.webp",
    contentType: "image/webp",
  },
  "/media/images/cities-q-dubai-night.webp": {
    key: "media/images/cities-q-dubai-night.webp",
    contentType: "image/webp",
  },
  "/media/images/cities-q-hongkong-harbour.webp": {
    key: "media/images/cities-q-hongkong-harbour.webp",
    contentType: "image/webp",
  },
  "/media/images/cities-q-london-thames.webp": {
    key: "media/images/cities-q-london-thames.webp",
    contentType: "image/webp",
  },
  "/media/images/cities-q-nyc-aerial.webp": {
    key: "media/images/cities-q-nyc-aerial.webp",
    contentType: "image/webp",
  },
  "/media/images/cities-q-paris-rooftops.webp": {
    key: "media/images/cities-q-paris-rooftops.webp",
    contentType: "image/webp",
  },
  "/media/images/cities-q-rio-coast.webp": {
    key: "media/images/cities-q-rio-coast.webp",
    contentType: "image/webp",
  },
  "/media/images/cities-q-seoul-night.webp": {
    key: "media/images/cities-q-seoul-night.webp",
    contentType: "image/webp",
  },
  "/media/images/cities-q-sf-fog.webp": {
    key: "media/images/cities-q-sf-fog.webp",
    contentType: "image/webp",
  },
  "/media/images/cities-q-shanghai-bund.webp": {
    key: "media/images/cities-q-shanghai-bund.webp",
    contentType: "image/webp",
  },
  "/media/images/cities-q-singapore-marina.webp": {
    key: "media/images/cities-q-singapore-marina.webp",
    contentType: "image/webp",
  },
  "/media/images/cities-q-tokyo-skyline.webp": {
    key: "media/images/cities-q-tokyo-skyline.webp",
    contentType: "image/webp",
  },
  "/media/images/cities-q-venice-rooftops.webp": {
    key: "media/images/cities-q-venice-rooftops.webp",
    contentType: "image/webp",
  },
  "/media/video/landscapes-dune-field.mp4": {
    key: "media/video/landscapes-dune-field.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/landscapes-dune-field.jpg": {
    key: "media/posters/landscapes-dune-field.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/landscapes-olive-grove.mp4": {
    key: "media/video/landscapes-olive-grove.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/landscapes-olive-grove.jpg": {
    key: "media/posters/landscapes-olive-grove.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/landscapes-cedar-mist.mp4": {
    key: "media/video/landscapes-cedar-mist.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/landscapes-cedar-mist.jpg": {
    key: "media/posters/landscapes-cedar-mist.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/landscapes-river-delta.mp4": {
    key: "media/video/landscapes-river-delta.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/landscapes-river-delta.jpg": {
    key: "media/posters/landscapes-river-delta.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/landscapes-frozen-waterfall.mp4": {
    key: "media/video/landscapes-frozen-waterfall.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/landscapes-frozen-waterfall.jpg": {
    key: "media/posters/landscapes-frozen-waterfall.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/landscapes-kelp-forest.mp4": {
    key: "media/video/landscapes-kelp-forest.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/landscapes-kelp-forest.jpg": {
    key: "media/posters/landscapes-kelp-forest.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/landscapes-dry-lake.mp4": {
    key: "media/video/landscapes-dry-lake.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/landscapes-dry-lake.jpg": {
    key: "media/posters/landscapes-dry-lake.jpg",
    contentType: "image/jpeg",
  },






























  "/media/video/us-cities-detroit-riverfront.mp4": {
    key: "media/video/us-cities-detroit-riverfront.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/us-cities-detroit-riverfront.jpg": {
    key: "media/posters/us-cities-detroit-riverfront.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/us-cities-honolulu-waikiki.mp4": {
    key: "media/video/us-cities-honolulu-waikiki.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/us-cities-honolulu-waikiki.jpg": {
    key: "media/posters/us-cities-honolulu-waikiki.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/us-cities-pittsburgh-point.mp4": {
    key: "media/video/us-cities-pittsburgh-point.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/us-cities-pittsburgh-point.jpg": {
    key: "media/posters/us-cities-pittsburgh-point.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/us-cities-salt-lake-wasatch.mp4": {
    key: "media/video/us-cities-salt-lake-wasatch.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/us-cities-salt-lake-wasatch.jpg": {
    key: "media/posters/us-cities-salt-lake-wasatch.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/us-cities-charleston-battery.mp4": {
    key: "media/video/us-cities-charleston-battery.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/us-cities-charleston-battery.jpg": {
    key: "media/posters/us-cities-charleston-battery.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/us-cities-seattle-elliott.mp4": {
    key: "media/video/us-cities-seattle-elliott.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/us-cities-seattle-elliott.jpg": {
    key: "media/posters/us-cities-seattle-elliott.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/us-cities-new-orleans-rooftops.mp4": {
    key: "media/video/us-cities-new-orleans-rooftops.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/us-cities-new-orleans-rooftops.jpg": {
    key: "media/posters/us-cities-new-orleans-rooftops.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/us-cities-austin-lake.mp4": {
    key: "media/video/us-cities-austin-lake.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/us-cities-austin-lake.jpg": {
    key: "media/posters/us-cities-austin-lake.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/us-cities-miami-biscayne.mp4": {
    key: "media/video/us-cities-miami-biscayne.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/us-cities-miami-biscayne.jpg": {
    key: "media/posters/us-cities-miami-biscayne.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/us-cities-boston-zakim.mp4": {
    key: "media/video/us-cities-boston-zakim.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/us-cities-boston-zakim.jpg": {
    key: "media/posters/us-cities-boston-zakim.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/us-cities-denver-foothills.mp4": {
    key: "media/video/us-cities-denver-foothills.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/us-cities-denver-foothills.jpg": {
    key: "media/posters/us-cities-denver-foothills.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/us-cities-philadelphia-schuylkill.mp4": {
    key: "media/video/us-cities-philadelphia-schuylkill.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/us-cities-philadelphia-schuylkill.jpg": {
    key: "media/posters/us-cities-philadelphia-schuylkill.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/us-cities-nashville-cumberland.mp4": {
    key: "media/video/us-cities-nashville-cumberland.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/us-cities-nashville-cumberland.jpg": {
    key: "media/posters/us-cities-nashville-cumberland.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/us-cities-portland-bridges.mp4": {
    key: "media/video/us-cities-portland-bridges.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/us-cities-portland-bridges.jpg": {
    key: "media/posters/us-cities-portland-bridges.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/us-cities-chicago-riverwalk.mp4": {
    key: "media/video/us-cities-chicago-riverwalk.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/us-cities-chicago-riverwalk.jpg": {
    key: "media/posters/us-cities-chicago-riverwalk.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/us-cities-st-louis-arch.mp4": {
    key: "media/video/us-cities-st-louis-arch.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/us-cities-st-louis-arch.jpg": {
    key: "media/posters/us-cities-st-louis-arch.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/us-cities-baltimore-harbor.mp4": {
    key: "media/video/us-cities-baltimore-harbor.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/us-cities-baltimore-harbor.jpg": {
    key: "media/posters/us-cities-baltimore-harbor.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/us-cities-savannah-river.mp4": {
    key: "media/video/us-cities-savannah-river.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/us-cities-savannah-river.jpg": {
    key: "media/posters/us-cities-savannah-river.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/us-cities-san-antonio-river.mp4": {
    key: "media/video/us-cities-san-antonio-river.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/us-cities-san-antonio-river.jpg": {
    key: "media/posters/us-cities-san-antonio-river.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/us-cities-cleveland-lake.mp4": {
    key: "media/video/us-cities-cleveland-lake.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/us-cities-cleveland-lake.jpg": {
    key: "media/posters/us-cities-cleveland-lake.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/us-cities-kansas-city-skyline.mp4": {
    key: "media/video/us-cities-kansas-city-skyline.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/us-cities-kansas-city-skyline.jpg": {
    key: "media/posters/us-cities-kansas-city-skyline.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/us-cities-cincinnati-river.mp4": {
    key: "media/video/us-cities-cincinnati-river.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/us-cities-cincinnati-river.jpg": {
    key: "media/posters/us-cities-cincinnati-river.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/us-cities-milwaukee-lake.mp4": {
    key: "media/video/us-cities-milwaukee-lake.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/us-cities-milwaukee-lake.jpg": {
    key: "media/posters/us-cities-milwaukee-lake.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/us-cities-providence-water.mp4": {
    key: "media/video/us-cities-providence-water.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/us-cities-providence-water.jpg": {
    key: "media/posters/us-cities-providence-water.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/us-cities-richmond-river.mp4": {
    key: "media/video/us-cities-richmond-river.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/us-cities-richmond-river.jpg": {
    key: "media/posters/us-cities-richmond-river.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/us-cities-albuquerque-plaza.mp4": {
    key: "media/video/us-cities-albuquerque-plaza.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/us-cities-albuquerque-plaza.jpg": {
    key: "media/posters/us-cities-albuquerque-plaza.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/us-cities-anchorage-coast.mp4": {
    key: "media/video/us-cities-anchorage-coast.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/us-cities-anchorage-coast.jpg": {
    key: "media/posters/us-cities-anchorage-coast.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/us-cities-boise-foothills.mp4": {
    key: "media/video/us-cities-boise-foothills.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/us-cities-boise-foothills.jpg": {
    key: "media/posters/us-cities-boise-foothills.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/us-cities-tucson-downtown.mp4": {
    key: "media/video/us-cities-tucson-downtown.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/us-cities-tucson-downtown.jpg": {
    key: "media/posters/us-cities-tucson-downtown.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/landscapes-glacier-lagoon.mp4": {
    key: "media/video/landscapes-glacier-lagoon.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/landscapes-glacier-lagoon.jpg": {
    key: "media/posters/landscapes-glacier-lagoon.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/landscapes-badlands-buttes.mp4": {
    key: "media/video/landscapes-badlands-buttes.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/landscapes-badlands-buttes.jpg": {
    key: "media/posters/landscapes-badlands-buttes.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/landscapes-sea-stacks.mp4": {
    key: "media/video/landscapes-sea-stacks.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/landscapes-sea-stacks.jpg": {
    key: "media/posters/landscapes-sea-stacks.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/landscapes-larch-valley.mp4": {
    key: "media/video/landscapes-larch-valley.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/landscapes-larch-valley.jpg": {
    key: "media/posters/landscapes-larch-valley.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/landscapes-basalt-coast.mp4": {
    key: "media/video/landscapes-basalt-coast.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/landscapes-basalt-coast.jpg": {
    key: "media/posters/landscapes-basalt-coast.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/landscapes-wildflower-desert.mp4": {
    key: "media/video/landscapes-wildflower-desert.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/landscapes-wildflower-desert.jpg": {
    key: "media/posters/landscapes-wildflower-desert.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/landscapes-canyon-river.mp4": {
    key: "media/video/landscapes-canyon-river.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/landscapes-canyon-river.jpg": {
    key: "media/posters/landscapes-canyon-river.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/landscapes-snow-volcano.mp4": {
    key: "media/video/landscapes-snow-volcano.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/landscapes-snow-volcano.jpg": {
    key: "media/posters/landscapes-snow-volcano.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/landscapes-cottonwood-river.mp4": {
    key: "media/video/landscapes-cottonwood-river.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/landscapes-cottonwood-river.jpg": {
    key: "media/posters/landscapes-cottonwood-river.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/landscapes-hoodoo-basin.mp4": {
    key: "media/video/landscapes-hoodoo-basin.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/landscapes-hoodoo-basin.jpg": {
    key: "media/posters/landscapes-hoodoo-basin.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/landscapes-fjord-village.mp4": {
    key: "media/video/landscapes-fjord-village.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/landscapes-fjord-village.jpg": {
    key: "media/posters/landscapes-fjord-village.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/landscapes-salt-marsh.mp4": {
    key: "media/video/landscapes-salt-marsh.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/landscapes-salt-marsh.jpg": {
    key: "media/posters/landscapes-salt-marsh.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/landscapes-joshua-dusk.mp4": {
    key: "media/video/landscapes-joshua-dusk.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/landscapes-joshua-dusk.jpg": {
    key: "media/posters/landscapes-joshua-dusk.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/landscapes-waterfall-pool-v2.mp4": {
    key: "media/video/landscapes-waterfall-pool-v2.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/landscapes-waterfall-pool-v2.jpg": {
    key: "media/posters/landscapes-waterfall-pool-v2.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/landscapes-tundra-river.mp4": {
    key: "media/video/landscapes-tundra-river.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/landscapes-tundra-river.jpg": {
    key: "media/posters/landscapes-tundra-river.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/cities-kyoto-kamo.mp4": {
    key: "media/video/cities-kyoto-kamo.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/cities-kyoto-kamo.jpg": {
    key: "media/posters/cities-kyoto-kamo.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/cities-venice-dawn.mp4": {
    key: "media/video/cities-venice-dawn.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/cities-venice-dawn.jpg": {
    key: "media/posters/cities-venice-dawn.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/cities-rio-hill.mp4": {
    key: "media/video/cities-rio-hill.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/cities-rio-hill.jpg": {
    key: "media/posters/cities-rio-hill.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/cities-singapore-marina.mp4": {
    key: "media/video/cities-singapore-marina.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/cities-singapore-marina.jpg": {
    key: "media/posters/cities-singapore-marina.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/cities-barcelona-gothic.mp4": {
    key: "media/video/cities-barcelona-gothic.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/cities-barcelona-gothic.jpg": {
    key: "media/posters/cities-barcelona-gothic.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/cities-amsterdam-canal.mp4": {
    key: "media/video/cities-amsterdam-canal.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/cities-amsterdam-canal.jpg": {
    key: "media/posters/cities-amsterdam-canal.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/cities-seoul-han.mp4": {
    key: "media/video/cities-seoul-han.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/cities-seoul-han.jpg": {
    key: "media/posters/cities-seoul-han.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/cities-dubrovnik-walls.mp4": {
    key: "media/video/cities-dubrovnik-walls.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/cities-dubrovnik-walls.jpg": {
    key: "media/posters/cities-dubrovnik-walls.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/cities-valparaiso-hills.mp4": {
    key: "media/video/cities-valparaiso-hills.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/cities-valparaiso-hills.jpg": {
    key: "media/posters/cities-valparaiso-hills.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/cities-bergen-harbor.mp4": {
    key: "media/video/cities-bergen-harbor.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/cities-bergen-harbor.jpg": {
    key: "media/posters/cities-bergen-harbor.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/cities-queenstown-lake.mp4": {
    key: "media/video/cities-queenstown-lake.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/cities-queenstown-lake.jpg": {
    key: "media/posters/cities-queenstown-lake.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/cities-luang-river.mp4": {
    key: "media/video/cities-luang-river.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/cities-luang-river.jpg": {
    key: "media/posters/cities-luang-river.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/cities-santorini-caldera.mp4": {
    key: "media/video/cities-santorini-caldera.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/cities-santorini-caldera.jpg": {
    key: "media/posters/cities-santorini-caldera.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/cities-budapest-bridge.mp4": {
    key: "media/video/cities-budapest-bridge.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/cities-budapest-bridge.jpg": {
    key: "media/posters/cities-budapest-bridge.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/cities-vancouver-seawall.mp4": {
    key: "media/video/cities-vancouver-seawall.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/cities-vancouver-seawall.jpg": {
    key: "media/posters/cities-vancouver-seawall.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/street-tokyo-alley.mp4": {
    key: "media/video/street-tokyo-alley.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/street-tokyo-alley.jpg": {
    key: "media/posters/street-tokyo-alley.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/street-lisbon-tram.mp4": {
    key: "media/video/street-lisbon-tram.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/street-lisbon-tram.jpg": {
    key: "media/posters/street-lisbon-tram.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/street-new-orleans.mp4": {
    key: "media/video/street-new-orleans.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/street-new-orleans.jpg": {
    key: "media/posters/street-new-orleans.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/street-seoul-neon.mp4": {
    key: "media/video/street-seoul-neon.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/street-seoul-neon.jpg": {
    key: "media/posters/street-seoul-neon.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/street-paris-rain.mp4": {
    key: "media/video/street-paris-rain.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/street-paris-rain.jpg": {
    key: "media/posters/street-paris-rain.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/street-oaxaca-market.mp4": {
    key: "media/video/street-oaxaca-market.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/street-oaxaca-market.jpg": {
    key: "media/posters/street-oaxaca-market.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/street-melbourne-lane.mp4": {
    key: "media/video/street-melbourne-lane.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/street-melbourne-lane.jpg": {
    key: "media/posters/street-melbourne-lane.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/street-hongkong-street.mp4": {
    key: "media/video/street-hongkong-street.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/street-hongkong-street.jpg": {
    key: "media/posters/street-hongkong-street.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/street-rome-cobble.mp4": {
    key: "media/video/street-rome-cobble.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/street-rome-cobble.jpg": {
    key: "media/posters/street-rome-cobble.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/street-copenhagen-bike.mp4": {
    key: "media/video/street-copenhagen-bike.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/street-copenhagen-bike.jpg": {
    key: "media/posters/street-copenhagen-bike.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/street-istanbul-lane.mp4": {
    key: "media/video/street-istanbul-lane.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/street-istanbul-lane.jpg": {
    key: "media/posters/street-istanbul-lane.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/street-havana-pastel.mp4": {
    key: "media/video/street-havana-pastel.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/street-havana-pastel.jpg": {
    key: "media/posters/street-havana-pastel.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/street-mexico-colonia.mp4": {
    key: "media/video/street-mexico-colonia.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/street-mexico-colonia.jpg": {
    key: "media/posters/street-mexico-colonia.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/street-chefchaouen.mp4": {
    key: "media/video/street-chefchaouen.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/street-chefchaouen.jpg": {
    key: "media/posters/street-chefchaouen.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/street-edinburgh-close.mp4": {
    key: "media/video/street-edinburgh-close.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/street-edinburgh-close.jpg": {
    key: "media/posters/street-edinburgh-close.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/people-cafe-terrace.mp4": {
    key: "media/video/people-cafe-terrace.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/people-cafe-terrace.jpg": {
    key: "media/posters/people-cafe-terrace.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/people-crosswalk-dusk.mp4": {
    key: "media/video/people-crosswalk-dusk.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/people-crosswalk-dusk.jpg": {
    key: "media/posters/people-crosswalk-dusk.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/people-night-market.mp4": {
    key: "media/video/people-night-market.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/people-night-market.jpg": {
    key: "media/posters/people-night-market.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/people-station-platform.mp4": {
    key: "media/video/people-station-platform.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/people-station-platform.jpg": {
    key: "media/posters/people-station-platform.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/people-park-path.mp4": {
    key: "media/video/people-park-path.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/people-park-path.jpg": {
    key: "media/posters/people-park-path.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/people-bookstore.mp4": {
    key: "media/video/people-bookstore.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/people-bookstore.jpg": {
    key: "media/posters/people-bookstore.jpg",
    contentType: "image/jpeg",
  },
  "/media/images/cities-q-seattle-elliott.webp": {
    key: "media/images/cities-q-seattle-elliott.webp",
    contentType: "image/webp",
  },
  "/media/images/cities-q-boston-harbor.webp": {
    key: "media/images/cities-q-boston-harbor.webp",
    contentType: "image/webp",
  },
  "/media/images/cities-q-austin-lake.webp": {
    key: "media/images/cities-q-austin-lake.webp",
    contentType: "image/webp",
  },
  "/media/images/cities-q-denver-foothills.webp": {
    key: "media/images/cities-q-denver-foothills.webp",
    contentType: "image/webp",
  },
  "/media/images/cities-q-miami-biscayne.webp": {
    key: "media/images/cities-q-miami-biscayne.webp",
    contentType: "image/webp",
  },
  "/media/images/cities-q-philly-schuylkill.webp": {
    key: "media/images/cities-q-philly-schuylkill.webp",
    contentType: "image/webp",
  },
  "/media/images/cities-q-portland-willamette.webp": {
    key: "media/images/cities-q-portland-willamette.webp",
    contentType: "image/webp",
  },
  "/media/images/cities-q-nashville-cumberland.webp": {
    key: "media/images/cities-q-nashville-cumberland.webp",
    contentType: "image/webp",
  },
  "/media/images/cities-q-nola-riverbend.webp": {
    key: "media/images/cities-q-nola-riverbend.webp",
    contentType: "image/webp",
  },
  "/media/images/cities-q-vegas-strip-aerial.webp": {
    key: "media/images/cities-q-vegas-strip-aerial.webp",
    contentType: "image/webp",
  },
  "/media/images/cities-q-sandiego-bay.webp": {
    key: "media/images/cities-q-sandiego-bay.webp",
    contentType: "image/webp",
  },
  "/media/images/fant-q-clockwork-gryphon.webp": {
    key: "media/images/fant-q-clockwork-gryphon.webp",
    contentType: "image/webp",
  },
  "/media/images/fant-q-ice-throne.webp": {
    key: "media/images/fant-q-ice-throne.webp",
    contentType: "image/webp",
  },
  "/media/images/fant-q-sandship-bazaar.webp": {
    key: "media/images/fant-q-sandship-bazaar.webp",
    contentType: "image/webp",
  },
  "/media/images/comic-q-submarine-hatch.webp": {
    key: "media/images/comic-q-submarine-hatch.webp",
    contentType: "image/webp",
  },
  "/media/images/comic-q-stadium-catch.webp": {
    key: "media/images/comic-q-stadium-catch.webp",
    contentType: "image/webp",
  },
  "/media/images/cities-q-istanbul-bosphorus.webp": {
    key: "media/images/cities-q-istanbul-bosphorus.webp",
    contentType: "image/webp",
  },
  "/media/images/land-q-teal-cenote.webp": {
    key: "media/images/land-q-teal-cenote.webp",
    contentType: "image/webp",
  },
  "/media/images/land-q-saffron-steppe.webp": {
    key: "media/images/land-q-saffron-steppe.webp",
    contentType: "image/webp",
  },
  "/media/images/land-q-obsidian-beach.webp": {
    key: "media/images/land-q-obsidian-beach.webp",
    contentType: "image/webp",
  },
  "/media/images/cities-q-lisbon-tagus.webp": {
    key: "media/images/cities-q-lisbon-tagus.webp",
    contentType: "image/webp",
  },
  "/media/images/cities-q-capetown-bowl.webp": {
    key: "media/images/cities-q-capetown-bowl.webp",
    contentType: "image/webp",
  },
  "/media/images/street-q-hanoi-train.webp": {
    key: "media/images/street-q-hanoi-train.webp",
    contentType: "image/webp",
  },
  "/media/images/street-q-porto-azulejo.webp": {
    key: "media/images/street-q-porto-azulejo.webp",
    contentType: "image/webp",
  },
  "/media/images/street-q-marrakech-souk.webp": {
    key: "media/images/street-q-marrakech-souk.webp",
    contentType: "image/webp",
  },
  "/media/images/people-q-dock-knit.webp": {
    key: "media/images/people-q-dock-knit.webp",
    contentType: "image/webp",
  },
  "/media/images/people-q-bakery-open.webp": {
    key: "media/images/people-q-bakery-open.webp",
    contentType: "image/webp",
  },
  "/media/images/people-q-ferry-rail.webp": {
    key: "media/images/people-q-ferry-rail.webp",
    contentType: "image/webp",
  },
  "/media/images/port-q-amber-spectacles.webp": {
    key: "media/images/port-q-amber-spectacles.webp",
    contentType: "image/webp",
  },
  "/media/images/port-q-silver-cornrows.webp": {
    key: "media/images/port-q-silver-cornrows.webp",
    contentType: "image/webp",
  },
  "/media/images/port-q-linen-scar.webp": {
    key: "media/images/port-q-linen-scar.webp",
    contentType: "image/webp",
  },
  "/media/images/cyber-q-mist-monorail.webp": {
    key: "media/images/cyber-q-mist-monorail.webp",
    contentType: "image/webp",
  },
  "/media/images/cyber-q-bio-market.webp": {
    key: "media/images/cyber-q-bio-market.webp",
    contentType: "image/webp",
  },
  "/media/images/cyber-q-acid-canal.webp": {
    key: "media/images/cyber-q-acid-canal.webp",
    contentType: "image/webp",
  },
  "/media/images/fut-q-tidal-turbines.webp": {
    key: "media/images/fut-q-tidal-turbines.webp",
    contentType: "image/webp",
  },
  "/media/images/fut-q-cloud-elevator.webp": {
    key: "media/images/fut-q-cloud-elevator.webp",
    contentType: "image/webp",
  },
  "/media/images/fut-q-crystal-farm.webp": {
    key: "media/images/fut-q-crystal-farm.webp",
    contentType: "image/webp",
  },
  "/media/images/animals-q-puffin-cliff.webp": {
    key: "media/images/animals-q-puffin-cliff.webp",
    contentType: "image/webp",
  },
  "/media/images/animals-q-chameleon-leaf.webp": {
    key: "media/images/animals-q-chameleon-leaf.webp",
    contentType: "image/webp",
  },
  "/media/images/animals-q-oryx-dune.webp": {
    key: "media/images/animals-q-oryx-dune.webp",
    contentType: "image/webp",
  },
  "/media/images/fa-q-lantern-jellyfishox.webp": {
    key: "media/images/fa-q-lantern-jellyfishox.webp",
    contentType: "image/webp",
  },
  "/media/images/fa-q-clockfin-heron.webp": {
    key: "media/images/fa-q-clockfin-heron.webp",
    contentType: "image/webp",
  },
  "/media/images/fa-q-pebble-manta.webp": {
    key: "media/images/fa-q-pebble-manta.webp",
    contentType: "image/webp",
  },
  "/media/images/myth-q-selkie-skerry.webp": {
    key: "media/images/myth-q-selkie-skerry.webp",
    contentType: "image/webp",
  },
  "/media/images/myth-q-thunderbird-mesa.webp": {
    key: "media/images/myth-q-thunderbird-mesa.webp",
    contentType: "image/webp",
  },
  "/media/images/myth-q-kitsune-bridge.webp": {
    key: "media/images/myth-q-kitsune-bridge.webp",
    contentType: "image/webp",
  },
  "/media/images/anime-q-ferry-adults.webp": {
    key: "media/images/anime-q-ferry-adults.webp",
    contentType: "image/webp",
  },
  "/media/images/anime-q-atelier-night.webp": {
    key: "media/images/anime-q-atelier-night.webp",
    contentType: "image/webp",
  },
  "/media/images/anime-q-mountain-onsen-adult.webp": {
    key: "media/images/anime-q-mountain-onsen-adult.webp",
    contentType: "image/webp",
  },
  "/media/images/food-q-saffron-risotto.webp": {
    key: "media/images/food-q-saffron-risotto.webp",
    contentType: "image/webp",
  },
  "/media/images/food-q-charred-shishito.webp": {
    key: "media/images/food-q-charred-shishito.webp",
    contentType: "image/webp",
  },
  "/media/images/food-q-honeycomb-toast.webp": {
    key: "media/images/food-q-honeycomb-toast.webp",
    contentType: "image/webp",
  },
  "/media/images/arch-q-cliff-cistern.webp": {
    key: "media/images/arch-q-cliff-cistern.webp",
    contentType: "image/webp",
  },
  "/media/images/arch-q-timber-orangerie.webp": {
    key: "media/images/arch-q-timber-orangerie.webp",
    contentType: "image/webp",
  },
  "/media/images/arch-q-desert-courtyard.webp": {
    key: "media/images/arch-q-desert-courtyard.webp",
    contentType: "image/webp",
  },
  "/media/images/space-q-ice-geyser.webp": {
    key: "media/images/space-q-ice-geyser.webp",
    contentType: "image/webp",
  },
  "/media/images/space-q-cargo-tether.webp": {
    key: "media/images/space-q-cargo-tether.webp",
    contentType: "image/webp",
  },
  "/media/images/space-q-nebula-arch.webp": {
    key: "media/images/space-q-nebula-arch.webp",
    contentType: "image/webp",
  },
  "/media/images/veh-q-cablecar-fog.webp": {
    key: "media/images/veh-q-cablecar-fog.webp",
    contentType: "image/webp",
  },
  "/media/images/veh-q-river-airboat.webp": {
    key: "media/images/veh-q-river-airboat.webp",
    contentType: "image/webp",
  },
  "/media/images/veh-q-desert-maglev.webp": {
    key: "media/images/veh-q-desert-maglev.webp",
    contentType: "image/webp",
  },
  "/media/images/nature-q-frost-spiderweb.webp": {
    key: "media/images/nature-q-frost-spiderweb.webp",
    contentType: "image/webp",
  },
  "/media/images/nature-q-tidepool-anemone.webp": {
    key: "media/images/nature-q-tidepool-anemone.webp",
    contentType: "image/webp",
  },
  "/media/images/nature-q-birch-catkins.webp": {
    key: "media/images/nature-q-birch-catkins.webp",
    contentType: "image/webp",
  },
  "/media/images/comic-q-rooftop-courier.webp": {
    key: "media/images/comic-q-rooftop-courier.webp",
    contentType: "image/webp",
  },
  "/media/video/port-v-amber-glasses.mp4": {
    key: "media/video/port-v-amber-glasses.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/port-v-amber-glasses.jpg": {
    key: "media/posters/port-v-amber-glasses.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/port-v-silver-cornrows.mp4": {
    key: "media/video/port-v-silver-cornrows.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/port-v-silver-cornrows.jpg": {
    key: "media/posters/port-v-silver-cornrows.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/port-v-linen-collar.mp4": {
    key: "media/video/port-v-linen-collar.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/port-v-linen-collar.jpg": {
    key: "media/posters/port-v-linen-collar.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/cyber-v-mist-mono.mp4": {
    key: "media/video/cyber-v-mist-mono.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/cyber-v-mist-mono.jpg": {
    key: "media/posters/cyber-v-mist-mono.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/cyber-v-bio-market.mp4": {
    key: "media/video/cyber-v-bio-market.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/cyber-v-bio-market.jpg": {
    key: "media/posters/cyber-v-bio-market.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/cyber-v-acid-canal.mp4": {
    key: "media/video/cyber-v-acid-canal.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/cyber-v-acid-canal.jpg": {
    key: "media/posters/cyber-v-acid-canal.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/fut-v-tidal-turbines.mp4": {
    key: "media/video/fut-v-tidal-turbines.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/fut-v-tidal-turbines.jpg": {
    key: "media/posters/fut-v-tidal-turbines.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/fut-v-cloud-elevator.mp4": {
    key: "media/video/fut-v-cloud-elevator.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/fut-v-cloud-elevator.jpg": {
    key: "media/posters/fut-v-cloud-elevator.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/fut-v-crystal-farm.mp4": {
    key: "media/video/fut-v-crystal-farm.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/fut-v-crystal-farm.jpg": {
    key: "media/posters/fut-v-crystal-farm.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/animals-v-puffin-ledge.mp4": {
    key: "media/video/animals-v-puffin-ledge.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/animals-v-puffin-ledge.jpg": {
    key: "media/posters/animals-v-puffin-ledge.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/fa-v-pebble-manta.mp4": {
    key: "media/video/fa-v-pebble-manta.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/fa-v-pebble-manta.jpg": {
    key: "media/posters/fa-v-pebble-manta.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/fa-v-jellyfishox.mp4": {
    key: "media/video/fa-v-jellyfishox.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/fa-v-jellyfishox.jpg": {
    key: "media/posters/fa-v-jellyfishox.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/fantasy-v-clockwork-aerie.mp4": {
    key: "media/video/fantasy-v-clockwork-aerie.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/fantasy-v-clockwork-aerie.jpg": {
    key: "media/posters/fantasy-v-clockwork-aerie.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/fantasy-v-ice-throne.mp4": {
    key: "media/video/fantasy-v-ice-throne.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/fantasy-v-ice-throne.jpg": {
    key: "media/posters/fantasy-v-ice-throne.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/fantasy-v-sandship-deck.mp4": {
    key: "media/video/fantasy-v-sandship-deck.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/fantasy-v-sandship-deck.jpg": {
    key: "media/posters/fantasy-v-sandship-deck.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/myths-v-medusa-stone-garden.mp4": {
    key: "media/video/myths-v-medusa-stone-garden.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/myths-v-medusa-stone-garden.jpg": {
    key: "media/posters/myths-v-medusa-stone-garden.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/myths-v-kraken-galleon.mp4": {
    key: "media/video/myths-v-kraken-galleon.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/myths-v-kraken-galleon.jpg": {
    key: "media/posters/myths-v-kraken-galleon.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/myths-v-aphrodite-shell.mp4": {
    key: "media/video/myths-v-aphrodite-shell.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/myths-v-aphrodite-shell.jpg": {
    key: "media/posters/myths-v-aphrodite-shell.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/myths-v-wendigo-pines.mp4": {
    key: "media/video/myths-v-wendigo-pines.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/myths-v-wendigo-pines.jpg": {
    key: "media/posters/myths-v-wendigo-pines.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/myths-v-golem-of-prague.mp4": {
    key: "media/video/myths-v-golem-of-prague.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/myths-v-golem-of-prague.jpg": {
    key: "media/posters/myths-v-golem-of-prague.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/myths-v-pegasus-storm.mp4": {
    key: "media/video/myths-v-pegasus-storm.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/myths-v-pegasus-storm.jpg": {
    key: "media/posters/myths-v-pegasus-storm.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/myths-v-chimera-fire.mp4": {
    key: "media/video/myths-v-chimera-fire.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/myths-v-chimera-fire.jpg": {
    key: "media/posters/myths-v-chimera-fire.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/myths-v-rusalka-lake.mp4": {
    key: "media/video/myths-v-rusalka-lake.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/myths-v-rusalka-lake.jpg": {
    key: "media/posters/myths-v-rusalka-lake.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/myths-v-fates-thread.mp4": {
    key: "media/video/myths-v-fates-thread.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/myths-v-fates-thread.jpg": {
    key: "media/posters/myths-v-fates-thread.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/myths-v-banshee-cliff.mp4": {
    key: "media/video/myths-v-banshee-cliff.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/myths-v-banshee-cliff.jpg": {
    key: "media/posters/myths-v-banshee-cliff.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/myths-v-dracula-castle.mp4": {
    key: "media/video/myths-v-dracula-castle.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/myths-v-dracula-castle.jpg": {
    key: "media/posters/myths-v-dracula-castle.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/myths-v-icarus-falling.mp4": {
    key: "media/video/myths-v-icarus-falling.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/myths-v-icarus-falling.jpg": {
    key: "media/posters/myths-v-icarus-falling.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/myths-v-anansi-web.mp4": {
    key: "media/video/myths-v-anansi-web.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/myths-v-anansi-web.jpg": {
    key: "media/posters/myths-v-anansi-web.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/myths-v-perseus-medusa-head.mp4": {
    key: "media/video/myths-v-perseus-medusa-head.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/myths-v-perseus-medusa-head.jpg": {
    key: "media/posters/myths-v-perseus-medusa-head.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/myths-v-mjolnir-peak.mp4": {
    key: "media/video/myths-v-mjolnir-peak.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/myths-v-mjolnir-peak.jpg": {
    key: "media/posters/myths-v-mjolnir-peak.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/myths-v-loki-bound.mp4": {
    key: "media/video/myths-v-loki-bound.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/myths-v-loki-bound.jpg": {
    key: "media/posters/myths-v-loki-bound.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/myths-v-quetzalcoatl-pyramid.mp4": {
    key: "media/video/myths-v-quetzalcoatl-pyramid.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/myths-v-quetzalcoatl-pyramid.jpg": {
    key: "media/posters/myths-v-quetzalcoatl-pyramid.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/myths-v-kitsune-shrine.mp4": {
    key: "media/video/myths-v-kitsune-shrine.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/myths-v-kitsune-shrine.jpg": {
    key: "media/posters/myths-v-kitsune-shrine.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/myths-v-minotaur-labyrinth.mp4": {
    key: "media/video/myths-v-minotaur-labyrinth.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/myths-v-minotaur-labyrinth.jpg": {
    key: "media/posters/myths-v-minotaur-labyrinth.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/myths-v-anubis-heart.mp4": {
    key: "media/video/myths-v-anubis-heart.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/myths-v-anubis-heart.jpg": {
    key: "media/posters/myths-v-anubis-heart.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/animals-v-savanna-dust.mp4": {
    key: "media/video/animals-v-savanna-dust.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/animals-v-savanna-dust.jpg": {
    key: "media/posters/animals-v-savanna-dust.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/animals-v-kelp-otter.mp4": {
    key: "media/video/animals-v-kelp-otter.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/animals-v-kelp-otter.jpg": {
    key: "media/posters/animals-v-kelp-otter.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/animals-v-mist-wolf.mp4": {
    key: "media/video/animals-v-mist-wolf.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/animals-v-mist-wolf.jpg": {
    key: "media/posters/animals-v-mist-wolf.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/animals-v-canopy-macaw.mp4": {
    key: "media/video/animals-v-canopy-macaw.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/animals-v-canopy-macaw.jpg": {
    key: "media/posters/animals-v-canopy-macaw.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/animals-v-breach.mp4": {
    key: "media/video/animals-v-breach.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/animals-v-breach.jpg": {
    key: "media/posters/animals-v-breach.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/fictional-animals-v-glassshell-slug.mp4": {
    key: "media/video/fictional-animals-v-glassshell-slug.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/fictional-animals-v-glassshell-slug.jpg": {
    key: "media/posters/fictional-animals-v-glassshell-slug.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/fictional-animals-v-sky-ray.mp4": {
    key: "media/video/fictional-animals-v-sky-ray.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/fictional-animals-v-sky-ray.jpg": {
    key: "media/posters/fictional-animals-v-sky-ray.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/fictional-animals-v-crystal-stag.mp4": {
    key: "media/video/fictional-animals-v-crystal-stag.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/fictional-animals-v-crystal-stag.jpg": {
    key: "media/posters/fictional-animals-v-crystal-stag.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/fictional-animals-v-tidepool-fox.mp4": {
    key: "media/video/fictional-animals-v-tidepool-fox.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/fictional-animals-v-tidepool-fox.jpg": {
    key: "media/posters/fictional-animals-v-tidepool-fox.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/fantasy-v-living-library.mp4": {
    key: "media/video/fantasy-v-living-library.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/fantasy-v-living-library.jpg": {
    key: "media/posters/fantasy-v-living-library.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/fantasy-v-mushroom-village.mp4": {
    key: "media/video/fantasy-v-mushroom-village.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/fantasy-v-mushroom-village.jpg": {
    key: "media/posters/fantasy-v-mushroom-village.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/fantasy-v-portal-bridge.mp4": {
    key: "media/video/fantasy-v-portal-bridge.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/fantasy-v-portal-bridge.jpg": {
    key: "media/posters/fantasy-v-portal-bridge.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/futuristic-v-orbital-greenhouse.mp4": {
    key: "media/video/futuristic-v-orbital-greenhouse.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/futuristic-v-orbital-greenhouse.jpg": {
    key: "media/posters/futuristic-v-orbital-greenhouse.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/futuristic-v-maglev-orchard.mp4": {
    key: "media/video/futuristic-v-maglev-orchard.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/futuristic-v-maglev-orchard.jpg": {
    key: "media/posters/futuristic-v-maglev-orchard.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/futuristic-v-desert-array.mp4": {
    key: "media/video/futuristic-v-desert-array.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/futuristic-v-desert-array.jpg": {
    key: "media/posters/futuristic-v-desert-array.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/cyberpunk-v-neon-street-rain.mp4": {
    key: "media/video/cyberpunk-v-neon-street-rain.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/cyberpunk-v-neon-street-rain.jpg": {
    key: "media/posters/cyberpunk-v-neon-street-rain.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/cyberpunk-v-alley-repair.mp4": {
    key: "media/video/cyberpunk-v-alley-repair.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/cyberpunk-v-alley-repair.jpg": {
    key: "media/posters/cyberpunk-v-alley-repair.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/cyberpunk-v-noodle-window.mp4": {
    key: "media/video/cyberpunk-v-noodle-window.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/cyberpunk-v-noodle-window.jpg": {
    key: "media/posters/cyberpunk-v-noodle-window.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/portraits-v-freckled-close-up.mp4": {
    key: "media/video/portraits-v-freckled-close-up.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/portraits-v-freckled-close-up.jpg": {
    key: "media/posters/portraits-v-freckled-close-up.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/portraits-v-harbor-fisherman.mp4": {
    key: "media/video/portraits-v-harbor-fisherman.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/portraits-v-harbor-fisherman.jpg": {
    key: "media/posters/portraits-v-harbor-fisherman.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/portraits-v-grainy-glance.mp4": {
    key: "media/video/portraits-v-grainy-glance.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/portraits-v-grainy-glance.jpg": {
    key: "media/posters/portraits-v-grainy-glance.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/street-v-hanoi-train-street.mp4": {
    key: "media/video/street-v-hanoi-train-street.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/street-v-hanoi-train-street.jpg": {
    key: "media/posters/street-v-hanoi-train-street.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/street-v-jaipur-shutters.mp4": {
    key: "media/video/street-v-jaipur-shutters.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/street-v-jaipur-shutters.jpg": {
    key: "media/posters/street-v-jaipur-shutters.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/street-v-valletta-steps.mp4": {
    key: "media/video/street-v-valletta-steps.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/street-v-valletta-steps.jpg": {
    key: "media/posters/street-v-valletta-steps.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/cities-v-goreme-balloons.mp4": {
    key: "media/video/cities-v-goreme-balloons.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/cities-v-goreme-balloons.jpg": {
    key: "media/posters/cities-v-goreme-balloons.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/cities-v-tbilisi-domes.mp4": {
    key: "media/video/cities-v-tbilisi-domes.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/cities-v-tbilisi-domes.jpg": {
    key: "media/posters/cities-v-tbilisi-domes.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/cities-v-matera-lights.mp4": {
    key: "media/video/cities-v-matera-lights.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/cities-v-matera-lights.jpg": {
    key: "media/posters/cities-v-matera-lights.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/landscapes-v-uyuni-storm.mp4": {
    key: "media/video/landscapes-v-uyuni-storm.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/landscapes-v-uyuni-storm.jpg": {
    key: "media/posters/landscapes-v-uyuni-storm.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/landscapes-v-danxia-shadows.mp4": {
    key: "media/video/landscapes-v-danxia-shadows.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/landscapes-v-danxia-shadows.jpg": {
    key: "media/posters/landscapes-v-danxia-shadows.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/landscapes-v-glowing-surf.mp4": {
    key: "media/video/landscapes-v-glowing-surf.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/landscapes-v-glowing-surf.jpg": {
    key: "media/posters/landscapes-v-glowing-surf.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/us-cities-v-pittsburgh-incline.mp4": {
    key: "media/video/us-cities-v-pittsburgh-incline.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/us-cities-v-pittsburgh-incline.jpg": {
    key: "media/posters/us-cities-v-pittsburgh-incline.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/us-cities-v-santa-fe-farolitos.mp4": {
    key: "media/video/us-cities-v-santa-fe-farolitos.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/us-cities-v-santa-fe-farolitos.jpg": {
    key: "media/posters/us-cities-v-santa-fe-farolitos.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/us-cities-v-duluth-lift-bridge.mp4": {
    key: "media/video/us-cities-v-duluth-lift-bridge.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/us-cities-v-duluth-lift-bridge.jpg": {
    key: "media/posters/us-cities-v-duluth-lift-bridge.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/people-v-glassblower.mp4": {
    key: "media/video/people-v-glassblower.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/people-v-glassblower.jpg": {
    key: "media/posters/people-v-glassblower.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/people-v-lavender-beekeeper.mp4": {
    key: "media/video/people-v-lavender-beekeeper.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/people-v-lavender-beekeeper.jpg": {
    key: "media/posters/people-v-lavender-beekeeper.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/people-v-plaza-tango.mp4": {
    key: "media/video/people-v-plaza-tango.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/people-v-plaza-tango.jpg": {
    key: "media/posters/people-v-plaza-tango.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/people-v-rooftop-tai-chi.mp4": {
    key: "media/video/people-v-rooftop-tai-chi.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/people-v-rooftop-tai-chi.jpg": {
    key: "media/posters/people-v-rooftop-tai-chi.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/people-v-lighthouse-keeper.mp4": {
    key: "media/video/people-v-lighthouse-keeper.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/people-v-lighthouse-keeper.jpg": {
    key: "media/posters/people-v-lighthouse-keeper.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/people-v-calligrapher.mp4": {
    key: "media/video/people-v-calligrapher.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/people-v-calligrapher.jpg": {
    key: "media/posters/people-v-calligrapher.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/people-v-night-baker.mp4": {
    key: "media/video/people-v-night-baker.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/people-v-night-baker.jpg": {
    key: "media/posters/people-v-night-baker.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/people-v-ridge-astronomer.mp4": {
    key: "media/video/people-v-ridge-astronomer.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/people-v-ridge-astronomer.jpg": {
    key: "media/posters/people-v-ridge-astronomer.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/people-v-longboard-nose.mp4": {
    key: "media/video/people-v-longboard-nose.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/people-v-longboard-nose.jpg": {
    key: "media/posters/people-v-longboard-nose.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/people-v-harvest-dawn.mp4": {
    key: "media/video/people-v-harvest-dawn.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/people-v-harvest-dawn.jpg": {
    key: "media/posters/people-v-harvest-dawn.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/people-v-ice-huts.mp4": {
    key: "media/video/people-v-ice-huts.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/people-v-ice-huts.jpg": {
    key: "media/posters/people-v-ice-huts.jpg",
    contentType: "image/jpeg",
  },
  "/media/video/people-v-bridge-cellist.mp4": {
    key: "media/video/people-v-bridge-cellist.mp4",
    contentType: "video/mp4",
  },
  "/media/posters/people-v-bridge-cellist.jpg": {
    key: "media/posters/people-v-bridge-cellist.jpg",
    contentType: "image/jpeg",
  },
};


async function serveMediaObject(
  object: MediaObject,
  contentType: string,
  method: string,
): Promise<Response> {
  const bytes = new Uint8Array(await object.arrayBuffer());
  const headers = new Headers({
    "content-type": object.httpMetadata?.contentType || contentType,
    "content-length": String(bytes.byteLength),
    "cache-control": "public, max-age=31536000, immutable",
    "accept-ranges": "bytes",
    "access-control-allow-origin": "*",
  });
  return new Response(method === "HEAD" ? null : bytes, { status: 200, headers });
}

export const onRequest = async (context: {
  request: Request;
  env: Env;
  next: () => Promise<Response>;
}) => {
  const pathname = new URL(context.request.url).pathname;
  const method = context.request.method;
  if (method !== "GET" && method !== "HEAD") {
    if (OBJECTS[pathname] || pathname.startsWith("/media/")) {
      return new Response("Method not allowed", { status: 405, headers: { allow: "GET, HEAD" } });
    }
    return context.next();
  }


  const previewMatch = PREVIEW_RE.exec(pathname);
  if (previewMatch) {
    if (!context.env.MEDIA) return new Response("Media unavailable", { status: 503 });
    return servePreviewObject(context.env.MEDIA, `media/video-preview/${previewMatch[1]}`, context.request);
  }

  const thumbKey = thumbR2Key(pathname);
  if (thumbKey && context.env.MEDIA) {
    const thumbObject = await context.env.MEDIA.get(thumbKey);
    if (thumbObject) {
      const contentType = thumbKey.endsWith(".avif") ? "image/avif" : "image/webp";
      return serveMediaObject(thumbObject, contentType, method);
    }
  }

  const entry = OBJECTS[pathname];
  if (entry) {
    if (!context.env.MEDIA) return new Response("Media unavailable", { status: 503 });
    const object = await context.env.MEDIA.get(entry.key);
    if (!object) return new Response("Not found", { status: 404 });
    return serveMediaObject(object, entry.contentType, method);
  }

  // Guard: a missing image/video must 404, never the SPA index.html with a 7-day
  // media cache header (that cached HTML is what blanked Futuristic plates).
  const res = await context.next();
  if (/\.(webp|png|jpe?g|gif|avif|mp4|webm|mov)$/i.test(pathname)) {
    const type = res.headers.get("content-type") || "";
    if (type.toLowerCase().startsWith("text/html")) {
      return new Response("Not found", {
        status: 404,
        headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
      });
    }
  }
  return res;
};
