#!/usr/bin/env node
/**
 * Build ~640px WebP (and optional AVIF) grid thumbs from full-res stills/posters.
 * Does not write into git. Run on the owner's box where dist/media exists.
 *
 *   node scripts/generate-thumbs.mjs --src=dist/media --out=dist/media/thumbs
 */
import { spawn } from "node:child_process";
import { mkdir, readdir, stat } from "node:fs/promises";
import { join, parse } from "node:path";

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, ...rest] = a.replace(/^--/, "").split("=");
    return [k, rest.join("=") || "1"];
  }),
);

const SRC = args.src || "dist/media";
const OUT = args.out || "dist/media/thumbs";
const WIDTH = Number(args.width || 640);
const QUALITY = Number(args.quality || 72);
const AVIF = Boolean(args.avif);
const FOLDERS = ["images", "posters"];

function run(cmd, argv) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, argv, { stdio: ["ignore", "pipe", "pipe"] });
    let err = "";
    child.stderr.on("data", (d) => {
      err += d;
    });
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(err || `${cmd} exited ${code}`));
    });
  });
}

async function whichFfmpeg() {
  try {
    await run("ffmpeg", ["-version"]);
    return "ffmpeg";
  } catch {
    return "";
  }
}

async function listImages(dir) {
  let names = [];
  try {
    names = await readdir(dir);
  } catch {
    return [];
  }
  return names.filter((n) => /\.(webp|png|jpe?g|avif)$/i.test(n));
}

async function newer(src, dest) {
  try {
    const [a, b] = await Promise.all([stat(src), stat(dest)]);
    return a.mtimeMs <= b.mtimeMs;
  } catch {
    return false;
  }
}

const ffmpeg = await whichFfmpeg();
if (!ffmpeg) {
  console.error("ffmpeg is required to generate thumbs.");
  process.exit(1);
}

let made = 0;
let skipped = 0;
for (const folder of FOLDERS) {
  const srcDir = join(SRC, folder);
  const outDir = join(OUT, folder);
  await mkdir(outDir, { recursive: true });
  const files = await listImages(srcDir);
  for (const name of files) {
    const srcFile = join(srcDir, name);
    const base = parse(name).name;
    const destWebp = join(outDir, `${base}.webp`);
    if (await newer(srcFile, destWebp)) {
      skipped += 1;
    } else {
      await run(ffmpeg, [
        "-y",
        "-i",
        srcFile,
        "-vf",
        `scale=${WIDTH}:-2`,
        "-frames:v",
        "1",
        "-c:v",
        "libwebp",
        "-quality",
        String(QUALITY),
        destWebp,
      ]);
      made += 1;
    }
    if (AVIF) {
      const destAvif = join(outDir, `${base}.avif`);
      if (!(await newer(srcFile, destAvif))) {
        await run(ffmpeg, [
          "-y",
          "-i",
          srcFile,
          "-vf",
          `scale=${WIDTH}:-2`,
          "-frames:v",
          "1",
          destAvif,
        ]);
        made += 1;
      }
    }
  }
}

console.log(`thumbs ready: wrote ${made}, skipped ${skipped}. output=${OUT}`);
console.log("Upload media/thumbs/images and media/thumbs/posters to R2 (promptshare-media). Do not commit the binaries.");
