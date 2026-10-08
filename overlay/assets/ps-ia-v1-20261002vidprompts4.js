/* PromptShare IA — Images | Videos hub + featured browse shelves (2026-10-02) */
(function () {
  /* vidprompts1-ia */
  var MARK = "data-ps-ia-v1";
  var HUB_DONE = "data-ps-hub-done";
  var BROWSE_DONE = "data-ps-ia-browse-done";
  var scanning = false;
  var scanTimer = null;

  function path() {
    return (location.pathname || "/").replace(/\/+$/, "") || "/";
  }

  function isHub() {
    return path() === "/" || path() === "/discover";
  }

  function activeTag() {
    try {
      return new URL(location.href).searchParams.get("tag") || "";
    } catch (e) {
      return "";
    }
  }

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i];
      a[i] = a[j];
      a[j] = t;
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


  /** Shared prompt markup (same treatment as React category cards). */
  function kit() {
    return window.PSPromptKit || null;
  }

  function underlineHtml(text, k) {
    if (!k || !k.underlineWords) return escapeHtml(text);
    return k.underlineWords(text).map(function (w) {
      return w.u
        ? '<span class="phrase-word">' + escapeHtml(w.t) + "</span>"
        : escapeHtml(w.t);
    }).join("");
  }

  function promptHtml(c) {
    var prompt = (c && c.prompt) || "";
    if (!prompt) return "";
    var k = kit();
    if (!k || !k.wordNotesFor || !k.segmentPrompt || !k.numberNotes) {
      return '<p class="card-prompt">' + escapeHtml(prompt) + "</p>";
    }
    var notes = k.wordNotesFor(c);
    var numbered = k.numberNotes(prompt, notes);
    if (!numbered.length) {
      return '<p class="card-prompt">' + escapeHtml(prompt) + "</p>";
    }
    var segs = k.segmentPrompt(prompt, numbered);
    var html = '<div class="card-prompt prompt prompt-hover">';
    segs.forEach(function (seg) {
      if (!seg.note) {
        html += "<span>" + escapeHtml(seg.text) + "</span>";
        return;
      }
      var tip = k.tipFields
        ? k.tipFields({ phrase: seg.text, kind: seg.note.kind, means: seg.note.means })
        : { meaning: seg.note.means || "", effect: "" };
      var kindLabel = (k.KIND_LABEL && k.KIND_LABEL[seg.note.kind]) || seg.note.kind || "Detail";
      var definition = tip.definition || tip.meaning || "A prompt term for a specific visual choice.";
      var influence = tip.influence || tip.why || tip.effect || "Underlined because this phrase changes the output.";
      html +=
        '<span class="phrase">' +
        '<span role="button" tabindex="0" class="phrase-btn" aria-expanded="false">' +
        underlineHtml(seg.text, k) +
        "</span>" +
        '<span class="tip-card" role="tooltip" hidden>' +
        '<span class="tip-kind">' +
        escapeHtml(kindLabel) +
        "</span>" +
        '<span class="tip-def"><span>Definition</span>' +
        escapeHtml(definition) +
        "</span>" +
        '<span class="tip-why"><span>Why it\'s influential</span>' +
        escapeHtml(influence) +
        "</span></span></span>";
    });
    html += "</div>";
    return html;
  }

  function positionTip(phrase) {
    var btn = phrase.querySelector(".phrase-btn");
    var tip = phrase.querySelector(".tip-card");
    if (!btn || !tip) return;
    tip.style.position = "absolute";
    tip.style.left = "0";
    tip.style.right = "auto";
    tip.style.transform = "none";
    tip.style.zIndex = "9999";
    var br = btn.getBoundingClientRect();
    var tipH = tip.offsetHeight || 120;
    var below = window.innerHeight - br.bottom - 12;
    var above = br.top - 12;
    if (below < tipH && above > below) {
      tip.style.top = "auto";
      tip.style.bottom = "calc(100% + 6px)";
    } else {
      tip.style.bottom = "auto";
      tip.style.top = "calc(100% + 6px)";
    }
    tip.style.maxHeight = Math.max(96, Math.max(below, above)) + "px";
    var tipW = Math.min(tip.offsetWidth || 280, window.innerWidth - 20);
    var overflow = br.left + tipW - window.innerWidth + 10;
    tip.style.left = overflow > 0 ? Math.max(-br.left + 10, -overflow) + "px" : "0px";
  }

  function openPhrase(phrase) {
    if (!phrase) return;
    phrase.classList.add("is-open");
    var tip = phrase.querySelector(".tip-card");
    var btn = phrase.querySelector(".phrase-btn");
    if (tip) tip.hidden = false;
    if (btn) btn.setAttribute("aria-expanded", "true");
    positionTip(phrase);
  }

  function closePhrase(phrase) {
    if (!phrase) return;
    phrase.classList.remove("is-open");
    var tip = phrase.querySelector(".tip-card");
    var btn = phrase.querySelector(".phrase-btn");
    if (tip) tip.hidden = true;
    if (btn) btn.setAttribute("aria-expanded", "false");
  }

  function wirePromptTips(root) {
    if (!root) return;
    root.querySelectorAll(".card-prompt .phrase").forEach(function (phrase) {
      if (phrase.__psTipWired) return;
      phrase.__psTipWired = 1;
      var leaveTimer = null;
      function clearLeave() {
        if (leaveTimer !== null) {
          window.clearTimeout(leaveTimer);
          leaveTimer = null;
        }
      }
      function scheduleClose() {
        clearLeave();
        leaveTimer = window.setTimeout(function () {
          closePhrase(phrase);
        }, 160);
      }
      phrase.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
      });
      phrase.addEventListener("pointerenter", function (e) {
        if (e.pointerType && e.pointerType !== "mouse") return;
        clearLeave();
        openPhrase(phrase);
      });
      phrase.addEventListener("pointerleave", function (e) {
        if (e.pointerType === "mouse") scheduleClose();
      });
      var btn = phrase.querySelector(".phrase-btn");
      if (btn) {
        btn.addEventListener("click", function (e) {
          e.preventDefault();
          e.stopPropagation();
          if (phrase.classList.contains("is-open")) closePhrase(phrase);
          else openPhrase(phrase);
        });
        btn.addEventListener("keydown", function (e) {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            e.stopPropagation();
            if (phrase.classList.contains("is-open")) closePhrase(phrase);
            else openPhrase(phrase);
          }
        });
        btn.addEventListener("focus", function () {
          clearLeave();
          openPhrase(phrase);
        });
        btn.addEventListener("blur", function () {
          scheduleClose();
        });
      }
      var tip = phrase.querySelector(".tip-card");
      if (tip) {
        tip.addEventListener("pointerenter", function () {
          clearLeave();
          openPhrase(phrase);
        });
        tip.addEventListener("pointerleave", function (e) {
          if (e.pointerType === "mouse") scheduleClose();
        });
      }
    });
  }


  function isVideo(c) {
    if (!c) return false;
    if (c.mediaKind === "video") return true;
    var u = c.mediaUrl || c.imageURL || "";
    return /\.(webm|mp4|mov)(\?|$)/i.test(u);
  }

  function mediaUrl(c) {
    return (c && (c.mediaUrl || c.imageURL)) || "";
  }

  /** Poster jpg for video plates (never the mp4) — used for thumbs + probes. */
  function posterUrl(c) {
    if (!c) return "";
    if (c.poster) return c.poster;
    if (c.mediaPoster) return c.mediaPoster;
    var u = mediaUrl(c);
    if (!u) return "";
    if (/\.(webm|mp4|mov)(\?|$)/i.test(u)) {
      return u.replace("/media/video/", "/media/posters/").replace(/\.(webm|mp4|mov)(\?|$)/i, ".jpg$2");
    }
    return u;
  }

  function fetchFeed(kind, limit, tag) {
    var url = "/api/feed?kind=" + encodeURIComponent(kind) + "&limit=" + (limit || 40);
    if (tag) url += "&tag=" + encodeURIComponent(tag);
    return fetch(url, { credentials: "same-origin" })
      .then(function (r) { return r.json(); })
      .then(function (d) { return (d && d.creations) || []; })
      .catch(function () { return []; });
  }

  /** Probe via Image() only — videos use poster jpg, never mp4. */
  function probeOk(c) {
    return new Promise(function (resolve) {
      var url = isVideo(c) ? posterUrl(c) : mediaUrl(c);
      if (!url) return resolve(null);
      var img = new Image();
      var finished = false;
      function finishImage(ok) {
        if (finished) return;
        finished = true;
        resolve(ok ? c : null);
      }
      img.onload = function () { finishImage(img.naturalWidth > 0); };
      img.onerror = function () { finishImage(false); };
      setTimeout(function () { finishImage(false); }, 4000);
      img.src = url;
    });
  }

  function filterLoadable(list) {
    return Promise.all(list.map(probeOk)).then(function (rows) {
      return rows.filter(Boolean);
    });
  }

  /** Probe at most `max` shuffled candidates; resolve first that loads. */
  function pickFirstLoadable(list, max) {
    var candidates = shuffle(list).slice(0, max || 3);
    function next(i) {
      if (i >= candidates.length) return Promise.resolve(null);
      return probeOk(candidates[i]).then(function (ok) {
        return ok || next(i + 1);
      });
    }
    return next(0);
  }

  function cardHtml(c, compact) {
    var thumb = isVideo(c) ? posterUrl(c) : mediaUrl(c);
    var media;
    if (isVideo(c)) {
      // Featured video cards: <img> poster only; hover creates one muted preview video.
      media = '<div class="ps-ia-card-media is-video"><img class="ps-ia-poster" src="' + escapeHtml(thumb) +
        '" alt="" loading="lazy" decoding="async" data-ps-preview-src="' + escapeHtml(mediaUrl(c)) +
        '"/></div>';
    } else {
      media = '<div class="ps-ia-card-media is-image"><img src="' + escapeHtml(thumb) + '" alt="" loading="lazy" decoding="async"/></div>';
    }
    return '<a class="ps-ia-featured-card' + (compact ? " is-" + compact : "") + '" href="/p/' +
      encodeURIComponent(c.id) + '" data-ps-creation="' + escapeHtml(c.id) + '">' + media +
      '<div class=\"ps-ia-card-body\"><div class=\"card-row\"><span class=\"model-chip\">' + escapeHtml((window.psDisplayModel && window.psDisplayModel(c)) || c.displayModel || c.modelVersion || c.model || "Grok") + '</span></div><h3>' + escapeHtml(c.title || "Untitled") + '</h3>' +
      promptHtml(c) + '</div></a>';
  }

  window.psShelfPrompt = { html: promptHtml, wire: wirePromptTips };

  /* Featured hover preview — max one concurrent mp4; desktop fine-pointer only. */
  var iaActivePreview = null;

  function iaFineHover() {
    try {
      return window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    } catch (e) {
      return true;
    }
  }

  function iaMuteObs(on) {
    if (on) document.documentElement.dataset.psMuteObs = "1";
    else delete document.documentElement.dataset.psMuteObs;
  }

  function iaStopPreview() {
    if (!iaActivePreview) return;
    var v = iaActivePreview.video;
    var card = iaActivePreview.card;
    var media = iaActivePreview.media;
    var poster = iaActivePreview.poster;
    try { v.pause(); } catch (e) {}
    v.removeAttribute("src");
    try { v.load(); } catch (e2) {}
    if (media && poster) {
      iaMuteObs(true);
      try {
        if (v.parentNode === media) media.replaceChild(poster, v);
        else if (!poster.parentNode) media.appendChild(poster);
      } finally {
        iaMuteObs(false);
      }
    }
    if (card) card.classList.remove("is-previewing");
    iaActivePreview = null;
  }

  function iaEnsureVideo(media, posterEl) {
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

  function iaStartPreview(card, media, posterEl, src) {
    if (!src || !media || !posterEl) return;
    var video = iaEnsureVideo(media, posterEl);
    if (iaActivePreview && iaActivePreview.video === video) return;
    iaStopPreview();
    iaMuteObs(true);
    try {
      if (posterEl.parentNode === media) media.replaceChild(video, posterEl);
      else media.appendChild(video);
    } finally {
      iaMuteObs(false);
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
    iaActivePreview = { card: card, video: video, media: media, poster: posterEl, src: src };
  }

  function wireFeaturedHover(root) {
    if (!root || !iaFineHover()) return;
    root.querySelectorAll("a.ps-ia-featured-card img[data-ps-preview-src]").forEach(function (img) {
      var card = img.closest("a.ps-ia-featured-card");
      var media = img.closest(".ps-ia-card-media");
      var src = img.getAttribute("data-ps-preview-src") || "";
      if (!card || !media || !src || card.__psHoverWired) return;
      card.__psHoverWired = 1;
      card.addEventListener("pointerenter", function () { iaStartPreview(card, media, img, src); });
      card.addEventListener("pointerleave", function () {
        if (iaActivePreview && iaActivePreview.media === media) iaStopPreview();
      });
    });
  }

  function playVideos(root) {
    if (!root) return;
    // Only autoplay intentional hub Videos background (ps-disc-video), never grid/featured cards.
    root.querySelectorAll("video.ps-disc-video").forEach(function (v) {
      try {
        v.muted = true;
        v.playsInline = true;
        var p = v.play();
        if (p && p.catch) p.catch(function () {});
      } catch (e) {}
    });
  }

  function renderHub(mount) {
    if (!mount || mount.getAttribute(HUB_DONE) === "1") return;
    mount.setAttribute(HUB_DONE, "1");
    mount.classList.add("ps-discover-hub");
    mount.innerHTML =
      '<div class="ps-disc-split" role="navigation" aria-label="Images and Videos">' +
      '<a class="ps-disc-pane ps-disc-pane--images" href="/images/">' +
      '<div class="ps-disc-media" style="background:#1a2238 url(/media/images/nature-q-aurora-lake.webp?v=20261004hub3) center/cover no-repeat">' +
      '<div class="ps-disc-shade"></div>' +
      '<div class="ps-disc-label"><span class="ps-disc-word">Images</span></div>' +
      '</div></a>' +
      '<a class="ps-disc-pane ps-disc-pane--videos" href="/videos/">' +
      '<div class="ps-disc-media" style="background:#142028 url(/media/posters/landscapes-alpine-lake.jpg?v=20261002alpine3) center/cover no-repeat">' +
      '<div class="ps-disc-shade"></div>' +
      '<div class="ps-disc-label"><span class="ps-disc-word">Videos</span></div>' +
      '</div></a>' +
      '</div>' +
      '<div class="ps-hub-legal" aria-label="Site information">' +
      '<a href="/terms">Terms</a><a href="/privacy">Privacy</a><a href="/contact">Contact</a><a href="/about">About</a>' +
      '</div>';
    // Images pane: one loadable still. Videos pane: single known-good short HD plate (no multi-video fetch).
    // Insert the video immediately. Do not wait on the image probe (that can take seconds).
    var HUB_VIDEO_SRC = "/media/video/hub-alpine-540.mp4?v=20261004hub3";
    var HUB_VIDEO_POSTER = "/media/posters/landscapes-alpine-lake.jpg?v=20261002alpine3";
    var vpNow = mount.querySelector(".ps-disc-pane--videos .ps-disc-media");
    if (vpNow && !vpNow.querySelector("video.ps-disc-video")) {
      vpNow.insertAdjacentHTML(
        "afterbegin",
        '<video class="ps-disc-video" src="' + HUB_VIDEO_SRC + '" poster="' + HUB_VIDEO_POSTER +
          '" muted loop playsinline autoplay preload="metadata" disableRemotePlayback></video>'
      );
      playVideos(mount);
    }
    fetchFeed("image", 6)
      .then(function (imgs) { return pickFirstLoadable(imgs, 3); })
      .then(function (img) {
        if (!isHub() || !mount.isConnected) return;
        var ip = mount.querySelector(".ps-disc-pane--images .ps-disc-media");
        var vp = mount.querySelector(".ps-disc-pane--videos .ps-disc-media");
        if (img && ip) ip.insertAdjacentHTML("afterbegin", '<img src="' + escapeHtml(mediaUrl(img)) + '" alt="" class="ps-disc-img"/>');
        if (vp && !vp.querySelector("video.ps-disc-video")) {
          vp.insertAdjacentHTML(
            "afterbegin",
            '<video class="ps-disc-video" src="' + HUB_VIDEO_SRC + '" poster="' + HUB_VIDEO_POSTER +
              '" muted loop playsinline autoplay preload="auto" disableRemotePlayback></video>'
          );
        }
        playVideos(mount);
      });
  }

  function renderFeaturedBrowse(kind, page, existingGrid) {
    if (!page || !existingGrid) return;
    // Exactly one Featured block per browse page. popstate / bfcache restore clear
    // BROWSE_DONE and rescan; without this guard a second block was stacked on top.
    var keep = null;
    document.querySelectorAll(".ps-ia-featured-block").forEach(function (b) {
      var ok = !keep && b.isConnected && b.getAttribute("data-ps-featured-kind") === kind && page.contains(b);
      if (ok) { keep = b; return; }
      iaMuteObs(true);
      try { b.remove(); } finally { iaMuteObs(false); }
    });
    if (page.getAttribute(BROWSE_DONE) === "1" && keep) return;
    if (activeTag()) return; // Keep category-filtered browsing intact.
    if (keep) {
      page.setAttribute(BROWSE_DONE, "1");
      if (existingGrid.getAttribute("hidden") !== "true") {
        iaMuteObs(true);
        try { existingGrid.setAttribute("hidden", "true"); existingGrid.style.display = "none"; } finally { iaMuteObs(false); }
      }
      return;
    }
    page.setAttribute(BROWSE_DONE, "1");
    var block = document.createElement("section");
    block.className = "ps-ia-featured-block";
    block.setAttribute("data-ps-featured-kind", kind);
    block.innerHTML = '<h2 class="ps-ia-featured-heading">Featured</h2><div class="ps-ia-featured-grid" aria-live="polite"><p class="lede">Loading featured plates…</p></div>';
    iaMuteObs(true);
    try {
      existingGrid.parentNode.insertBefore(block, existingGrid);
      existingGrid.setAttribute("hidden", "true");
      existingGrid.style.display = "none";
    } finally {
      iaMuteObs(false);
    }
    var grid = block.querySelector(".ps-ia-featured-grid");
    /* Full catalog shuffle each load, then first 9 that actually load. */
    fetchFeed(kind, 120)
      .then(function (items) {
        var pool = shuffle(items);
        var picked = [];
        var i = 0;
        function step() {
          if (picked.length >= 9 || i >= pool.length) return Promise.resolve(picked);
          var batch = pool.slice(i, i + 12);
          i += batch.length;
          return filterLoadable(batch).then(function (ok) {
            ok.forEach(function (c) {
              if (picked.length < 9) picked.push(c);
            });
            return step();
          });
        }
        return step();
      })
      .then(function (picks) {
        if (!grid || !block.isConnected) return;
        iaMuteObs(true);
        try {
          if (!picks.length) {
            grid.innerHTML = '<div class="empty-panel"><h2>No featured plates yet</h2><p>Check back soon.</p></div>';
            return;
          }
          grid.innerHTML = picks.map(function (c) { return cardHtml(c, kind); }).join("");
        } finally {
          iaMuteObs(false);
        }
        iaStopPreview();
        wireFeaturedHover(grid);
        wirePromptTips(grid);
        try {
          if (window.psThumbsRescan) window.psThumbsRescan();
          setTimeout(function () { if (window.psThumbsRescan) window.psThumbsRescan(); }, 0);
        } catch (eThumb) {}
      });
  }

  function findBrowsePage(kind) {
    if (kind === "videos") {
      var vm = document.getElementById("ps-videos-mount") || document.querySelector("[data-ps-videos]");
      return vm && vm.querySelector(".ps-videos-grid") ? { page: vm, grid: vm.querySelector(".ps-videos-grid") } : null;
    }
    var page = document.querySelector(".net-main .net-page:not(.ps-home-page):not(.ps-discover-hub)");
    var grid = page && page.querySelector(".card-grid");
    return page && grid ? { page: page, grid: grid } : null;
  }

  function patchCategoryChips() {
    document.querySelectorAll(".ps-cat-carousel").forEach(function (bar) {
      var cities = null;
      bar.querySelectorAll("a.chip").forEach(function (a) {
        var href = a.getAttribute("href") || "";
        if (href.indexOf("tag=cities") >= 0 || (a.textContent || "").trim() === "Cities") {
          cities = a;
          // textContent assignment always mutates. Repeating it retriggers the
          // IA observer and froze /images and /videos before plates could paint.
          if ((a.textContent || "").trim() !== "International Cities") a.textContent = "International Cities";
        }
      });
      var hasUs = !!bar.querySelector('[data-ps-us-cities-chip="1"], a[href*="tag=us-cities"]');
      if (!hasUs) {
        bar.querySelectorAll("a.chip").forEach(function (a) {
          if ((a.textContent || "").trim() === "US Cities") hasUs = true;
        });
      }
      // React already renders a US Cities chip on Images. Inserting another duplicated it.
      if (!cities || hasUs) return;
      var us = document.createElement("a");
      us.className = "chip";
      us.href = (path() === "/videos" ? "/videos/" : "/images/") + "?tag=us-cities";
      us.textContent = "US Cities";
      us.setAttribute("data-ps-us-cities-chip", "1");
      us.addEventListener("click", function (ev) {
        ev.preventDefault();
        history.pushState({}, "", us.href);
        window.dispatchEvent(new PopStateEvent("popstate"));
      });
      iaMuteObs(true);
      try { cities.parentNode.insertBefore(us, cities.nextSibling); } finally { iaMuteObs(false); }
    });
  }

  function hideHomeChrome() {
    if (!isHub()) return;
    document.querySelectorAll(".ps-cat-carousel, [data-ps-cat-carousel]").forEach(function (el) {
      if (el.closest("#ps-home-mount, #ps-discover-mount")) return;
      el.setAttribute("hidden", "true");
      el.style.display = "none";
    });
  }

  function wireDiscoverNav() {
    document.querySelectorAll("nav.net-links a, nav.net-tabbar a, nav[aria-label='Primary'] a, nav[aria-label='App'] a").forEach(function (a) {
      var text = (a.textContent || "").replace(/\s+/g, " ").trim();
      var isDisc = a.classList.contains("ps-discover") || a.getAttribute("data-ps-eye") === "1" || a.classList.contains("ps-nav-swap") || /^discover$/i.test(text) || /^disc\s*ver$/i.test(text);
      if (!isDisc) return;
      if (path() === "/images") {
        a.setAttribute("href", "/videos/");
        a.classList.remove("is-on");
        return;
      }
      if (path() === "/videos") {
        a.setAttribute("href", "/images/");
        a.classList.remove("is-on");
        return;
      }
      a.setAttribute("href", "/");
      if (isHub()) a.classList.add("is-on"); else a.classList.remove("is-on");
    });
  }


  function ensureTaggedEmptyState() {
    if (!activeTag()) {
      document.querySelectorAll("[data-ps-cat-empty]").forEach(function (el) { el.remove(); });
      return;
    }
    var kind = path() === "/videos" ? "video" : path() === "/images" ? "image" : "";
    if (!kind) return;
    var grid = kind === "video"
      ? document.querySelector(".ps-videos-grid")
      : document.querySelector(".card-grid, .ps-plate-grid");
    var cards = grid && grid.querySelector("a.card, a.ps-videos-card, a.ps-ia-featured-card, a.ps-ia-card");
    document.querySelectorAll("[data-ps-cat-empty]").forEach(function (el) {
      if (cards) el.remove();
    });
    if (!grid || cards) return;
    if (document.querySelector(".net-page .empty-panel")) return;
    var panel = document.createElement("div");
    panel.className = "empty-panel";
    panel.setAttribute("data-ps-cat-empty", "1");
    panel.innerHTML = "<h2>No public plates in this category yet.</h2><p>Try another category, or clear the filter to see the full wall.</p>";
    iaMuteObs(true);
    try {
      if (grid.parentNode) grid.parentNode.insertBefore(panel, grid);
    } finally {
      iaMuteObs(false);
    }
  }

  function scan() {
    wireDiscoverNav();
    patchCategoryChips();
    hideHomeChrome();
    if (isHub()) {
      document.documentElement.removeAttribute("data-ps-tagged");
      var hub = document.getElementById("ps-home-mount") || document.getElementById("ps-discover-mount") || document.querySelector("[data-ps-home], [data-ps-discover-hub]");
      if (hub) renderHub(hub);
      return;
    }
    var browseKind = path() === "/videos" ? "videos" : path() === "/images" ? "images" : "";
    if (browseKind && activeTag()) {
      document.documentElement.setAttribute("data-ps-tagged", "1");
      iaMuteObs(true);
      try {
        document.querySelectorAll(".ps-ia-featured-block").forEach(function (b) { b.remove(); });
        document.querySelectorAll(".card-grid, .ps-plate-grid, .ps-featured-block, .empty-panel, .ps-videos-grid").forEach(function (el) {
          if (el.closest(".ps-ia-featured-block")) return;
          el.removeAttribute("hidden");
          el.style.removeProperty("display");
        });
        document.querySelectorAll("[" + BROWSE_DONE + "]").forEach(function (el) {
          el.removeAttribute(BROWSE_DONE);
        });
      } finally {
        iaMuteObs(false);
      }
      setTimeout(ensureTaggedEmptyState, 50);
      setTimeout(ensureTaggedEmptyState, 600);
      return;
    }
    document.documentElement.removeAttribute("data-ps-tagged");
    if (browseKind && !activeTag()) {
      var found = findBrowsePage(browseKind);
      if (found) renderFeaturedBrowse(browseKind === "videos" ? "video" : "image", found.page, found.grid);
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
    if (!root || root.__psIaObs) return;
    var obs = new MutationObserver(function () { scheduleScan(); });
    obs.observe(root, { childList: true, subtree: true });
    root.__psIaObs = obs;
    window.addEventListener("popstate", function () {
      document.querySelectorAll("[" + HUB_DONE + "], [" + BROWSE_DONE + "]").forEach(function (el) {
        el.removeAttribute(HUB_DONE);
        el.removeAttribute(BROWSE_DONE);
      });
      setTimeout(scan, 0);
    });
    window.addEventListener("pageshow", function (ev) {
      if (!ev.persisted) return;
      document.querySelectorAll("[" + BROWSE_DONE + "]").forEach(function (el) {
        el.removeAttribute(BROWSE_DONE);
      });
      setTimeout(scan, 0);
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
