/* PromptShare q1 — prev/next plate arrows (SPA /p/:id plates + static /games/:slug/ plates).
   Order = the list the user opened the plate from (DOM order of the grid/rail they clicked in,
   captured in sessionStorage), extended past its ends by the media type's feed order
   (/api/feed?kind=…&tag=…). Steps use history.replaceState + popstate (no reload; Back returns
   to the grid). Games are static pages: location.replace (Back still returns to the grid).
   Keyboard ←/→ (not while typing, in fullscreen, or inside the player pill), swipe on the media. */
(function () {
  if (window.__psPlateNav) return;
  window.__psPlateNav = true;
  var CTX = "ps-plate-ctx-v1", GCTX = "ps-game-ctx-v1";
  var SVG_L = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M14.5 5.5 8 12l6.5 6.5"/></svg>';
  var SVG_R = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9.5 5.5 16 12l-6.5 6.5"/></svg>';

  function path() { return (location.pathname || "/").replace(/\/+$/, "") || "/"; }
  function plateId() { var m = /^\/p\/([^/?#]+)$/.exec(path()); return m ? decodeURIComponent(m[1]) : null; }
  function slugOk(s) { return s && s !== "featured" && s !== "play" && s !== "posters"; }
  function gameSlug() { var m = /^\/games\/([a-z0-9-]+)$/.exec(path()); return m && slugOk(m[1]) ? m[1] : null; }
  function idFromHref(h) { var m = /^(?:https?:\/\/[^/]+)?\/p\/([^/?#]+)/.exec(h || ""); return m ? decodeURIComponent(m[1]) : null; }
  function slugFromHref(h) { var m = /^(?:https?:\/\/[^/]+)?\/games\/([a-z0-9-]+)\/?(?:[?#].*)?$/.exec(h || ""); return m && slugOk(m[1]) ? m[1] : null; }
  function load(k) { try { return JSON.parse(sessionStorage.getItem(k) || "null"); } catch (e) { return null; } }
  function save(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function tagNow() { try { return new URL(location.href).searchParams.get("tag") || ""; } catch (e) { return ""; } }
  function fsOn() { return !!(document.fullscreenElement || document.webkitFullscreenElement); }

  /* ——— remember the list a plate was opened from ——— */
  document.addEventListener("click", function (ev) {
    if (ev.defaultPrevented && !ev.isTrusted) return;
    var a = ev.target && ev.target.closest && ev.target.closest("a[href]");
    if (!a || (a.closest && a.closest(".ps-pnav-btn, header, nav"))) return;
    var href = a.getAttribute("href") || "";
    var id = idFromHref(href), slug = id ? null : slugFromHref(href);
    if (!id && !slug) return;
    var sel = id ? 'a[href^="/p/"]' : 'a[href^="/games/"]';
    var keyOf = id ? function (x) { return idFromHref(x.getAttribute("href")); } : function (x) { return slugFromHref(x.getAttribute("href")); };
    var box = a.parentElement, list = null;
    while (box && box !== document.documentElement) {
      var seen = {}, ids = [];
      box.querySelectorAll(sel).forEach(function (x) {
        if (x.closest("header, nav")) return;
        var k = keyOf(x);
        if (k && !seen[k]) { seen[k] = 1; ids.push(k); }
      });
      if (ids.length >= 2) { list = ids; break; }
      box = box.parentElement;
    }
    if (!list) list = [id || slug];
    if (id) {
      var p = path(), kind = "";
      if (p === "/videos") kind = "video";
      else if (p === "/images") kind = "image";
      else if (a.querySelector("video") || a.classList.contains("ps-videos-card") || /video/.test(id)) kind = "video";
      else if (a.querySelector("img")) kind = "image";
      var prevCtx = load(CTX);
      if (plateId() && prevCtx && prevCtx.kind && !kind) kind = prevCtx.kind;
      var thumbs = {};
      if (box) box.querySelectorAll(sel).forEach(function (x) {
        var k = keyOf(x), im = x.querySelector("img");
        if (k && im && !thumbs[k]) thumbs[k] = im.currentSrc || im.getAttribute("src") || "";
      });
      save(CTX, { ids: list.slice(0, 600), thumbs: thumbs, kind: kind, tag: p === "/videos" || p === "/images" ? tagNow() : "", from: location.pathname + location.search, t: Date.now() });
    } else {
      save(GCTX, { slugs: list, from: location.pathname, t: Date.now() });
    }
  }, true);

  /* ——— order sources ——— */
  var feedCache = {};
  function feed(kind, tag) {
    var key = kind + "|" + tag;
    if (feedCache[key]) return feedCache[key];
    var out = { ids: [], thumbs: {}, titles: {} };
    function page(off) {
      var u = "/api/feed?kind=" + encodeURIComponent(kind) + "&limit=120&offset=" + off + "&fields=card" + (tag ? "&tag=" + encodeURIComponent(tag) : "");
      return fetch(u, { credentials: "same-origin" })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (d) {
          var cs = (d && d.creations) || [];
          cs.forEach(function (c) {
            if (!c || !c.id) return;
            out.ids.push(c.id);
            out.thumbs[c.id] = c.mediaKind === "video" ? (c.poster || c.thumbUrl || "") : (c.mediaUrl || c.thumbUrl || "");
            out.titles[c.id] = c.title || "";
          });
          if (cs.length === 120 && off < 840 && out.ids.length < ((d && d.total) || 0)) return page(off + 120);
          return out;
        })
        .catch(function () { return out; });
    }
    feedCache[key] = page(0);
    return feedCache[key];
  }
  var catalogP = null;
  function catalog() {
    if (!catalogP) {
      catalogP = fetch("/games/catalog.json", { credentials: "same-origin" })
        .then(function (r) { return r.ok ? r.json() : []; })
        .then(function (c) {
          var g = Array.isArray(c) ? c : (c && (c.games || c.items)) || [];
          var out = { ids: [], titles: {} };
          g.forEach(function (x) { var s = x && (x.slug || x.id); if (slugOk(s)) { out.ids.push(s); out.titles[s] = x.title || x.name || ""; } });
          return out;
        })
        .catch(function () { return { ids: [], titles: {} }; });
    }
    return catalogP;
  }
  function neighbors(cur, list, ext) {
    var prev = null, next = null, i = list ? list.indexOf(cur) : -1;
    if (i >= 0) { prev = list[i - 1] || null; next = list[i + 1] || null; }
    if (ext && (!prev || !next)) {
      var j = ext.indexOf(cur);
      if (j >= 0) {
        if (!prev) prev = ext[j - 1] || null;
        if (!next) next = ext[j + 1] || null;
      }
    }
    if (prev === cur) prev = null;
    if (next === cur) next = null;
    return { prev: prev, next: next };
  }
  function plateKind() {
    if (document.querySelector(".creation .stage.is-video, .creation video.ps-plate-video")) return "video";
    if (document.querySelector(".creation .stage.is-image, .creation .stage img")) return "image";
    return "";
  }

  /* ——— buttons ——— */
  var btnPrev = null, btnNext = null;
  var st = { key: null, kind: null, cur: null, prev: null, next: null, thumbs: {}, titles: {} };
  function mk(dir) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "ps-pnav-btn ps-pnav-" + (dir < 0 ? "prev" : "next");
    b.setAttribute("aria-label", dir < 0 ? "Previous" : "Next");
    b.innerHTML = dir < 0 ? SVG_L : SVG_R;
    b.addEventListener("click", function (ev) { ev.preventDefault(); go(dir); });
    document.body.appendChild(b);
    return b;
  }
  function ensureBtns() {
    if (!document.body) return false;
    if (!btnPrev || !btnPrev.isConnected) btnPrev = mk(-1);
    if (!btnNext || !btnNext.isConnected) btnNext = mk(1);
    return true;
  }
  function dropBtns() {
    [btnPrev, btnNext].forEach(function (b) { if (b && b.parentNode) b.parentNode.removeChild(b); });
    btnPrev = btnNext = null;
  }
  function labelFor(dir) {
    var id = dir < 0 ? st.prev : st.next, t = id && st.titles[id];
    return (dir < 0 ? "Previous" : "Next") + (st.kind === "game" ? " game" : "") + (t ? ": " + t : "");
  }
  function paint() {
    if (!btnPrev) return;
    [[btnPrev, st.prev, -1], [btnNext, st.next, 1]].forEach(function (e) {
      var b = e[0];
      if (e[1]) b.removeAttribute("aria-disabled"); else b.setAttribute("aria-disabled", "true");
      b.tabIndex = e[1] ? 0 : -1;
      b.setAttribute("aria-label", labelFor(e[2]));
      b.title = labelFor(e[2]);
    });
    place();
  }
  var placeQ = false;
  function place() {
    if (!btnPrev) return;
    var media = st.kind === "game" ? document.querySelector(".ps-stage-row > .frame") : document.querySelector(".creation .stage");
    var row = st.kind === "game" ? document.querySelector(".ps-stage-row") : media;
    var ok = media && row && !fsOn() && (st.prev || st.next);
    var r = ok ? media.getBoundingClientRect() : null, rr = ok ? row.getBoundingClientRect() : null;
    var vw = document.documentElement.clientWidth || innerWidth, vh = innerHeight;
    if (!r || r.width < 40 || r.bottom < 70 || r.top > vh - 40) {
      btnPrev.classList.remove("is-ready"); btnNext.classList.remove("is-ready");
      return;
    }
    var gl = rr.left, gr = vw - rr.right;
    var overlay = Math.min(gl, gr) < 58;
    var top = Math.max(r.top, 76), bot = Math.min(r.bottom, vh - 12);
    /* overlay arrows on a video sit in the band above the native controls / quality pill */
    if (overlay && st.kind !== "game" && media.querySelector("video")) bot = Math.min(bot, r.bottom - 64);
    var cy = bot - top > 60 ? (top + bot) / 2 : r.top + r.height / 2;
    var xl, xr;
    if (overlay) { xl = r.left + 8 + 18; xr = (st.kind === "game" ? r.right : rr.right) - 8 - 18; }
    else { xl = rr.left - Math.min(gl / 2, 52); xr = rr.right + Math.min(gr / 2, 52); }
    [[btnPrev, xl], [btnNext, xr]].forEach(function (e) {
      var b = e[0];
      b.classList.toggle("is-overlay", overlay);
      b.style.transform = "";
      b.style.left = Math.round(e[1]) + "px";
      b.style.top = Math.round(cy) + "px";
      b.classList.add("is-ready");
    });
  }
  function schedulePlace() {
    if (placeQ) return;
    placeQ = true;
    requestAnimationFrame(function () { placeQ = false; place(); });
  }
  var prefetched = {};
  function prefetch() {
    [st.prev, st.next].forEach(function (id) {
      if (!id || prefetched[st.kind + id]) return;
      prefetched[st.kind + id] = 1;
      if (st.kind === "game") {
        var l = document.createElement("link");
        l.rel = "prefetch";
        l.href = "/games/" + id + "/";
        document.head.appendChild(l);
        new Image().src = "/games/posters/" + id + ".svg";
        return;
      }
      var u = st.thumbs[id];
      if (u) { var im = new Image(); im.decoding = "async"; im.src = u; }
    });
  }
  function setNb(nb) {
    st.prev = nb.prev;
    st.next = nb.next;
    paint();
    prefetch();
  }
  function refresh() {
    var id = plateId(), slug = id ? null : gameSlug();
    if (!id && !slug) { if (btnPrev) dropBtns(); st.key = null; return; }
    if (!ensureBtns()) return;
    var key = id ? "p:" + id : "g:" + slug;
    if (st.key === key && (st.kind || !id)) { schedulePlace(); return; }
    if (slug) {
      st.key = key; st.kind = "game"; st.cur = slug; st.prev = st.next = null;
      var gctx = load(GCTX), inG = gctx && gctx.slugs && gctx.slugs.indexOf(slug) >= 0;
      catalog().then(function (c) {
        if (st.key !== key) return;
        st.titles = c.titles;
        setNb(neighbors(slug, inG ? gctx.slugs : null, c.ids));
      });
      paint();
      return;
    }
    var ctx = load(CTX), inCtx = !!(ctx && ctx.ids && ctx.ids.indexOf(id) >= 0);
    var kind = (inCtx && ctx.kind) || plateKind();
    if (!kind && !inCtx) { schedulePlace(); return; } /* plate not rendered yet; retry on next mutation */
    st.key = key; st.kind = kind || "plate"; st.cur = id;
    st.thumbs = (inCtx && ctx.thumbs) || {};
    st.titles = {};
    setNb(neighbors(id, inCtx ? ctx.ids : null, null));
    if (kind) {
      feed(kind, inCtx ? ctx.tag || "" : "").then(function (f) {
        if (st.key !== key) return;
        for (var k in f.thumbs) st.thumbs[k] = f.thumbs[k];
        st.titles = f.titles;
        setNb(neighbors(id, inCtx ? ctx.ids : null, f.ids));
      });
    }
  }

  /* ——— navigation ——— */
  function go(dir) {
    var target = dir < 0 ? st.prev : st.next;
    if (!target) return;
    if (st.kind === "game") { location.replace("/games/" + target + "/"); return; }
    var url = "/p/" + encodeURIComponent(target);
    var stage = document.querySelector(".creation .stage");
    var r = stage ? stage.getBoundingClientRect() : null;
    try { history.replaceState(history.state, "", url); } catch (e) { location.replace(url); return; }
    try { window.dispatchEvent(new PopStateEvent("popstate", { state: history.state })); } catch (e2) { location.replace(url); return; }
    refresh();
    /* Keep the plate in view: only scroll when the media was mostly off-screen. */
    if (r && (r.top < -r.height * 0.4 || r.top > innerHeight * 0.7)) {
      setTimeout(function () {
        var s2 = document.querySelector(".creation .stage");
        if (s2) window.scrollTo({ top: Math.max(0, s2.getBoundingClientRect().top + scrollY - 96), behavior: "smooth" });
      }, 80);
    }
  }
  document.addEventListener("keydown", function (ev) {
    if (ev.key !== "ArrowLeft" && ev.key !== "ArrowRight") return;
    if (ev.defaultPrevented || ev.altKey || ev.ctrlKey || ev.metaKey || ev.shiftKey || !st.key || fsOn()) return;
    var t = ev.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT|VIDEO|AUDIO|IFRAME|CANVAS)$/.test(t.tagName))) return;
    if (t && t.closest && t.closest('.ps-q, [role="slider"], [role="radiogroup"], [role="tablist"], [role="listbox"], [role="menu"], dialog, [aria-modal="true"]')) return;
    if (document.querySelector('dialog[open], [aria-modal="true"]')) return;
    ev.preventDefault();
    go(ev.key === "ArrowLeft" ? -1 : 1);
  });
  /* swipe on the media (not on the video controls strip / pill; games: outside the iframe) */
  var sw = null;
  document.addEventListener("touchstart", function (ev) {
    sw = null;
    if (!st.key || ev.touches.length !== 1 || fsOn()) return;
    var t = ev.target;
    var area = st.kind === "game" ? t.closest && t.closest("main") : t.closest && t.closest(".creation .stage");
    if (!area || (t.closest && t.closest(".ps-q, .ps-pnav-btn, a, button, input, textarea"))) return;
    var p = ev.touches[0];
    if (st.kind !== "game") {
      var r = area.getBoundingClientRect();
      if (area.querySelector("video") && p.clientY > r.bottom - 56) return;
    }
    sw = { x: p.clientX, y: p.clientY, t: Date.now() };
  }, { passive: true });
  document.addEventListener("touchend", function (ev) {
    if (!sw) return;
    var p = ev.changedTouches[0], dx = p.clientX - sw.x, dy = p.clientY - sw.y, dt = Date.now() - sw.t;
    sw = null;
    if (dt < 700 && Math.abs(dx) > 56 && Math.abs(dx) > Math.abs(dy) * 1.8) go(dx > 0 ? -1 : 1);
  }, { passive: true });

  /* ——— route + layout tracking ——— */
  ["pushState", "replaceState"].forEach(function (k) {
    var orig = history[k];
    if (typeof orig !== "function" || orig.__psPnav) return;
    history[k] = function () { var r = orig.apply(this, arguments); setTimeout(refresh, 0); return r; };
    history[k].__psPnav = true;
  });
  window.addEventListener("popstate", function () { setTimeout(refresh, 0); });
  window.addEventListener("resize", schedulePlace);
  window.addEventListener("scroll", schedulePlace, { passive: true });
  document.addEventListener("fullscreenchange", schedulePlace);
  document.addEventListener("webkitfullscreenchange", schedulePlace);
  var mq = false;
  function boot() {
    refresh();
    new MutationObserver(function () {
      if (mq) return;
      mq = true;
      setTimeout(function () { mq = false; refresh(); schedulePlace(); }, 120);
    }).observe(document.body, { childList: true, subtree: true });
    if (window.ResizeObserver) {
      var ro = new ResizeObserver(schedulePlace);
      ro.observe(document.body);
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
  window.__psPlateNavState = st;
})();
