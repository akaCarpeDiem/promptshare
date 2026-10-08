#!/usr/bin/env python3
"""hdr1: put the ONE canonical glass header (logo + Images/Videos/Games + search) into the initial HTML
of every PromptShare page. Idempotent: re-running replaces the bar between the hdr1 markers.
Home (/) gets the bar via index.html (shared by plates/search/404) but CSS hides it on data-ps-route=discover."""
import re, sys, pathlib
OV = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "/workspace/promptshare-deploy/overlay")
V = "20261007hdr1"  # header CSS link is bumped separately (hdr2)
CSS = '<link rel="stylesheet" href="/assets/ps-header-v1.css?v=20261007hdr2">'
FONT = '<link rel="preload" href="/fonts/outfit-normal-400.woff2" as="font" type="font/woff2" crossorigin>'
LOGO = ('<svg class="logo-mark" width="32" height="32" viewBox="0 0 48 48" aria-hidden="true"><defs><linearGradient id="ps-hdr-mark" x1="0" y1="0" x2="1" y2="1">'
        '<stop offset="0" stop-color="#8ee9ff"/><stop offset="1" stop-color="#c4a6ff"/></linearGradient></defs>'
        '<rect x="3.2" y="6.4" width="28.4" height="16.8" rx="5.2" fill="#1c1e2c" stroke="url(#ps-hdr-mark)" stroke-width="1.7"/>'
        '<path d="M8.2 14.8h9.2" fill="none" stroke="#f4f1ff" stroke-width="1.35" stroke-linecap="round" opacity="0.9"/>'
        '<path d="M20.2 12.2 23.4 14.8 20.2 17.4" fill="none" stroke="#8ee9ff" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>'
        '<rect x="16.4" y="24.8" width="28.4" height="16.8" rx="5.2" fill="#1c1e2c" stroke="url(#ps-hdr-mark)" stroke-width="1.7"/>'
        '<path d="M30.6 33.2h9.2" fill="none" stroke="#f4f1ff" stroke-width="1.35" stroke-linecap="round" opacity="0.9"/>'
        '<path d="M27.8 30.6 24.6 33.2l3.2 2.6" fill="none" stroke="#c4a6ff" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>')
JS = ('<script>(function(){var d=document,h=d.currentScript.previousElementSibling;if(!h||!h.matches("header.ps-gbar"))return;'
      'function sec(){var p=location.pathname;if(/^\\/images(\\/|$)/.test(p))return"images";if(/^\\/videos(\\/|$)/.test(p))return"videos";if(/^\\/games(\\/|$)/.test(p))return"games";'
      'if(p.indexOf("/p/")===0){var s=d.querySelector(".creation .stage.is-video,.creation .stage.is-image");if(s)return s.classList.contains("is-video")?"videos":"images";'
      'var k=d.documentElement.getAttribute("data-ps-plate-kind");return k==="video"?"videos":k==="image"?"images":""}return""}'
      'function upd(){var c=sec();[].forEach.call(h.querySelectorAll("nav a[data-ps-nav]"),function(a){if(a.getAttribute("data-ps-nav")===c)a.setAttribute("aria-current","page");else a.removeAttribute("aria-current")})}'
      'upd();try{var q=new URLSearchParams(location.search).get("q");if(q&&/^\\/search/.test(location.pathname))h.querySelector("input").value=q}catch(e){}'
      'function soon(){setTimeout(upd,0);setTimeout(upd,450)}["pushState","replaceState"].forEach(function(m){var o=history[m];history[m]=function(){var r=o.apply(this,arguments);soon();return r}});'
      'addEventListener("popstate",soon);addEventListener("DOMContentLoaded",upd)})();</script>')

def bar(active=""):
    links = "".join(
        f'<a href="/{k}/" data-ps-nav="{k}"' + (' aria-current="page"' if k == active else "") + f'>{k.capitalize()}</a>'
        for k in ("images", "videos", "games"))
    return ('<!--ps-hdr1--><header class="ps-gbar" data-ps-hdr="1"><a class="brand" href="/">' + LOGO + '<span class="brand-name">PromptShare</span></a>'
            f'<nav aria-label="Primary">{links}</nav>'
            '<form class="ps-gsearch" role="search" action="/search/" method="get"><label class="ps-visually-hidden" for="ps-hdr-q">Search prompts</label>'
            '<input id="ps-hdr-q" name="q" type="search" placeholder="Prompt, model, tag" autocomplete="off" enterkeyhint="search"></form></header>' + JS + '<!--/ps-hdr1-->')

