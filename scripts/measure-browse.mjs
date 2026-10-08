#!/usr/bin/env node
/**
 * Measure /images and /videos browse load (desktop + mobile throttling).
 * Usage:
 *   node scripts/measure-browse.mjs --origin=https://promptshare.fun --out=artifacts/browse-before.json
 */
import { chromium } from "playwright-core";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, ...rest] = a.replace(/^--/, "").split("=");
    return [k, rest.join("=") || "1"];
  }),
);

const ORIGIN = (args.origin || "https://promptshare.fun").replace(/\/+$/, "");
const OUT = args.out || "";
const CHROME = args.chrome || "/usr/local/bin/chrome";
const PATHS = (args.paths || "/images/,/videos/,/images/?tag=landscapes,/videos/?tag=landscapes").split(",");

const VIEWPORTS = {
  desktop: { width: 1365, height: 780, isMobile: false, hasTouch: false },
  mobile: { width: 390, height: 844, isMobile: true, hasTouch: true },
};

function summarizeResources(resources) {
  let bytes = 0;
  let count = 0;
  const byType = {};
  const media = [];
  for (const r of resources) {
    const size = Number(r.transferSize || r.encodedBodySize || 0);
    bytes += size;
    count += 1;
    const t = r.initiatorType || "other";
    byType[t] = (byType[t] || 0) + size;
    if (/\/media\/|\.(webp|jpe?g|png|avif|mp4|webm)(\?|$)/i.test(r.name)) {
      media.push({ url: r.name, bytes: size });
    }
  }
  media.sort((a, b) => b.bytes - a.bytes);
  return { count, bytes, byType, topMedia: media.slice(0, 12) };
}

async function measureOne(browser, path, profile) {
  const context = await browser.newContext({
    viewport: VIEWPORTS[profile],
    userAgent:
      profile === "mobile"
        ? "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
        : undefined,
    deviceScaleFactor: profile === "mobile" ? 3 : 1,
    isMobile: VIEWPORTS[profile].isMobile,
    hasTouch: VIEWPORTS[profile].hasTouch,
  });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Performance.enable");
  if (profile === "mobile") {
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: 150,
      downloadThroughput: (1.6 * 1024 * 1024) / 8,
      uploadThroughput: (750 * 1024) / 8,
    });
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  } else {
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: 40,
      downloadThroughput: (10 * 1024 * 1024) / 8,
      uploadThroughput: (5 * 1024 * 1024) / 8,
    });
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 2 });
  }

  const url = ORIGIN + path;
  const started = Date.now();
  const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90000 });
  const ttfbHeader = response ? response.headers()["cf-ray"] : "";
  await page.waitForTimeout(profile === "mobile" ? 12000 : 8000);
  try {
    await page.waitForFunction(
      () =>
        document.querySelector(".ps-ia-featured-card, .ps-videos-card--live, a.card .card-media img, .ps-videos-empty h2"),
      { timeout: 20000 },
    );
  } catch {
    /* still collect whatever painted */
  }
  await page.waitForTimeout(1500);

  const metrics = await page.evaluate(() => {
    const nav = performance.getEntriesByType("navigation")[0];
    const paints = Object.fromEntries(
      performance.getEntriesByType("paint").map((p) => [p.name, Math.round(p.startTime)]),
    );
    const lcpEntries = performance.getEntriesByType("largest-contentful-paint");
    const lcp = lcpEntries.length ? lcpEntries[lcpEntries.length - 1] : null;
    const resources = performance.getEntriesByType("resource").map((r) => ({
      name: r.name,
      initiatorType: r.initiatorType,
      transferSize: r.transferSize,
      encodedBodySize: r.encodedBodySize,
      duration: Math.round(r.duration),
    }));
    const longTasks = performance.getEntriesByType("longtask").map((t) => ({
      start: Math.round(t.startTime),
      duration: Math.round(t.duration),
    }));
    const cards = document.querySelectorAll(
      ".ps-ia-featured-card, .ps-videos-card--live, a.card",
    ).length;
    const imgs = Array.from(document.querySelectorAll("img")).map((img) => ({
      src: img.currentSrc || img.src,
      loading: img.loading,
      w: img.naturalWidth,
      h: img.naturalHeight,
      lazy: img.loading,
    }));
    const videos = Array.from(document.querySelectorAll("video")).map((v) => ({
      src: v.currentSrc || v.src,
      preload: v.preload,
      autoplay: v.autoplay,
    }));
    return {
      ttfb: nav ? Math.round(nav.responseStart) : null,
      fcp: paints["first-contentful-paint"] || null,
      lcp: lcp ? Math.round(lcp.startTime) : null,
      lcpUrl: lcp && lcp.url ? lcp.url : "",
      dcl: nav ? Math.round(nav.domContentLoadedEventEnd) : null,
      load: nav ? Math.round(nav.loadEventEnd) : null,
      resources,
      longTasks,
      longTaskCount: longTasks.length,
      longTaskMs: longTasks.reduce((s, t) => s + t.duration, 0),
      cards,
      imgCount: imgs.length,
      videoCount: videos.length,
      videos,
      firstImgs: imgs.slice(0, 6),
    };
  });

  const net = summarizeResources(metrics.resources);
  await context.close();
  return {
    url,
    profile,
    elapsedMs: Date.now() - started,
    status: response ? response.status() : null,
    ttfb: metrics.ttfb,
    fcp: metrics.fcp,
    lcp: metrics.lcp,
    lcpUrl: metrics.lcpUrl,
    dcl: metrics.dcl,
    load: metrics.load,
    requestCount: net.count,
    totalBytes: net.bytes,
    bytesByType: net.byType,
    topMedia: net.topMedia,
    longTaskCount: metrics.longTaskCount,
    longTaskMs: metrics.longTaskMs,
    cards: metrics.cards,
    imgCount: metrics.imgCount,
    videoCount: metrics.videoCount,
    videos: metrics.videos,
    firstImgs: metrics.firstImgs,
    cfRay: ttfbHeader || "",
  };
}

