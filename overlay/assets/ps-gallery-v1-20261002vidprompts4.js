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
      v.setAttribute("playsinline", "");
      v.style.width = "100%";
      v.style.height = "auto";
      v.style.display = "block";
      v.style.borderRadius = getComputedStyle(img).borderRadius;
      img.replaceWith(v);
    });
    document.querySelectorAll(".stage.is-video video").forEach(function (v) {
      var src = v.getAttribute("src") || "";
      var next = mediaSrc(src);
      if (next !== src) { v.src = next; v.load(); }
      if (v.poster) { v.poster = mediaSrc(v.poster); return; }
      if (/\.(webm|mp4|mov)(\?|$)/i.test(next)) {
        v.poster = mediaSrc(next.replace("/media/video/", "/media/posters/").replace(/\.(webm|mp4|mov)(\?|$)/i, ".jpg$2"));
      }
    });
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
    video.src = src;
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
      img.src = poster;
      img.alt = "";
      img.loading = "lazy";
      img.decoding = "async";
      media.appendChild(img);
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
      '<div class=\"card-row\"><span class=\"model-chip\">' + escapeHtml(c.model || "Grok") + "</span></div><h3>" + escapeHtml(c.title || "Untitled") + "</h3>" +
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

      status.innerHTML = "<h2>Loading…</h2><p>Fetching curated video plates.</p>";
      var url = "/api/feed?kind=video&limit=40&tag=" + encodeURIComponent(tag);
      fetch(url, { credentials: "same-origin" })
        .then(function (r) {
          return r.json();
        })
        .then(function (data) {
          var list = (data && data.creations) || [];
          muteObs(true);
          try {
            grid.innerHTML = "";
            if (!list.length) {
              status.innerHTML =
                "<h2>No videos in this shelf yet</h2>" +
                "<p>No curated clips in this shelf yet. Landscapes canopy god-rays is live when tagged — try clearing filters or pick another category.</p>";
              return;
            }
            status.remove();
            list.slice(0, 18).forEach(function (c) {
              grid.appendChild(cardEl(c));
            });
          } finally {
            muteObs(false);
          }
          try {
            if (window.psThumbsRescan) window.psThumbsRescan();
            setTimeout(function () { if (window.psThumbsRescan) window.psThumbsRescan(); }, 0);
          } catch (eThumb) {}
        })
        .catch(function () {
          status.innerHTML =
            "<h2>Couldn’t load videos</h2><p>Try again in a moment. Image Discover is unaffected.</p>";
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
    if (mount && mount.getAttribute(RENDERED) !== "1") renderVideos(mount);
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
    obs.observe(root, { childList: true, subtree: true });
    root.__psGalleryObs = obs;
    window.addEventListener("popstate", function () {
      var m = document.getElementById("ps-videos-mount");
      if (m) m.removeAttribute(RENDERED);
      setTimeout(scan, 0);
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