def head_assets(s):
    s = re.sub(r'\s*<link rel="stylesheet" href="/assets/ps-header-v1\.css\?v=[^"]*">', "", s)
    if "outfit-normal-400.woff2\" as=\"font\"" not in s:
        s = s.replace("</head>", f"{FONT}\n</head>", 1)
    return s.replace("</head>", f"{CSS}\n</head>", 1)

def html_attr(s, val="1"):
    s = re.sub(r'(<html\b[^>]*?)\s+data-ps-hdr="[^"]*"', r"\1", s, count=1)
    return re.sub(r"<html\b", f'<html data-ps-hdr="{val}"', s, count=1)

def put_bar(s, active, where):
    s = re.sub(r"<!--ps-hdr1-->[\s\S]*?<!--/ps-hdr1-->\n?", "", s)
    if where == "before-root":
        assert s.count('<div id="root">') == 1
        return s.replace('<div id="root">', bar(active) + '\n    <div id="root">', 1)
    if where == "after-body":
        return re.sub(r"(<body\b[^>]*>)", lambda m: m.group(1) + "\n" + bar(active), s, count=1)
    raise ValueError(where)

changed = []
def edit(rel, fn):
    p = OV / rel; s0 = p.read_text(encoding="utf-8"); s = fn(s0)
    if s != s0: p.write_text(s, encoding="utf-8"); changed.append(rel)

BUNDLE = {"index-22c3e0df.js": "index-22c3e0dh.js", "index-22c3e0dg.js": "index-22c3e0di.js"}
def common_spa(s):
    for a, b in BUNDLE.items():
        s = re.sub(rf'/assets/{re.escape(a)}\?v=[^"]*', f"/assets/{b}?v={V}", s)
    s = re.sub(r'(ps-nav-v4\.js)\?v=[^"]*', rf"\1?v={V}", s)
    s = re.sub(r'(ps-gallery-v1-20261006browse1\.js)\?v=[^"]*', rf"\1?v={V}", s)
    s = re.sub(r'(navigator\.serviceWorker\.register\("/sw\.js)\?v=[^"]*"', rf'\1?v={V}"', s)
    return s

# 1) index.html: shell for /, plates (SSR), /search, /me, /u/*, SPA 404s. Bar hidden on home by CSS.
edit("index.html", lambda s: head_assets(html_attr(put_bar(common_spa(s), "", "before-root"))))
# 2) Images / Videos: drop the b2c598a3 in-root static net-bar (React replaced it anyway), add the canonical bar.
def shelf(active):
    def f(s):
        s = re.sub(r'<header class="net-bar" data-ps-static-bar="1">[\s\S]*?</header>', "", s, count=1)
        return head_assets(html_attr(put_bar(common_spa(s), active, "before-root")))
    return f
edit("images/index.html", shelf("images"))
edit("videos/index.html", shelf("videos"))
edit("creators/index.html", lambda s: head_assets(html_attr(put_bar(common_spa(s), "", "before-root"))))
# 3) Games pages: replace the old 2-link static bar.
def games(s):
    s = re.sub(r'<header class="ps-gbar">[\s\S]*?</header>\n?', "", s, count=1)
    return head_assets(html_attr(put_bar(s, "games", "after-body")))
for p in sorted(OV.glob("games/*/index.html")):
    if p.parent.name == "play": continue
    edit(str(p.relative_to(OV)), games)
edit("games/index.html", games)
# 4) Legal/info pages (dark legal.css): replace header.top with the canonical bar.
def legal(s):
    s = re.sub(r'\s*<header class="top">[\s\S]*?</header>', "", s, count=1)
    return head_assets(html_attr(put_bar(s, "", "after-body"), "dark"))
for rel in ("about/index.html", "privacy/index.html", "terms/index.html", "contact/index.html", "cookies/index.html"):
    edit(rel, legal)
print(len(changed), "files changed"); print("\n".join(changed))
