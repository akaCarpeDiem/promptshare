#!/usr/bin/env python3
"""
PromptShare card-hover preview proxies (720p @ 60fps).

Every published video plate keeps its full master at /media/video/<name>.mp4
(plate / detail / fullscreen). Grid + featured cards play a lighter proxy on
hover from /media/video-preview/<name>.mp4 (R2 key media/video-preview/<name>.mp4).

Encode spec (locked 2026-10-07, approved by Logan):
  scale=-2:720, fps=60, H.264 High, yuv420p, CRF 23, maxrate 4M, bufsize 8M,
  +faststart, no audio.

Usage:
  # All published videos from the live feed, encode + upload + verify
  python3 scripts/make-video-previews.py --feed --upload --verify-live

  # New plate during ingest (local master file named exactly like its /media/video/ file)
  python3 scripts/make-video-previews.py --upload path/to/us-cities-foo.mp4

Requires: ffmpeg/ffprobe, curl, npx wrangler (CLOUDFLARE_API_TOKEN) for --upload.
"""
import argparse, concurrent.futures as cf, json, os, subprocess, sys, urllib.parse
from pathlib import Path

ORIGIN = "https://promptshare.fun"
BUCKET = "promptshare-media"
PREFIX = "media/video-preview/"
UA = "Mozilla/5.0 (PromptShare preview builder)"

def run(cmd, **kw):
    return subprocess.run(cmd, check=True, text=True, capture_output=True, **kw)

def probe(path):
    out = run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
               "stream=width,height,avg_frame_rate,r_frame_rate,codec_name,profile,pix_fmt",
               "-show_entries", "format=size,duration,bit_rate", "-of", "json", str(path)]).stdout
    d = json.loads(out)
    s = d["streams"][0]; f = d["format"]
    a = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "a", "-show_entries",
                        "stream=index", "-of", "csv=p=0", str(path)], text=True, capture_output=True).stdout.strip()
    return {**s, "size": int(f["size"]), "duration": float(f.get("duration") or 0),
            "bit_rate": int(f.get("bit_rate") or 0), "has_audio": bool(a)}

def feed_urls():
    raw = run(["curl", "-sS", "-A", UA, f"{ORIGIN}/api/feed?kind=video&limit=120&offset=0&fields=card"]).stdout
    d = json.loads(raw)
    items = d.get("creations", [])
    if d.get("total", 0) > len(items):
        print(f"WARN feed total {d['total']} > page {len(items)}; paging", file=sys.stderr)
        off = len(items)
        while off < d["total"]:
            more = json.loads(run(["curl", "-sS", "-A", UA,
                f"{ORIGIN}/api/feed?kind=video&limit=120&offset={off}&fields=card"]).stdout)["creations"]
            if not more: break
            items += more; off += len(more)
    seen, urls = set(), []
    for c in items:
        u = c.get("mediaUrl") or ""
        base = u.split("?")[0]
        if base.startswith("/media/video/") and base.endswith(".mp4") and base not in seen:
            seen.add(base); urls.append(u)
    return urls

def encode(src, dst):
    dst.parent.mkdir(parents=True, exist_ok=True)
    tmp = dst.with_suffix(".tmp.mp4")
    run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(src), "-an",
         "-vf", "scale=-2:720:flags=lanczos,fps=60",
         "-c:v", "libx264", "-profile:v", "high", "-pix_fmt", "yuv420p", "-preset", "slow",
         "-crf", "23", "-maxrate", "4M", "-bufsize", "8M", "-g", "120",
         "-movflags", "+faststart", str(tmp)])
    tmp.rename(dst)

def verify(p):
    i = probe(p)
    ok = (i["height"] == 720 and i["avg_frame_rate"] == "60/1" and i["codec_name"] == "h264"
          and i["pix_fmt"] == "yuv420p" and not i["has_audio"])
    return ok, i

