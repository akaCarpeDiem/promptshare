/* PromptShare — gallery-only hardening + Videos page (no header Videos nav) (API-backed) */
(function () {
  var MARK = "data-ps-gallery-v1";
  var RENDERED = "data-ps-videos-rendered";
  var scanning = false;
  var scanTimer = null;
  /* Same taxonomy as image PS_CATS — Fantasy included once (no duplicate slug). */
  var CATS = [
    { slug: "landscapes", label: "Landscapes" },
    { slug: "cities", label: "Cities" },
    { slug: "street", label: "Street" },
    { slug: "people", label: "People" },
    { slug: "portraits", label: "Portraits" },
    { slug: "cyberpunk", label: "Cyberpunk" },
    { slug: "futuristic", label: "Futuristic" },
    { slug: "animals", label: "Animals" },
    { slug: "fictional-animals", label: "Fictional Animals" },
    { slug: "myths", label: "Myths" },
    { slug: "comic", label: "Comic book art" },
    { slug: "anime", label: "Anime" },
    { slug: "food", label: "Food" },
    { slug: "architecture", label: "Architecture" },
    { slug: "space", label: "Space" },
    { slug: "fantasy", label: "Fantasy" },
    { slug: "vehicles", label: "Vehicles" },
    { slug: "nature", label: "Nature" },
  ];

  function path() {
    return (location.pathname || "/").replace(/\/+$/, "") || "/";
  }

  function activeCat() {
    try {
      return new URL(location.href).searchParams.get("tag") || "";
    } catch (e) {
      return "";
    }
  }

  function muteObs(on) {
    if (on) document.documentElement.dataset.psMuteObs = "1";
    else delete document.documentElement.dataset.psMuteObs;
  }

  function hideUgc() {
    document.querySelectorAll('a[href="/upload"], a[href="/upload/"]').forEach(function (a) {
      a.setAttribute("hidden", "true");
      a.style.display = "none";
    });
    document.querySelectorAll(".head-actions button[aria-pressed]").forEach(function (b) {
      b.setAttribute("hidden", "true");
      b.style.display = "none";
    });
  }

  function stripVideosNav() {
    /* Videos stays at /videos for seeding; not in primary/header nav. */
    document.querySelectorAll("nav.net-links a[href='/videos'], nav.net-links a[href='/videos/'], nav.net-tabbar a[href='/videos'], nav.net-tabbar a[href='/videos/'], nav[aria-label='Primary'] a[href='/videos'], nav[aria-label='App'] a[href='/videos']").forEach(function (a) {
      if (a.classList.contains("ps-discover") || a.classList.contains("ps-cross-nav") || a.getAttribute("data-ps-cross-nav") || a.getAttribute("data-ps-eye") === "1" || a.getAttribute("data-ps-swap")) return;
      a.setAttribute("hidden", "true");
      a.style.display = "none";
    });
  }

  /* The first request for a newly published Pages asset can be a cached SPA fallback.
     Keep the plate's canonical mediaUrl unchanged, but bypass that edge entry in the player. */
  function mediaSrc(src) {
    src = String(src || "");
    if ((src.indexOf("/media/video/landscapes-salt-flat.mp4") === 0 || src.indexOf("/media/posters/landscapes-salt-flat.jpg") === 0) && src.indexOf("v=20261002salt1") < 0) {
      return src + (src.indexOf("?") >= 0 ? "&" : "?") + "v=20261002salt1";
    }
    if ((src.indexOf("/media/video/landscapes-highland-ridge.mp4") === 0 || src.indexOf("/media/posters/landscapes-highland-ridge.jpg") === 0) && src.indexOf("v=20261002highland1") < 0) {
      return src + (src.indexOf("?") >= 0 ? "&" : "?") + "v=20261002highland1";
    }
    if ((src.indexOf("/media/video/landscapes-alpine-lake.mp4") === 0 || src.indexOf("/media/posters/landscapes-alpine-lake.jpg") === 0) && src.indexOf("v=20261002alpine60") < 0) {
      return src + (src.indexOf("?") >= 0 ? "&" : "?") + "v=20261002alpine60";
    }
    if ((src.indexOf("/media/video/landscapes-frozen-lake.mp4") === 0 || src.indexOf("/media/posters/landscapes-frozen-lake.jpg") === 0) && src.indexOf("v=20261002frozen1") < 0) {
      return src + (src.indexOf("?") >= 0 ? "&" : "?") + "v=20261002frozen1";
    }
    if ((src.indexOf("/media/video/landscapes-chalk-cliff.mp4") === 0 || src.indexOf("/media/posters/landscapes-chalk-cliff.jpg") === 0) && src.indexOf("v=20261002chalk1") < 0) {
      return src + (src.indexOf("?") >= 0 ? "&" : "?") + "v=20261002chalk1";
    }
    if ((src.indexOf("/media/video/landscapes-glacier-lake.mp4") === 0 || src.indexOf("/media/posters/landscapes-glacier-lake.jpg") === 0) && src.indexOf("v=20261002glacier1") < 0) {
      return src + (src.indexOf("?") >= 0 ? "&" : "?") + "v=20261002glacier1";
    }
    if ((src.indexOf("/media/video/landscapes-frozen-waterfall.mp4") === 0 || src.indexOf("/media/posters/landscapes-frozen-waterfall.jpg") === 0) && src.indexOf("v=20261002frozenwaterfall1") < 0) {
      return src + (src.indexOf("?") >= 0 ? "&" : "?") + "v=20261002frozenwaterfall1";
    }
    return src;
  }

  /** Enhance plate pages: swap <img> for <video> when media is video. */
  function enhancePlateVideo() {
    document.querySelectorAll(".stage.is-image img, .stage img").forEach(function (img) {
      var src = img.getAttribute("src") || "";
      if (!/\.(webm|mp4|mov)(\?|$)/i.test(src)) return;
      if (img.dataset.psVideoEnhanced === "1") return;
      img.dataset.psVideoEnhanced = "1";
      var stage = img.closest(".stage");
      if (stage) {
        stage.classList.remove("is-image");
        stage.classList.add("is-video");
      }
      var v = document.createElement("video");
      v.poster = mediaSrc(src).replace("/media/video/", "/media/posters/").replace(/\.(webm|mp4|mov)(\?|$)/i, ".jpg$2");
      v.src = mediaSrc(src);
      v.controls = true;
      v.playsInline = true;
      v.loop = true;
      v.muted = true;
      v.autoplay = true;
      tunePlateVideo(v);
      v.style.width = "100%";
      v.style.height = "auto";
      v.style.display = "block";
      v.style.borderRadius = getComputedStyle(img).borderRadius;
      img.replaceWith(v);
    });
    document.querySelectorAll(".stage.is-video video, .creation video, .net-page video, video.ps-plate-video").forEach(function (v) {
      if (v.getAttribute("data-ps-hd-shadow") === "1") return;
      tunePlateVideo(v);
      var src = v.getAttribute("src") || "";
      var next = mediaSrc(src);
      if (next !== src) { v.src = next; v.load(); }
      if (v.poster) { v.poster = mediaSrc(v.poster); }
      else if (/\.(webm|mp4|mov)(\?|$)/i.test(v.getAttribute("data-ps-master") || next)) {
        var pbase = v.getAttribute("data-ps-master") || next;
        v.poster = mediaSrc(pbase.replace("/media/video/", "/media/posters/").replace(/\.(webm|mp4|mov)(\?|$)/i, ".jpg$2"));
      }
    });
  }

  function tunePlateVideo(v) {
    if (v && v.getAttribute && v.getAttribute("data-ps-hd-shadow") === "1") return;
    psPlateProxy(v);
    if (!v || v.dataset.psVideoTuned === "1") return;
    v.dataset.psVideoTuned = "1";
    v.playsInline = true;
    v.setAttribute("playsinline", "");
    v.setAttribute("webkit-playsinline", "");
    v.setAttribute("preload", "auto");
    v.classList.add("ps-plate-video");
    try { v.disableRemotePlayback = true; } catch (e) {}
  }

  function chipBar(tag, onPick) {
    var carousel = document.createElement("div");
    carousel.className = "ps-cat-carousel";
    carousel.setAttribute("data-ps-cat-carousel", "");
    var prev = document.createElement("button");
    prev.type = "button";
    prev.className = "ps-cat-arrow is-prev";
    prev.setAttribute("aria-label", "Previous categories");
    prev.textContent = "‹";
    var next = document.createElement("button");
    next.type = "button";
    next.className = "ps-cat-arrow is-next";
    next.setAttribute("aria-label", "Next categories");
    next.textContent = "›";
    var track = document.createElement("div");
    track.className = "ps-cat-track";
    track.tabIndex = 0;
    CATS.forEach(function (c) {
      var a = document.createElement("a");
      a.className = tag === c.slug ? "chip is-on" : "chip";
      a.href = "/videos/?tag=" + encodeURIComponent(c.slug);
      a.textContent = c.label;
      a.addEventListener("click", function (ev) {
        ev.preventDefault();
        history.pushState({}, "", a.href);
        if (onPick) onPick();
      });
      track.appendChild(a);
    });
    carousel.appendChild(prev);
    carousel.appendChild(track);
    carousel.appendChild(next);
    return carousel;
  }

  /* 720p@60 card-hover proxy (R2 media/video-preview/<name>.mp4). Plate/detail keep full mediaUrl.
     Falls back to the full 1080p/60 master if the preview errors/404s. */
  function psPreviewSrc(full, explicit) {
    if (explicit) return String(explicit);
    var m = String(full || "").match(/^(?:https?:\/\/[^/]+)?\/media\/video\/([^/?#]+\.mp4)(\?[^#]*)?$/i);
    if (!m) return full;
    return "/media/video-preview/" + m[1] + (m[2] ? m[2] + "&" : "?") + "pv=720a";
  }
  function psPreviewFallback(video, full) {
    video.__psFullSrc = full;
    if (video.__psPreviewFb) return;
    video.__psPreviewFb = true;
    video.addEventListener("error", function () {
      var cur = video.getAttribute("src") || "";
      if (cur.indexOf("/media/video-preview/") < 0 || !video.__psFullSrc) return;
      video.src = video.__psFullSrc;
      try {
        var p = video.play();
        if (p && p.catch) p.catch(function () {});
      } catch (e) {}
    });
  }

  /* ——— q1: plate playback quality. 720p@60 proxy is the default everywhere, fullscreen included.
     A glass "720p | 1080p" pill (bottom-right of the plate player) switches manually; the choice is
     remembered in localStorage("ps-video-quality") for the next plate. Mid-play switches reuse the
     hd1 seamless swap: a hidden <video> prebuffers the other file, takes over at a synced time
     (crossfade inline / in wrapper fullscreen; freeze-frame + keyframe start if the <video> element
     itself is fullscreen), then hands back to the real player. Not ready in 6 s -> stay put + note.
     Fullscreen uses the .stage wrapper (native fullscreen button hidden) so the pill stays reachable;
     iPhone native fullscreen keeps whatever quality was picked inline. */
  var PS_Q_KEY = "ps-video-quality";
  var PS_Q_TIMEOUT = 6000, PS_Q_MINBUF = 1.2, PS_Q_FADE = 150, PS_Q_LEAD = 0.8;
  var psQJobs = [];
  window.__psHdLog = window.__psHdLog || [];
  function psHdLog(ev, v, extra) {
    try {
      var row = { t: Math.round(performance.now()), ev: ev };
      if (v) { row.ct = Math.round(v.currentTime * 1000) / 1000; row.src = (v.getAttribute("src") || "").replace(/^https?:\/\/[^/]+/, ""); }
      if (extra) for (var k in extra) row[k] = extra[k];
      window.__psHdLog.push(row);
      if (window.__psHdLog.length > 120) window.__psHdLog.shift();
    } catch (e) {}
  }
  function psIsCardVideo(v) {
    if (!v || v.getAttribute("data-ps-hd-shadow") === "1" || v.classList.contains("ps-disc-video")) return true;
    return !!(v.closest && v.closest(".ps-videos-thumb, .ps-ia-card-media, .ps-disc-media, a.ps-videos-card, a.ps-ia-featured-card"));
  }
  function psPlay(m) {
    try { var p = m.play(); if (p && p.catch) p.catch(function () {}); } catch (e) {}
  }
  function psSetSrc(v, url) { v.__psExpectSrc = url; v.src = url; }
  function psQPref() {
    try { return localStorage.getItem(PS_Q_KEY) === "1080" ? "1080" : "720"; } catch (e) { return "720"; }
  }
  function psQSave(q) {
    try { localStorage.setItem(PS_Q_KEY, q === "1080" ? "1080" : "720"); } catch (e) {}
  }
  function psQOf(url) {
    url = String(url || "");
    if (url.indexOf("/media/video-preview/") >= 0) return "720";
    if (/\/media\/video\/[^/?#]+\.mp4/i.test(url)) return "1080";
    return null;
  }
  function psQUrl(v, q) {
    var m = v.getAttribute("data-ps-master");
    if (!m) return null;
    return q === "1080" ? m : psPreviewSrc(m);
  }
  function psPlateSwitchSrc(v, url, why) {
    var t = v.currentTime || 0, play = !v.paused || v.autoplay;
    psSetSrc(v, url);
    v.__psProxySrc = url;
    if (t > 0) v.addEventListener("loadedmetadata", function () { try { v.currentTime = t; } catch (e) {} }, { once: true });
    if (play) psPlay(v);
    psHdLog("fallback:" + why, v);
    psQUi(v);
  }
  function psPlateFallback(v) {
    if (v.__psPlateFb) return;
    v.__psPlateFb = true;
    v.addEventListener("error", function () {
      var s = v.getAttribute("src") || "", master = v.getAttribute("data-ps-master");
      if (!master) return;
      if (s.indexOf("/media/video-preview/") >= 0 && !v.__psPrevFailed) {
        v.__psPrevFailed = true;
        if (s !== master) psPlateSwitchSrc(v, master, "preview-error");
      } else if (s === master && !v.__psMasterFailed && !v.__psPrevFailed) {
        v.__psMasterFailed = true;
        psPlateSwitchSrc(v, psPreviewSrc(master), "master-error");
        psQNote(v, "1080p couldn't load. Staying on 720p");
      }
    });
    v.addEventListener("webkitbeginfullscreen", function () { psHdLog("ios-native-fs", v, { q: psQOf(v.getAttribute("src")) }); });
  }
  function psWatchSrc(v) {
    if (v.__psSrcObs || !window.MutationObserver) return;
    v.__psSrcObs = new MutationObserver(function () {
      var s = v.getAttribute("src") || "";
      if (!s || s === v.__psExpectSrc) return;
      if (/\/media\/video\/[^/?#]+\.mp4/i.test(s)) {
        psQAbort(v, "new-src");
        v.__psProxySrc = null;
        v.__psPrevFailed = v.__psMasterFailed = false;
        psPlateProxy(v);
      }
    });
    v.__psSrcObs.observe(v, { attributes: true, attributeFilter: ["src"] });
  }
  function psPlateProxy(v) {
    if (!v || v.tagName !== "VIDEO" || psIsCardVideo(v)) return;
    var src = v.getAttribute("src") || "";
    if (src && (v.__psProxySrc === src || v.__psExpectSrc === src)) { psQEnsureUi(v); return; }
    var master = null;
    if (/^(?:https?:\/\/[^/]+)?\/media\/video\/[^/?#]+\.mp4/i.test(src)) master = src;
    else if (src.indexOf("/media/video-preview/") >= 0) master = v.getAttribute("data-ps-master");
    if (!master) return;
    v.setAttribute("data-ps-master", master);
    psPlateFallback(v);
    var want = psQPref() === "1080" ? master : psPreviewSrc(master);
    if (src !== want) {
      var play = !v.paused || v.autoplay;
      psSetSrc(v, want);
      if (play) psPlay(v);
    } else {
      v.__psExpectSrc = want;
    }
    v.__psProxySrc = want;
    psWatchSrc(v);
    psHdLog("proxy", v, { q: psQOf(want) });
    if (v.error) v.dispatchEvent(new Event("error"));
    psQEnsureUi(v);
  }
  function psFsEl() { return document.fullscreenElement || document.webkitFullscreenElement || null; }
  function psBuffered(m, t, need) {
    var b = m.buffered, end = Math.min(t + need, (m.duration || Infinity) - 0.05);
    for (var i = 0; i < b.length; i++) if (b.start(i) <= t + 0.05 && b.end(i) >= end) return true;
    return false;
  }
  var psKfPromise = null;
  function psKeyframes(url) {
    if (!psKfPromise) {
      psKfPromise = fetch("/assets/ps-hd-keyframes-v1.json?v=20261007q1", { credentials: "same-origin" })
        .then(function (r) { return r.ok ? r.json() : {}; })
        .catch(function () { return {}; });
    }
    url = String(url || "");
    var name = url.split("?")[0].split("/").pop() || "";
    var key = url.indexOf("/media/video-preview/") >= 0 ? "preview:" + name : name;
    return psKfPromise.then(function (m) { return (m && m[key]) || null; });
  }
  function psNextKf(kf, t, dur, margin) {
    for (var i = 0; i < kf.length; i++) if (kf[i] > t + margin && (!dur || kf[i] < dur - 0.2)) return kf[i];
    return 0; /* next sync point is the loop wrap (t=0) */
  }
  /* cb(mediaTime) when m presents the frame just before k (k===0: when playback wraps). */
  function psAtTime(m, k, cb) {
    var last = m.currentTime, fired = false, iv = null;
    function check(mt) {
      if (fired) return;
      /* fire ~2 frames early: a late trigger would show a small step back, early a tiny step forward */
      var hit = k === 0 ? mt + 0.5 < last : mt >= k - 0.035;
      last = mt;
      if (hit) { fired = true; if (iv) clearInterval(iv); cb(mt); return; }
      if (m.requestVideoFrameCallback) m.requestVideoFrameCallback(function (n, md) { check(md.mediaTime); });
    }
    if (m.requestVideoFrameCallback) m.requestVideoFrameCallback(function (n, md) { check(md.mediaTime); });
    else iv = setInterval(function () { check(m.currentTime); }, 15);
    return function () { fired = true; if (iv) clearInterval(iv); };
  }
  function psQAbort(v, why) {
    psQJobs.slice().forEach(function (j) { if (!v || j.v === v) j.abort(why); });
  }
  /* Switch the plate player to quality q ("720" | "1080") without restarting playback. */
  function psQSwitch(v, q) {
    var url = psQUrl(v, q);
    if (!url) return;
    psQAbort(v, "superseded");
    v.__psQWant = q;
    var cur = v.getAttribute("src") || "";
    if (cur === url) { v.__psQWant = null; psQUi(v); return; }
    if (v.readyState < 2 || v.ended || (v.paused && !v.currentTime)) {
      var play = !v.paused || (v.autoplay && v.readyState < 2);
      psSetSrc(v, url);
      v.__psProxySrc = url;
      if (play) psPlay(v);
      v.__psQWant = null;
      psHdLog("q-direct", v, { q: q });
      psQUi(v);
      return;
    }
    var sameEl = psFsEl() === v;
    var h = document.createElement("video");
    h.setAttribute("data-ps-hd-shadow", "1");
    h.setAttribute("aria-hidden", "true");
    h.setAttribute("muted", "");
    h.setAttribute("playsinline", "");
    h.setAttribute("webkit-playsinline", "");
    h.className = "ps-q-shadow";
    h.muted = true;
    h.playsInline = true;
    h.loop = v.loop;
    h.preload = "auto";
    h.tabIndex = -1;
    var host = sameEl ? document.body : (v.parentElement || document.body);
    if (sameEl) h.classList.add("is-offscreen");
    muteObs(true);
    try { host.appendChild(h); } finally { muteObs(false); }
    var job = { v: v, h: h, q: q, url: url, done: false, phase: "buffer", kf: undefined, target: null, cancelWait: null };
    psQJobs.push(job);
    psHdLog("q-start", v, { q: q, sameEl: sameEl });
    psQUi(v);
    psKeyframes(url).then(function (kf) { job.kf = kf; });
    function cleanup() {
      try { h.pause(); } catch (e) {}
      h.removeAttribute("src");
      try { h.load(); } catch (e2) {}
      if (h.parentNode) { muteObs(true); try { h.parentNode.removeChild(h); } finally { muteObs(false); } }
      var i = psQJobs.indexOf(job);
      if (i >= 0) psQJobs.splice(i, 1);
    }
    function stop() {
      job.done = true;
      clearInterval(job.poll);
      clearTimeout(job.timer);
      if (job.cancelWait) job.cancelWait();
    }
    job.abort = function (why) {
      if (job.done) return;
      stop();
      cleanup();
      if (v.__psQWant === q) v.__psQWant = null;
      psHdLog("q-abort:" + why, v, { q: q });
      if (why === "timeout" || why === "load-error") {
        var back = psQOf(v.getAttribute("src"));
        if (q === "1080") psQSave(back || "720");
        psQNote(v, q === "1080" ? "1080p is slow to load. Staying on 720p" : "Couldn't switch to 720p right now");
      }
      psQUi(v);
    };
    function fire(T, mt) {
      if (job.done) return;
      stop();
      psHdLog("q-swap-at", v, { q: q, T: Math.round(T * 1000) / 1000, presented: mt == null ? null : Math.round(mt * 1000) / 1000 });
      psQSwap(job, sameEl, cleanup, T);
    }
    h.addEventListener("error", function () { job.abort("load-error"); }, { once: true });
    h.src = url;
    job.timer = setTimeout(function () { job.abort("timeout"); }, PS_Q_TIMEOUT);
    job.poll = setInterval(function () {
      if (job.done) return;
      if (!v.isConnected) { job.abort("detached"); return; }
      if (job.phase === "armed") {
        if (v.paused) { if (job.cancelWait) job.cancelWait(); fire(v.currentTime, null); }
        return;
      }
      if (h.readyState < 1 || (sameEl && job.kf === undefined)) return;
      var t = v.currentTime, dur = h.duration || v.duration;
      if (!job.target || (!job.target.now && job.target.k > 0 && t > job.target.k - 0.06)) {
        if (v.paused) job.target = { now: true, k: t };
        else if (sameEl) job.target = job.kf ? { now: false, k: psNextKf(job.kf, t, dur, 0.35) } : { now: true, k: t };
        else {
          var k = t + PS_Q_LEAD;
          if (dur && k > dur - 0.3) job.target = v.loop ? { now: false, k: 0 } : { now: true, k: t };
          else job.target = { now: false, k: k };
        }
        try { h.currentTime = job.target.now ? t : job.target.k; } catch (e) {}
        return;
      }
      if (h.readyState < 3 || h.seeking || !psBuffered(h, h.currentTime, PS_Q_MINBUF)) return;
      clearTimeout(job.timer);
      job.phase = "armed";
      psHdLog("q-armed", v, { q: q, k: job.target.now ? "now" : Math.round(job.target.k * 1000) / 1000 });
      if (job.target.now) { fire(v.currentTime, null); return; }
      var kk = job.target.k;
      job.cancelWait = psAtTime(v, kk, function (mt) { fire(kk === 0 ? v.currentTime : kk, mt); });
    }, 60);
  }
  function psQSwap(job, sameEl, cleanup, T) {
    var v = job.v, h = job.h, url = job.url, q = job.q, prevSrc = v.getAttribute("src");
    var wasPaused = v.paused, muted = v.muted, vol = v.volume, rate = v.playbackRate, loop = v.loop;
    var before = v.currentTime;
    var origPoster = v.getAttribute("poster");
    function done(ok) {
      if (v.__psQWant === q) v.__psQWant = null;
      psHdLog(ok ? "q-done" : "q-revert", v, { q: q, before: Math.round(before * 1000) / 1000, T: Math.round(T * 1000) / 1000, sameEl: sameEl });
      psQUi(v);
    }
    function restorePoster() {
      if (origPoster == null) v.removeAttribute("poster"); else v.setAttribute("poster", origPoster);
    }
    function onErr(T0) {
      return function onE() {
        v.removeEventListener("error", onE);
        if ((v.getAttribute("src") || "") !== url) return;
        psSetSrc(v, prevSrc);
        v.__psProxySrc = prevSrc;
        v.addEventListener("loadedmetadata", function () { try { v.currentTime = T0; } catch (e) {} if (!wasPaused) psPlay(v); }, { once: true });
        restorePoster();
        cleanup();
        psQNote(v, q === "1080" ? "1080p couldn't load. Staying on 720p" : "Couldn't switch to 720p right now");
        if (q === "1080") psQSave("720");
        done(false);
      };
    }
    function setSrc(atT, playAfter) {
      psSetSrc(v, url);
      v.__psProxySrc = url;
      v.muted = muted; v.volume = vol; v.loop = loop;
      v.addEventListener("loadedmetadata", function () {
        try { v.currentTime = atT; } catch (e) {}
        v.playbackRate = rate;
        if (playAfter) psPlay(v);
        else { try { v.pause(); } catch (e2) {} }
      }, { once: true });
      v.addEventListener("error", onErr(atT));
    }
    if (sameEl || wasPaused) {
      /* <video> itself fullscreen (or paused): hold the exact current frame as poster while the
         new file (already cached by the shadow) starts at T. */
      try {
        var c = document.createElement("canvas");
        c.width = v.videoWidth; c.height = v.videoHeight;
        c.getContext("2d").drawImage(v, 0, 0);
        v.setAttribute("poster", c.toDataURL("image/jpeg", 0.9));
      } catch (e) {}
      var fin = false;
      var finish = function () { if (fin) return; fin = true; restorePoster(); cleanup(); done(true); };
      setSrc(T, !wasPaused);
      v.addEventListener(wasPaused ? "seeked" : "playing", finish, { once: true });
      setTimeout(finish, 4000);
      return;
    }
    /* Inline / wrapper fullscreen: the shadow (CSS inset:0 over the player, same object-fit)
       is already at T. Crossfade to it, reload the real player paused a little ahead (k2), and
       hand back when the shadow reaches k2. */
    psPlay(h);
    h.classList.add("is-on");
    setTimeout(function () {
      var dur = h.duration || 0;
      var k2 = h.currentTime + 1.0;
      if (dur && k2 > dur - 0.3) k2 = loop ? 0 : Math.max(0, dur - 0.05);
      var hadAuto = v.autoplay, handed = false, tries = 0, cancelAt = null;
      v.autoplay = false;
      var handBack = function () {
        if (handed) return;
        handed = true;
        if (cancelAt) cancelAt();
        v.removeEventListener("play", early);
        v.autoplay = hadAuto;
        psPlay(v);
        psHdLog("q-handback", v, { q: q, hT: Math.round(h.currentTime * 1000) / 1000, k2: Math.round(k2 * 1000) / 1000 });
        h.classList.remove("is-on");
        setTimeout(cleanup, PS_Q_FADE + 40);
        done(true);
      };
      /* user pressed play/scrubbed on the (hidden) real player: hand back right away, in sync */
      var early = function () {
        if (handed || v.seeking) return;
        try { v.currentTime = h.currentTime; } catch (e) {}
        handBack();
      };
      setSrc(k2, false);
      v.addEventListener("seeked", function onSeeked() {
        if (handed) return;
        if (k2 > 0 && h.currentTime > k2 - 0.05 && tries++ < 3) {
          k2 = h.currentTime + PS_Q_LEAD;
          v.addEventListener("seeked", onSeeked, { once: true });
          try { v.currentTime = k2; } catch (e) {}
          return;
        }
        setTimeout(function () { v.addEventListener("play", early); }, 0);
        cancelAt = psAtTime(h, k2, handBack);
      }, { once: true });
      setTimeout(function () { if (!handed && !v.seeking && v.readyState >= 2) { try { v.currentTime = h.currentTime; } catch (e) {} handBack(); } }, 9000);
    }, PS_Q_FADE + 20);
  }

  /* ——— quality pill + wrapper fullscreen ——— */
  var PS_Q_FS_SVG = '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path class="ps-q-fs-in" d="M3.5 7.5v-4h4M12.5 3.5h4v4M16.5 12.5v4h-4M7.5 16.5h-4v-4"/><path class="ps-q-fs-out" d="M7.5 3.5v4h-4M16.5 7.5h-4v-4M12.5 16.5v-4h4M3.5 12.5h4v4"/></svg>';
  function psQStage(v) { return (v.closest && v.closest(".stage")) || v.parentElement; }
  function psQCanWrapFs(stage) {
    return !!((stage.requestFullscreen || stage.webkitRequestFullscreen) && (document.fullscreenEnabled || document.webkitFullscreenEnabled));
  }
  function psQToggleFs(stage) {
    var fs = psFsEl();
    if (fs) {
      if (document.exitFullscreen) document.exitFullscreen().catch(function () {});
      else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
      return;
    }
    try {
      if (stage.requestFullscreen) stage.requestFullscreen({ navigationUI: "hide" }).catch(function () {});
      else if (stage.webkitRequestFullscreen) stage.webkitRequestFullscreen();
    } catch (e) {}
  }
  function psQShow(stage, ms) {
    stage.classList.add("ps-q-show");
    clearTimeout(stage.__psQHide);
    var v = stage.__psQV;
    if (ms === 0) return;
    stage.__psQHide = setTimeout(function () {
      var ui = stage.querySelector(".ps-q");
      if (v && v.paused) return;
      if (ui && (ui.matches(":hover") || ui.contains(document.activeElement) || ui.classList.contains("has-note"))) return;
      stage.classList.remove("ps-q-show");
    }, ms || 2600);
  }
  function psQNote(v, msg) {
    var stage = psQStage(v), ui = stage && stage.querySelector(".ps-q");
    if (!ui) return;
    var n = ui.querySelector(".ps-q-note");
    n.textContent = msg;
    ui.classList.add("has-note");
    psQShow(stage, 0);
    clearTimeout(ui.__noteT);
    ui.__noteT = setTimeout(function () { ui.classList.remove("has-note"); psQShow(stage); }, 3800);
  }
  function psQUi(v) {
    var stage = psQStage(v), ui = stage && stage.querySelector(".ps-q");
    if (!ui || ui.__v !== v) return;
    var cur = psQOf(v.getAttribute("src")) || "720";
    var want = v.__psQWant || null;
    var shown = want || cur;
    ui.querySelectorAll("[data-q]").forEach(function (b) {
      var q = b.getAttribute("data-q"), on = q === shown;
      b.setAttribute("aria-checked", on ? "true" : "false");
      b.tabIndex = on ? 0 : -1;
      b.classList.toggle("is-pending", !!want && q === want && want !== cur);
    });
    ui.setAttribute("aria-busy", want && want !== cur ? "true" : "false");
    var fs = !!psFsEl() && (psFsEl() === stage);
    stage.classList.toggle("ps-q-isfs", fs);
    var fb = ui.querySelector(".ps-q-fs");
    if (fb) {
      fb.setAttribute("aria-label", fs ? "Exit full screen" : "Full screen");
      fb.setAttribute("aria-pressed", fs ? "true" : "false");
    }
  }
  function psQEnsureUi(v) {
    if (!v || psIsCardVideo(v) || !v.getAttribute("data-ps-master") || !v.isConnected) return;
    var stage = psQStage(v);
    if (!stage || stage === document.body) return;
    var ui = null;
    for (var i = 0; i < stage.children.length; i++) if (stage.children[i].classList.contains("ps-q")) ui = stage.children[i];
    if (ui && ui.__v === v) { psQUi(v); return; }
    var wrapFs = psQCanWrapFs(stage);
    if (!ui) {
      ui = document.createElement("div");
      ui.className = "ps-q";
      ui.setAttribute("data-ps-q", "1");
      ui.innerHTML =
        '<div class="ps-q-seg" role="radiogroup" aria-label="Video quality">' +
        '<button type="button" role="radio" data-q="720" aria-checked="true">720p</button>' +
        '<button type="button" role="radio" data-q="1080" aria-checked="false">1080p</button>' +
        "</div>" +
        (wrapFs ? '<span class="ps-q-sep" aria-hidden="true"></span><button type="button" class="ps-q-fs" aria-label="Full screen" aria-pressed="false">' + PS_Q_FS_SVG + "</button>" : "") +
        '<span class="ps-q-note" role="status" aria-live="polite"></span>';
      muteObs(true);
      try { stage.appendChild(ui); } finally { muteObs(false); }
      ui.addEventListener("click", function (ev) {
        var b = ev.target.closest && ev.target.closest("button");
        if (!b || !ui.__v) return;
        ev.preventDefault();
        ev.stopPropagation();
        if (b.classList.contains("ps-q-fs")) { psQToggleFs(stage); return; }
        var q = b.getAttribute("data-q");
        if (!q) return;
        psQSave(q);
        psQSwitch(ui.__v, q);
        psQShow(stage);
      });
      ui.addEventListener("keydown", function (ev) {
        var b = ev.target.closest && ev.target.closest("[data-q]");
        if (!b) return;
        var k = ev.key;
        if (k !== "ArrowLeft" && k !== "ArrowRight" && k !== "ArrowUp" && k !== "ArrowDown" && k !== "Home" && k !== "End") return;
        ev.preventDefault();
        ev.stopPropagation();
        var q = k === "ArrowLeft" || k === "ArrowUp" || k === "Home" ? "720" : "1080";
        var nb = ui.querySelector('[data-q="' + q + '"]');
        if (nb) nb.focus();
        psQSave(q);
        psQSwitch(ui.__v, q);
      });
      ui.addEventListener("dblclick", function (ev) { ev.stopPropagation(); });
      ui.addEventListener("focusin", function () { psQShow(stage, 0); });
      ui.addEventListener("focusout", function () { psQShow(stage); });
    }
    ui.__v = v;
    stage.__psQV = v;
    if (!stage.__psQWired) {
      stage.__psQWired = true;
      stage.classList.add("ps-q-host");
      stage.addEventListener("pointermove", function () { psQShow(stage); });
      stage.addEventListener("pointerdown", function () { psQShow(stage, 3200); });
      stage.addEventListener("pointerleave", function (ev) {
        if (ev.pointerType === "touch") return;
        var vv = stage.__psQV, u = stage.querySelector(".ps-q");
        if (vv && vv.paused) return;
        if (u && (u.contains(document.activeElement) || u.classList.contains("has-note"))) return;
        clearTimeout(stage.__psQHide);
        stage.classList.remove("ps-q-show");
      });
    }
    if (!v.__psQWired) {
      v.__psQWired = true;
      v.addEventListener("pause", function () { psQShow(stage, 0); });
      v.addEventListener("play", function () { psQShow(stage); });
      if (wrapFs) {
        /* Chrome/Edge: hide the native fullscreen button (it would fullscreen the bare <video>
           and hide the pill); the pill's button + double-click fullscreen the .stage wrapper. */
        try { if (v.controlsList && v.controlsList.add) v.controlsList.add("nofullscreen"); else v.setAttribute("controlslist", "nofullscreen"); } catch (e) {}
        stage.classList.add("ps-q-wrapfs");
        v.addEventListener("dblclick", function (ev) { ev.preventDefault(); ev.stopPropagation(); psQToggleFs(stage); });
      }
    }
    if (v.paused) psQShow(stage, 0);
    psQUi(v);
  }
  function psOnFsChange() {
    var fs = psFsEl();
    document.querySelectorAll(".stage.ps-q-host").forEach(function (stage) {
      if (stage.__psQV) psQUi(stage.__psQV);
      if (fs === stage) psQShow(stage);
    });
    if (fs && fs.tagName === "VIDEO") psHdLog("native-fs-element", fs, { q: psQOf(fs.getAttribute("src")) });
  }
  document.addEventListener("fullscreenchange", psOnFsChange);
  document.addEventListener("webkitfullscreenchange", psOnFsChange);
  window.__psQuality = { pref: psQPref, set: function (q) { psQSave(q); document.querySelectorAll("video.ps-plate-video").forEach(function (v) { if (!psIsCardVideo(v)) psQSwitch(v, q); }); } };

  /* Hover preview: img poster by default; one muted looping mp4 at a time. */
  var activeHoverPreview = null;

  function fineHover() {
    try {
      return window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    } catch (e) {
      return true;
    }
  }

  function stopHoverPreview() {
    if (!activeHoverPreview) return;
    var v = activeHoverPreview.video;
    var card = activeHoverPreview.card;
    var media = activeHoverPreview.media;
    var poster = activeHoverPreview.poster;
    try { v.pause(); } catch (e) {}
    v.removeAttribute("src");
    try { v.load(); } catch (e2) {}
    if (media && poster) {
      if (v.parentNode === media) media.replaceChild(poster, v);
      else if (!poster.parentNode) media.appendChild(poster);
    }
    if (card) card.classList.remove("is-previewing");
    activeHoverPreview = null;
  }

  function ensurePreviewVideo(media, posterEl) {
    var v = media.__psPreviewVideo;
    if (v) return v;
    v = document.createElement("video");
    v.muted = true;
    v.playsInline = true;
    v.loop = true;
    v.preload = "none";
    v.setAttribute("playsinline", "");
    v.setAttribute("muted", "");
    if (posterEl && posterEl.src) v.poster = posterEl.src;
    media.__psPreviewVideo = v;
    return v;
  }

  function startHoverPreview(card, media, posterEl, src) {
    if (!src || !media || !posterEl) return;
    var video = ensurePreviewVideo(media, posterEl);
    if (activeHoverPreview && activeHoverPreview.video === video) return;
    stopHoverPreview();
    muteObs(true);
    try {
      if (posterEl.parentNode === media) media.replaceChild(video, posterEl);
      else media.appendChild(video);
    } finally {
      muteObs(false);
    }
    video.muted = true;
    video.playsInline = true;
    video.loop = true;
    video.setAttribute("playsinline", "");
    video.setAttribute("muted", "");
    video.preload = "auto";
    psPreviewFallback(video, src);
    video.src = psPreviewSrc(src, card && card.__psPreviewUrl);
    function startPlay() {
      try {
        var p = video.play();
        if (p && p.catch) p.catch(function () {});
      } catch (e) {}
    }
    if (video.readyState >= 3) startPlay();
    else video.addEventListener("canplay", startPlay, { once: true });
    if (card) card.classList.add("is-previewing");
    activeHoverPreview = { card: card, video: video, media: media, poster: posterEl, src: src };
    if (!card.__psPreviewIo && "IntersectionObserver" in window) {
      card.__psPreviewIo = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (en) {
            if (!en.isIntersecting && activeHoverPreview && activeHoverPreview.card === card) {
              stopHoverPreview();
            }
          });
        },
        { rootMargin: "80px 0px", threshold: 0.15 },
      );
      card.__psPreviewIo.observe(card);
    }
  }

  function wireHoverPreview(card, media, posterEl, src) {
    if (!card || !media || !posterEl || !src || !fineHover()) return;
    card.addEventListener("pointerenter", function () {
      startHoverPreview(card, media, posterEl, src);
    });
    card.addEventListener("pointerleave", function () {
      if (activeHoverPreview && activeHoverPreview.media === media) stopHoverPreview();
    });
  }

  function cardEl(c) {
    var a = document.createElement("a");
    a.className = "ps-videos-card ps-videos-card--live";
    a.href = "/p/" + encodeURIComponent(c.id);
    var media = document.createElement("div");
    media.className = "ps-videos-thumb";
    if (c.mediaUrl && /\.(webm|mp4)(\?|$)/i.test(c.mediaUrl)) {
      // Default: <img> poster freeze-frame only. Video created on first hover.
      var poster = c.poster || c.mediaPoster;
      if (!poster) poster = mediaSrc(c.mediaUrl).replace("/media/video/", "/media/posters/").replace(/\.(webm|mp4)(\?|$)/i, ".jpg$2");
      else poster = mediaSrc(poster);
      var img = document.createElement("img");
      img.className = "ps-videos-poster";
      img.src = window.psGridThumb ? window.psGridThumb(c.thumbUrl || poster) : poster;
      img.alt = "";
      img.loading = c.__psEager ? "eager" : "lazy";
      img.decoding = "async";
      img.width = 640;
      img.height = 400;
      if (c.__psEager) img.setAttribute("fetchpriority", "high");
      img.setAttribute("data-ps-full", poster);
      media.appendChild(img);
      if (c.previewUrl) a.__psPreviewUrl = c.previewUrl;
      wireHoverPreview(a, media, img, mediaSrc(c.mediaUrl));
    } else {
      media.innerHTML = "<span class=\"ps-videos-thumb-ph\">Video</span>";
    }
    var body = document.createElement("div");
    body.className = "ps-videos-card-body";
    var promptBlock = "";
    try {
      if (window.psShelfPrompt && typeof window.psShelfPrompt.html === "function") {
        promptBlock = window.psShelfPrompt.html(c);
      } else if (c.prompt) {
        promptBlock = '<p class="card-prompt">' + escapeHtml(c.prompt) + "</p>";
      }
    } catch (ePrompt) {
      if (c.prompt) promptBlock = '<p class="card-prompt">' + escapeHtml(c.prompt) + "</p>";
    }
    body.innerHTML =
      '<div class="card-row"><span class="model-chip">' +
      escapeHtml((window.psDisplayModel && window.psDisplayModel(c)) || c.displayModel || c.modelVersion || c.model || "Grok") +
      "</span></div><h3>" +
      escapeHtml(c.title || "Untitled") +
      "</h3>" +
      promptBlock;
    a.setAttribute("data-ps-creation", c.id || "");
    a.appendChild(media);
    a.appendChild(body);
    if (window.psShelfPrompt && typeof window.psShelfPrompt.wire === "function") {
      try { window.psShelfPrompt.wire(body); } catch (eWire) {}
    }
    return a;
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderVideos(mount) {
    if (!mount) return;
    stopHoverPreview();
    var tag = activeCat();
    var cat = CATS.find(function (c) {
      return c.slug === tag;
    });
    muteObs(true);
    try {
      mount.innerHTML = "";
      mount.setAttribute(RENDERED, "1");
      mount.setAttribute("data-ps-videos-key", tag + "|" + ((window.psCatPage && window.psCatPage.readPage) ? window.psCatPage.readPage() : 1));

      var head = document.createElement("div");
      head.className = "page-head";
      head.innerHTML =
        '<div><h1>Videos</h1><p class="lede">Curated Videos with the exact prompts behind them. Pick a category to filter.</p>' +
        (tag ? '<p class="lede"><a href="/videos/">← All video categories</a></p>' : "") +
        "</div>";

      mount.appendChild(head);
      mount.appendChild(
        chipBar(tag, function () {
          mount.removeAttribute(RENDERED);
          renderVideos(mount);
        })
      );

      var status = document.createElement("div");
      status.className = "ps-videos-empty";
      mount.appendChild(status);

      var grid = document.createElement("div");
      grid.className = "ps-videos-grid";
      mount.appendChild(grid);

      // Untagged /videos: chips + empty grid for IA featured shelf; skip building 40 gallery cards.
      if (!tag) {
        status.innerHTML = "";
        status.setAttribute("hidden", "true");
        status.style.display = "none";
        return;
      }

      status.innerHTML = "";
      status.setAttribute("hidden", "true");
      var skel = 0;
      for (skel = 0; skel < 6; skel++) {
        var ph = document.createElement("div");
        ph.className = "ps-browse-skel is-video";
        ph.setAttribute("aria-hidden", "true");
        ph.innerHTML = '<div class="ps-browse-skel-media"></div><div class="ps-browse-skel-body"><span></span><span></span></div>';
        grid.appendChild(ph);
      }
      var page = (window.psCatPage && window.psCatPage.readPage) ? window.psCatPage.readPage() : 1;
      var offset = Math.max(0, (page - 1) * 9);
      var url = "/api/feed?kind=video&limit=9&offset=" + offset + "&tag=" + encodeURIComponent(tag) + "&fields=card";
      if (page > 1) url += "&page=" + page;
      fetch(url, { credentials: "same-origin" })
        .then(function (r) {
          return r.json();
        })
        .then(function (data) {
          var list = (data && data.creations) || [];
          var total = Number(data && data.total);
          if (!isFinite(total)) total = list.length;
          muteObs(true);
          try {
            grid.innerHTML = "";
            if (!list.length) {
              status.removeAttribute("hidden");
              status.innerHTML =
                "<h2>No videos in this shelf yet</h2>" +
                "<p>No curated clips in this shelf yet. Landscapes canopy god-rays is live when tagged — try clearing filters or pick another category.</p>";
              if (window.psCatPage && window.psCatPage.render) {
                window.psCatPage.render(mount, { tag: tag, total: 0, page: page, kind: "video" });
              }
              return;
            }
            status.remove();
            var shown = list.slice(0, 9);
            shown.forEach(function (c, idx) {
              if (idx < 3) c.__psEager = true;
              grid.appendChild(cardEl(c));
            });
            if (window.psCatPage && window.psCatPage.render) {
              window.psCatPage.render(mount, { tag: tag, total: total, page: page, kind: "video" });
            }
          } finally {
            muteObs(false);
          }
          if (window.psBrowseWireThumbs) window.psBrowseWireThumbs(grid);
          try {
            if (window.psThumbsRescan) window.psThumbsRescan();
            setTimeout(function () { if (window.psThumbsRescan) window.psThumbsRescan(); }, 0);
          } catch (eThumb) {}
        })
        .catch(function () {
          status.innerHTML =
            "<h2>Couldn’t load videos</h2><p>Try again in a moment. Images are unaffected.</p>";
        });
    } finally {
      muteObs(false);
    }

    window.dispatchEvent(new Event("resize"));
  }

  function scan() {
    hideUgc();
    stripVideosNav();
    enhancePlateVideo();
    var mount = document.getElementById("ps-videos-mount") || document.querySelector("[data-ps-videos]");
    var tagNow = activeCat();
    var pageNow = (window.psCatPage && window.psCatPage.readPage) ? window.psCatPage.readPage() : 1;
    var key = tagNow + "|" + pageNow;
    if (mount && mount.getAttribute("data-ps-videos-key") !== key) {
      mount.removeAttribute(RENDERED);
    }
    if (mount && mount.getAttribute(RENDERED) !== "1") {
      if (mount) mount.setAttribute("data-ps-videos-key", key);
      renderVideos(mount);
    }
    if (path() === "/videos" && mount && location.search.indexOf("tag=") >= 0) {
      // re-render if SPA remounted empty
      if (!mount.querySelector(".ps-cat-carousel")) {
        mount.removeAttribute(RENDERED);
        renderVideos(mount);
      }
    }
  }

  function scheduleScan() {
    if (document.documentElement.dataset.psMuteObs === "1") return;
    if (scanning) return;
    clearTimeout(scanTimer);
    scanTimer = setTimeout(function () {
      scanning = true;
      try { scan(); } finally { scanning = false; }
    }, 100);
  }

  function boot() {
    scan();
    var root = document.getElementById("root") || document.body;
    if (!root || root.__psGalleryObs) return;
    var obs = new MutationObserver(function () {
      scheduleScan();
    });
    /* Observe the document, not #root — React replaces #root on plate open. */
    obs.observe(document.documentElement, { childList: true, subtree: true });
    root.__psGalleryObs = obs;
    document.documentElement.__psGalleryObs = obs;
    var videoObs = new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) {
        var nodes = muts[i].addedNodes;
        for (var j = 0; j < nodes.length; j++) {
          var n = nodes[j];
          if (!n || n.nodeType !== 1) continue;
          if (n.tagName === "VIDEO") tunePlateVideo(n);
          if (n.querySelectorAll) {
            var vids = n.querySelectorAll("video");
            for (var k = 0; k < vids.length; k++) tunePlateVideo(vids[k]);
          }
        }
      }
    });
    videoObs.observe(document.documentElement, { childList: true, subtree: true });
    window.addEventListener("popstate", function () {
      var m = document.getElementById("ps-videos-mount");
      if (m) m.removeAttribute(RENDERED);
      setTimeout(scan, 0);
    });
    document.addEventListener(
      "click",
      function (ev) {
        var a = ev.target && ev.target.closest && ev.target.closest("a[href^='/p/']");
        if (!a) return;
        setTimeout(enhancePlateVideo, 50);
        setTimeout(enhancePlateVideo, 400);
      },
      true
    );
    /* SPA plate opens use history.pushState, not popstate. Retune the
       inline player after React swaps the stage. */
    ["pushState", "replaceState"].forEach(function (key) {
      var orig = history[key];
      if (typeof orig !== "function" || orig.__psGalleryWrap) return;
      history[key] = function () {
        var ret = orig.apply(this, arguments);
        setTimeout(enhancePlateVideo, 0);
        setTimeout(enhancePlateVideo, 250);
        return ret;
      };
      history[key].__psGalleryWrap = true;
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
