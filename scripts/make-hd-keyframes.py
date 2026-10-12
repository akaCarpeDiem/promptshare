#!/usr/bin/env python3
"""Regenerate overlay/assets/ps-hd-keyframes-v1.json (keyframe times of the 1080p masters).

The plate player (hd1) swaps 720p preview -> 1080p master on fullscreen exactly at a master
keyframe so the decoder never has to decode mid-GOP (avoids a ~0.5 s freeze). Run this after
adding videos, then bump the ?v= on the JSON reference in ps-gallery-v1-20261006browse1.js
(the psKfPromise fetch in psKeyframes) and redeploy. Videos missing from the manifest still upgrade, just with a longer hold.

usage: scripts/make-hd-keyframes.py [--masters /workspace/ps-video-previews/masters] [--out overlay/assets/ps-hd-keyframes-v1.json]
"""
import argparse, json, pathlib, subprocess, concurrent.futures as cf

def keyframes(p):
    out = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-skip_frame", "nokey",
                          "-show_entries", "frame=best_effort_timestamp_time", "-of", "csv=p=0", str(p)],
                         capture_output=True, text=True, check=True).stdout
    ts = sorted({round(float(x.strip().strip(",")), 4) for x in out.split() if x.strip().strip(",") not in ("", "N/A")})
    return ts

ap = argparse.ArgumentParser()
ap.add_argument("--masters", default="/workspace/ps-video-previews/masters")
ap.add_argument("--previews", default="/workspace/ps-video-previews/previews")
ap.add_argument("--out", default=str(pathlib.Path(__file__).resolve().parent.parent / "overlay/assets/ps-hd-keyframes-v1.json"))
a = ap.parse_args()
files = sorted(pathlib.Path(a.masters).glob("*.mp4"))
pfiles = sorted(pathlib.Path(a.previews).glob("*.mp4")) if a.previews else []
with cf.ThreadPoolExecutor(8) as ex:
    res = dict(zip((f.name for f in files), ex.map(keyframes, files)))
    # q1: 720p previews too (key "preview:<name>"), used when the bare <video> element is fullscreen
    res.update(zip(("preview:" + f.name for f in pfiles), ex.map(keyframes, pfiles)))
pathlib.Path(a.out).write_text(json.dumps(res, separators=(",", ":")))
print(f"wrote {a.out}: {len(files)} masters + {len(pfiles)} previews")