def upload(p, name):
    run(["npx", "wrangler", "r2", "object", "put", f"{BUCKET}/{PREFIX}{name}", "--remote",
         "--file", str(p), "--content-type", "video/mp4",
         "--cache-control", "public, max-age=31536000, immutable"],
        env={**os.environ, "WRANGLER_CACHE_DIR": os.environ.get("WRANGLER_CACHE_DIR", "/tmp/wrangler-cache")})

def live_check(name):
    url = f"{ORIGIN}/media/video-preview/{name}?v=check{os.getpid()}"
    h = run(["curl", "-sS", "-A", UA, "-o", "/dev/null", "-D", "-", "-H", "Range: bytes=0-1023", url]).stdout.lower()
    status = h.splitlines()[0] if h else ""
    return ("206" in status and "content-type: video/mp4" in h and "content-range: bytes 0-1023/" in h), status

def process(item, args):
    work = Path(args.work)
    if item.startswith("/media/") or item.startswith("http"):
        url = item if item.startswith("http") else ORIGIN + item
        name = Path(urllib.parse.urlparse(url).path).name
        master = work / "masters" / name
        if not master.exists() or master.stat().st_size == 0:
            master.parent.mkdir(parents=True, exist_ok=True)
            run(["curl", "-sS", "-f", "-L", "-A", UA, "-o", str(master), url])
    else:
        master = Path(item); name = master.name
    res = {"name": name}
    try:
        mi = probe(master)
        res["master"] = {k: mi[k] for k in ("width", "height", "avg_frame_rate", "size", "bit_rate")}
        out = work / "previews" / name
        if args.force or not out.exists():
            encode(master, out)
        ok, pi = verify(out)
        res["preview"] = {k: pi[k] for k in ("width", "height", "avg_frame_rate", "size", "bit_rate", "profile")}
        res["ok"] = ok
        if not ok:
            res["error"] = "preview verify failed"; return res
        if mi["avg_frame_rate"] != "60/1":
            res["note"] = f"master fps {mi['avg_frame_rate']} (fps=60 filter applied)"
        if args.upload:
            upload(out, name); res["uploaded"] = True
        if args.verify_live:
            live_ok, st = live_check(name); res["live"] = live_ok; res["live_status"] = st
            if not live_ok: res["ok"] = False; res["error"] = f"live check failed: {st}"
    except subprocess.CalledProcessError as e:
        res["ok"] = False; res["error"] = (e.stderr or str(e))[-500:]
    return res

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("items", nargs="*", help="/media/video/... URLs or local master .mp4 files")
    ap.add_argument("--feed", action="store_true", help="all published videos from live feed")
    ap.add_argument("--work", default="/workspace/ps-video-previews")
    ap.add_argument("--jobs", type=int, default=3)
    ap.add_argument("--upload", action="store_true")
    ap.add_argument("--verify-live", action="store_true")
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()
    items = list(args.items) + (feed_urls() if args.feed else [])
    if not items: ap.error("nothing to do")
    print(f"{len(items)} videos", flush=True)
    results = []
    with cf.ThreadPoolExecutor(args.jobs) as ex:
        for r in ex.map(lambda it: process(it, args), items):
            results.append(r)
            p = r.get("preview", {}); m = r.get("master", {})
            print(f"{'OK ' if r.get('ok') else 'ERR'} {r['name']} master {m.get('size',0)/1e6:.1f}MB "
                  f"-> preview {p.get('width')}x{p.get('height')}@{p.get('avg_frame_rate')} {p.get('size',0)/1e6:.2f}MB "
                  f"{r.get('note','')} {r.get('error','')}", flush=True)
    Path(args.work).mkdir(parents=True, exist_ok=True)
    (Path(args.work) / "manifest.json").write_text(json.dumps(results, indent=1))
    bad = [r for r in results if not r.get("ok")]
    print(f"done {len(results)-len(bad)}/{len(results)} ok; manifest {Path(args.work)/'manifest.json'}")
    sys.exit(1 if bad else 0)

if __name__ == "__main__":
    main()