async function curlFeed(path) {
  const url = ORIGIN + path;
  const res = await fetch(url, { headers: { accept: "application/json" } });
  const buf = Buffer.from(await res.arrayBuffer());
  let count = 0;
  try {
    const data = JSON.parse(buf.toString("utf8"));
    count = Array.isArray(data.creations) ? data.creations.length : 0;
  } catch {
    /* ignore */
  }
  return {
    url,
    status: res.status,
    bytes: buf.length,
    cache: res.headers.get("cache-control") || "",
    creations: count,
  };
}

const browser = await chromium.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--disable-dev-shm-usage", "--no-sandbox"],
});

const results = { origin: ORIGIN, at: new Date().toISOString(), pages: [], feeds: [] };
try {
  for (const path of PATHS) {
    for (const profile of ["desktop", "mobile"]) {
      process.stderr.write(`measuring ${profile} ${path}\n`);
      try {
        results.pages.push(await measureOne(browser, path, profile));
      } catch (err) {
        results.pages.push({ url: ORIGIN + path, profile, error: String(err && err.message ? err.message : err) });
      }
    }
  }
  for (const feed of [
    "/api/feed?kind=image&limit=40",
    "/api/feed?kind=image&limit=120",
    "/api/feed?kind=video&limit=40",
    "/api/feed?kind=image&limit=24&fields=card",
  ]) {
    try {
      results.feeds.push(await curlFeed(feed));
    } catch (err) {
      results.feeds.push({ url: ORIGIN + feed, error: String(err) });
    }
  }
} finally {
  await browser.close();
}

const text = JSON.stringify(results, null, 2);
if (OUT) {
  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, text);
}
process.stdout.write(text + "\n");
