/* PromptShare category carousel — "fill" paging (carfill1).
   The row always runs arrow to arrow: each page shows the whole chips that fit,
   and the leftover width is shared out as extra horizontal padding inside those
   chips (the chip gap stays exact). The gap between ‹ and the first chip and
   between the last chip and › equals the normal chip gap. The last page is
   end-aligned (it may repeat chips from the previous page) so it also fills.
   Recomputed on resize, remount and every page change. */
(function () {
  function roots() {
    return Array.from(document.querySelectorAll("[data-ps-cat-carousel]"));
  }
  function chips(track) {
    return Array.from(track.querySelectorAll(".chip"));
  }
  function px(v) {
    var n = parseFloat(v);
    return isFinite(n) ? n : 0;
  }

  function ensureViewport(root) {
    var track = root.querySelector(".ps-cat-track");
    if (!track) return null;
    var vp = root.querySelector(".ps-cat-viewport");
    if (!vp) {
      vp = document.createElement("div");
      vp.className = "ps-cat-viewport";
      track.parentNode.insertBefore(vp, track);
      vp.appendChild(track);
    }
    return { root: root, vp: vp, track: track };
  }

  /* Border-box width of a chip from computed style (fractional, ignores the
     selected chip's scale animation). */
  function boxWidth(el) {
    var s = getComputedStyle(el);
    var w = px(s.width);
    if (s.boxSizing !== "border-box") {
      w += px(s.paddingLeft) + px(s.paddingRight) + px(s.borderLeftWidth) + px(s.borderRightWidth);
    }
    return w;
  }

  function clearExtra(list) {
    list.forEach(function (c) {
      c.style.removeProperty("padding-left");
      c.style.removeProperty("padding-right");
      c.style.removeProperty("justify-content");
    });
  }

  /* Measure natural widths and build pages. */
  function measure(parts) {
    var root = parts.root, vp = parts.vp, track = parts.track;
    var list = chips(track);
    clearExtra(list);
    track.style.transition = "none";
    track.style.display = "flex";
    track.style.width = "max-content";
    track.style.maxWidth = "none";
    track.style.overflow = "visible";
    track.style.scrollBehavior = "auto";
    vp.style.flex = "1 1 auto";
    vp.style.width = "auto";
    vp.style.maxWidth = "100%";
    vp.style.overflow = "hidden";
    vp.style.clipPath = "";

    var ts = getComputedStyle(track);
    var gap = px(ts.columnGap || ts.gap) || 8.8;
    var padStart = px(ts.paddingLeft);
    var rs = getComputedStyle(root);
    var rootGap = px(rs.columnGap || rs.gap);
    var vpW = vp.getBoundingClientRect().width - px(getComputedStyle(vp).paddingLeft) - px(getComputedStyle(vp).paddingRight);
    var hasPrev = !!root.querySelector(".ps-cat-arrow.is-prev");
    var hasNext = !!root.querySelector(".ps-cat-arrow.is-next");
    var insetL = hasPrev ? Math.max(0, gap - rootGap) : 0;
    var insetR = hasNext ? Math.max(0, gap - rootGap) : 0;
    var avail = vpW - insetL - insetR;

    var widths = list.map(boxWidth);
    var basePad = list.map(function (c) {
      var s = getComputedStyle(c);
      return [px(s.paddingLeft), px(s.paddingRight)];
    });

    // Pages are windows of whole chips. Each page's chips share out the
    // leftover width as padding; a chip may also give up to SHRINK px of padding
    // per side so one more chip fits (base padding ~15px -> min ~10px). Windows
    // may overlap (always allowed for the end-aligned last page) when that keeps
    // the fill tight. Score = 12px per page + the largest per-side padding change.
    var SHRINK = 5;
    var N = widths.length;
    function usedOf(a, b) {
      var u = 0;
      for (var i = a; i <= b; i++) u += widths[i] + (i > a ? gap : 0);
      return u;
    }
    function eOf(a, b) {
      return (avail - usedOf(a, b)) / (2 * (b - a + 1));
    }
    var pages = [];
    if (N && avail > 40) {
      // best[c] = best way to have chips 0..c shown; c = -1 is the start.
      var best = { "-1": { score: 0, maxE: 0, sumE: 0, pages: [] } };
      for (var c = -1; c < N - 1; c++) {
        var cur = best[c];
        if (!cur) continue;
        var lastA = cur.pages.length ? cur.pages[cur.pages.length - 1][0] : -1;
        for (var a = Math.max(lastA + 1, 0); a <= c + 1; a++) {
          for (var b = c + 1; b < N; b++) {
            var e = eOf(a, b);
            if (b > a && e < -SHRINK) break;
            var maxE = Math.max(cur.maxE, Math.abs(e));
            var cand = { pages: cur.pages.concat([[a, b]]), maxE: maxE, sumE: cur.sumE + Math.abs(e) * (b - a + 1) };
            cand.score = cand.pages.length * 12 + maxE;
            var prev = best[b];
            if (!prev || cand.score < prev.score - 0.01 || (Math.abs(cand.score - prev.score) <= 0.01 && cand.sumE < prev.sumE)) best[b] = cand;
          }
        }
      }
      if (best[N - 1]) pages = best[N - 1].pages;
    }
    parts.m = { list: list, widths: widths, basePad: basePad, gap: gap, padStart: padStart,
      insetL: insetL, avail: avail, pages: pages };
    return parts.m;
  }

  function show(parts, pageIdx, behavior) {
    var m = parts.m;
    if (!m || !m.pages.length) return;
    pageIdx = Math.max(0, Math.min(m.pages.length - 1, pageIdx));
    var pg = m.pages[pageIdx], a = pg[0], b = pg[1];
    var used = 0;
    for (var i = a; i <= b; i++) used += m.widths[i] + (i > a ? m.gap : 0);
    var n = b - a + 1;
    var each = (m.avail - used) / (2 * n); // may be negative (padding shrink)
    m.list.forEach(function (c, i) {
      if (i >= a && i <= b && Math.abs(each) > 0.01) {
        c.style.setProperty("padding-left", (m.basePad[i][0] + each).toFixed(3) + "px", "important");
        c.style.setProperty("padding-right", (m.basePad[i][1] + each).toFixed(3) + "px", "important");
        c.style.setProperty("justify-content", "center", "important");
      } else {
        c.style.removeProperty("padding-left");
        c.style.removeProperty("padding-right");
        c.style.removeProperty("justify-content");
      }
    });
    // Chips before `a` keep their natural widths, so the offset is exact.
    var x = m.padStart;
    for (var j = 0; j < a; j++) x += m.widths[j] + m.gap;
    var off = x - m.insetL; // may be slightly negative on page 1 (track padding < inset)
    var t = parts.track;
    t.style.transition = behavior === "smooth" ? "transform 0.28s cubic-bezier(.2,.8,.2,1)" : "none";
    t.style.transform = "translate3d(" + -off + "px,0,0)";
    t.dataset.psOff = String(off);
    t.dataset.psPage = String(pageIdx);
    t.dataset.psPages = String(m.pages.length);
    var root = parts.root;
    var prev = root.querySelector(".ps-cat-arrow.is-prev");
    var next = root.querySelector(".ps-cat-arrow.is-next");
    if (prev) prev.setAttribute("aria-disabled", pageIdx === 0 ? "true" : "false");
    if (next) next.setAttribute("aria-disabled", pageIdx === m.pages.length - 1 ? "true" : "false");
  }

  function pageOfChip(m, idx, prefer) {
    if (prefer != null && m.pages[prefer] && idx >= m.pages[prefer][0] && idx <= m.pages[prefer][1]) return prefer;
    for (var p = 0; p < m.pages.length; p++) if (idx >= m.pages[p][0] && idx <= m.pages[p][1]) return p;
    return 0;
  }

  function layout(parts) {
    var t = parts.track;
    var old = parts.m;
    var firstIdx = 0;
    if (old && old.pages.length && t.dataset.psPage != null) {
      var op = old.pages[+t.dataset.psPage || 0];
      if (op) firstIdx = op[0];
    }
    var m = measure(parts);
    if (!m.pages.length) return;
    // Fresh mount (first load, or the app re-rendered the row after a chip
    // click): open on the page holding the selected chip.
    if (!parts.root._psCatUser) {
      var on = parts.track.querySelector(".chip.is-on");
      var oi = on ? m.list.indexOf(on) : -1;
      if (oi >= 0) firstIdx = oi;
    }
    show(parts, pageOfChip(m, firstIdx), "auto");
  }

  function page(parts, dir) {
    parts.root._psCatUser = true;
    if (!parts.m) measure(parts);
    var cur = +parts.track.dataset.psPage || 0;
    show(parts, cur + dir, "smooth");
  }

  function refreshAll() {
    roots().forEach(function (root) {
      var parts = ensureViewport(root);
      if (!parts) return;
      parts.m = root._psCatM || null;
      layout(parts);
      root._psCatM = parts.m;
    });
  }

  function partsFor(root) {
    var parts = ensureViewport(root);
    if (!parts) return null;
    parts.m = root._psCatM || null;
    if (!parts.m || parts.m.list.length !== chips(parts.track).length || parts.m.list[0] !== chips(parts.track)[0]) {
      layout(parts);
      root._psCatM = parts.m;
    }
    return parts;
  }

  document.addEventListener(
    "click",
    function (e) {
      var btn = e.target.closest(".ps-cat-arrow");
      if (!btn) return;
      var root = btn.closest("[data-ps-cat-carousel]");
      if (!root) return;
      var parts = partsFor(root);
      if (!parts) return;
      e.preventDefault();
      page(parts, btn.classList.contains("is-prev") ? -1 : 1);
    },
    true,
  );

  document.addEventListener(
    "wheel",
    function (e) {
      var root = e.target.closest && e.target.closest("[data-ps-cat-carousel]");
      if (!root) return;
      if (Math.abs(e.deltaY) < Math.abs(e.deltaX)) return;
      var parts = partsFor(root);
      if (!parts || !parts.m || parts.m.pages.length < 2) return;
      e.preventDefault();
      page(parts, e.deltaY > 0 ? 1 : -1);
    },
    { passive: false, capture: true },
  );

  // Keyboard: tabbing to a chip on another page brings that page into view.
  document.addEventListener("focusin", function (e) {
    var chip = e.target.closest && e.target.closest(".ps-cat-track .chip");
    if (!chip) return;
    var root = chip.closest("[data-ps-cat-carousel]");
    if (!root) return;
    var parts = partsFor(root);
    if (!parts || !parts.m) return;
    var idx = parts.m.list.indexOf(chip);
    if (idx < 0) return;
    var cur = +parts.track.dataset.psPage || 0;
    var p = pageOfChip(parts.m, idx, cur);
    if (p !== cur) {
      root._psCatUser = true;
      show(parts, p, "smooth");
    }
    var vp = parts.vp;
    if (vp.scrollLeft) vp.scrollLeft = 0;
  });

  var resizeTimer;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(refreshAll, 100);
  });

  var bootTimer;
  function scheduleBoot() {
    clearTimeout(bootTimer);
    bootTimer = setTimeout(refreshAll, 50);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", refreshAll);
  else refreshAll();
  setTimeout(refreshAll, 300);
  setTimeout(refreshAll, 900);
  setTimeout(refreshAll, 1800);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(refreshAll);

  // Remount detection (debounced) — ignore our own viewport inserts
  var mo = new MutationObserver(function (muts) {
    for (var i = 0; i < muts.length; i++) {
      var m = muts[i];
      for (var j = 0; j < m.addedNodes.length; j++) {
        var n = m.addedNodes[j];
        if (!(n instanceof Element)) continue;
        if (n.classList && (n.classList.contains("ps-cat-viewport") || n.classList.contains("ps-cat-track"))) continue;
        if (n.matches && (n.matches("[data-ps-cat-carousel], .ps-cat-track, .chip") || (n.querySelector && n.querySelector("[data-ps-cat-carousel], .ps-cat-track")))) {
          scheduleBoot();
          return;
        }
      }
    }
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });
})();
