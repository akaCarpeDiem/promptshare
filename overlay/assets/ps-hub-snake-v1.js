/* PromptShare home: a tiny retro snake roaming the Games triangle (snake1, 2026-10-07).
   Canvas sits inside .ps-disc-pane--games .ps-disc-media (the pane's clip-path clips it to the triangle),
   above the circuit art and below the shade + "Games" label. Replaces the arrow-keys art on the hub.
   Eats dots, grows by one per dot, then leaves off the bottom edge, pauses, and re-enters small. Forever.
   Pauses when the tab is hidden / pane offscreen / not on the hub. prefers-reduced-motion: one static frame. */
(function () {
  "use strict";
  var D = document, W = window;
  var RM = W.matchMedia ? W.matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };
  var APEX = 0.625; // triangle apex at 62.5% of the pane height (ps-games-v1/v2.css)
  var S = null;     // live instance

  function onHub() { var p = location.pathname.replace(/\/+$/, "") || "/"; return p === "/" || p === "/discover"; }
  function rnd(n) { return Math.floor(Math.random() * n); }

  function Snake(media) {
    var cv = D.createElement("canvas");
    cv.className = "ps-hub-snake";
    cv.setAttribute("aria-hidden", "true");
    cv.style.cssText = "position:absolute;left:0;right:0;top:" + (APEX * 100) + "%;bottom:0;width:100%;height:" + ((1 - APEX) * 100) + "%;z-index:1;pointer-events:none;display:block";
    var shade = media.querySelector(".ps-disc-shade");
    media.insertBefore(cv, shade || null);
    media.closest(".ps-disc-pane--games").classList.add("ps-snake-on");
    var ctx = cv.getContext("2d");
    var me = this, raf = 0, last = 0, acc = 0, visible = true, running = false;
    var w = 0, h = 0, dpr = 1, cell = 14, cols = 0, rows = 0, ok = null, grid = null, noDot = null;
    var body = [], dir = [0, -1], grow = 0, dots = [], pops = [], removed = null;
    var phase = "enter", born = 0, pauseUntil = 0, maxLen = 22, stepMs = 125;

    function inside(cx, cy, m) { return cy >= m && cy <= h - m * 0.7 && Math.abs(cx - w / 2) <= (cy / h) * (w / 2) - m; }
    function layout() {
      var r = cv.getBoundingClientRect();
      if (!r.width || !r.height) return false;
      dpr = Math.min(2, W.devicePixelRatio || 1);
      w = r.width; h = r.height;
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
      cell = Math.max(10, Math.min(18, Math.round(w / 78)));
      stepMs = w < 600 ? 140 : 120;
      maxLen = w < 600 ? 22 : 30;
      cols = Math.floor(w / cell); rows = Math.floor(h / cell);
      ok = []; noDot = [];
      var word = media.querySelector(".ps-disc-word"), lr = word && word.getBoundingClientRect();
      for (var x = 0; x < cols; x++) {
        ok[x] = []; noDot[x] = [];
        for (var y = 0; y < rows; y++) {
          var cx = (x + 0.5) * cell, cy = (y + 0.5) * cell;
          ok[x][y] = inside(cx, cy, cell * 0.9);
          var ax = r.left + cx, ay = r.top + cy;
          noDot[x][y] = !ok[x][y] || !inside(cx, cy, cell * 1.8) ||
            (lr && ax > lr.left - cell * 1.5 && ax < lr.right + cell * 1.5 && ay > lr.top - cell * 1.5 && ay < lr.bottom + cell * 1.5);
        }
      }
      // faint retro dot grid, drawn once per layout
      grid = D.createElement("canvas"); grid.width = cv.width; grid.height = cv.height;
      var g = grid.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.fillStyle = "rgba(142,233,255,0.10)";
      for (x = 0; x < cols; x++) for (y = 0; y < rows; y++) if (ok[x][y]) g.fillRect((x + 0.5) * cell - 0.75, (y + 0.5) * cell - 0.75, 1.5, 1.5);
      return true;
    }
    function free(x, y) { if (!ok[x] || !ok[x][y]) return false; for (var i = 0; i < body.length - 1; i++) if (body[i][0] === x && body[i][1] === y) return false; return true; }
    function spawnDot() {
      for (var t = 0; t < 300; t++) {
        var x = rnd(cols), y = rnd(rows);
        if (noDot[x] && !noDot[x][y] && free(x, y) && !dots.some(function (d) { return d[0] === x && d[1] === y; })) { dots.push([x, y]); return; }
      }
    }
    function reset(now) {
      // enter small from below the base, near the middle third
      var x = Math.floor(cols / 2) + rnd(Math.max(1, Math.floor(cols / 3))) - Math.floor(cols / 6);
      body = [[x, rows], [x, rows + 1], [x, rows + 2]]; dir = [0, -1]; grow = 0; removed = null;
      phase = "enter"; born = now; dots = []; pops = [];
      var want = w < 600 ? 2 : 3; for (var i = 0; i < want; i++) spawnDot();
    }
    function step(now) {
      var hd = body[0];
      if (phase === "enter" && ok[hd[0]] && ok[hd[0]][hd[1]] && hd[1] < rows - 2) phase = "play";
      if (phase === "play" && (body.length >= maxLen || now - born > 80000)) phase = "exit";
      var opts = [[dir[0], dir[1]], [dir[1], -dir[0]], [-dir[1], dir[0]]], best = null, bs = 1e9;
      var tgt = null;
      if (phase === "exit" || phase === "enter") tgt = phase === "exit" ? [hd[0], rows + 4] : [hd[0], rows - 4];
      else if (dots.length) { var bd = 1e9; dots.forEach(function (d) { var dd = Math.abs(d[0] - hd[0]) + Math.abs(d[1] - hd[1]); if (dd < bd) { bd = dd; tgt = d; } }); }
      for (var i = 0; i < 3; i++) {
        var nx = hd[0] + opts[i][0], ny = hd[1] + opts[i][1];
        var safe = phase === "play" ? free(nx, ny) : !body.slice(0, -1).some(function (b) { return b[0] === nx && b[1] === ny; });
        if (phase === "exit" && ny < hd[1]) safe = safe && free(nx, ny);
        if (!safe) continue;
        var sc = tgt ? Math.abs(tgt[0] - nx) + Math.abs(tgt[1] - ny) : 0;
        sc += Math.random() * (phase === "play" ? 2.2 : 0.3) + (i ? 0.35 : 0); // wander + slight preference to go straight
        if (sc < bs) { bs = sc; best = opts[i]; }
      }
      if (!best) { phase = "exit"; best = [0, 1]; }
      dir = best;
      body.unshift([hd[0] + dir[0], hd[1] + dir[1]]);
      for (var k = 0; k < dots.length; k++) if (dots[k][0] === body[0][0] && dots[k][1] === body[0][1]) {
        pops.push({ x: dots[k][0], y: dots[k][1], t: now }); dots.splice(k, 1); grow++; if (phase === "play") spawnDot(); break;
      }
      if (grow > 0) { grow--; removed = null; } else removed = body.pop();
      if (phase === "exit" && body.every(function (b) { return b[1] >= rows; })) {
        phase = "gone"; pauseUntil = now + 1600;
      }
    }
    function c(p) { return [(p[0] + 0.5) * cell, (p[1] + 0.5) * cell]; }
    function draw(f, now) {
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height);
      if (grid) ctx.drawImage(grid, 0, 0);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // dots: warm orange with a soft halo
      dots.forEach(function (d, i) {
        var p = c(d), pulse = 0.5 + 0.5 * Math.sin(now / 420 + i * 1.7);
        ctx.fillStyle = "rgba(255,154,60," + (0.16 + 0.1 * pulse) + ")"; ctx.beginPath(); ctx.arc(p[0], p[1], cell * 0.62, 0, 6.2832); ctx.fill();
        ctx.fillStyle = "#ffb15e"; ctx.beginPath(); ctx.arc(p[0], p[1], cell * 0.26, 0, 6.2832); ctx.fill();
      });
      pops = pops.filter(function (p) { return now - p.t < 450; });
      pops.forEach(function (p) { var k = (now - p.t) / 450, q = c([p.x, p.y]); ctx.strokeStyle = "rgba(255,177,94," + (1 - k) * 0.8 + ")"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(q[0], q[1], cell * (0.3 + k * 0.9), 0, 6.2832); ctx.stroke(); });
      if (phase === "gone" || !body.length) return;
      // body: smooth polyline through cell centres, head/tail interpolated between steps
      var pts = [], n = body.length;
      var h0 = c(body[0]), h1 = c(body[1] || body[0]);
      pts.push([h1[0] + (h0[0] - h1[0]) * f, h1[1] + (h0[1] - h1[1]) * f]);
      for (var i = 1; i < n; i++) pts.push(c(body[i]));
      if (removed) { var t0 = c(removed), tl = c(body[n - 1]); pts.push([t0[0] + (tl[0] - t0[0]) * f, t0[1] + (tl[1] - t0[1]) * f]); }
      var hp = pts[0], tp = pts[pts.length - 1];
      var gr = ctx.createLinearGradient(hp[0], hp[1], tp[0], tp[1]);
      gr.addColorStop(0, "#8ee9ff"); gr.addColorStop(1, "#c4a6ff");
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      function path() { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (var j = 1; j < pts.length; j++) ctx.lineTo(pts[j][0], pts[j][1]); }
      path(); ctx.strokeStyle = "rgba(142,233,255,0.16)"; ctx.lineWidth = cell * 1.05; ctx.stroke();   // soft glow
      path(); ctx.strokeStyle = gr; ctx.lineWidth = cell * 0.62; ctx.stroke();
      // head + eyes
      ctx.fillStyle = "#b9f3ff"; ctx.beginPath(); ctx.arc(hp[0], hp[1], cell * 0.38, 0, 6.2832); ctx.fill();
      var ex = dir[1] * cell * 0.15, ey = -dir[0] * cell * 0.15, fx = dir[0] * cell * 0.12, fy = dir[1] * cell * 0.12;
      ctx.fillStyle = "#0b1426";
      ctx.beginPath(); ctx.arc(hp[0] + ex + fx, hp[1] + ey + fy, Math.max(1, cell * 0.075), 0, 6.2832); ctx.fill();
      ctx.beginPath(); ctx.arc(hp[0] - ex + fx, hp[1] - ey + fy, Math.max(1, cell * 0.075), 0, 6.2832); ctx.fill();
    }
    function frame(now) {
      raf = 0;
      if (!running) return;
      if (!cv.isConnected || !onHub()) { me.stop(); return; }
      var dt = last ? Math.min(250, now - last) : 16; last = now;
      if (phase === "gone") { if (now >= pauseUntil) reset(now); }
      else { acc += dt; while (acc >= stepMs) { acc -= stepMs; step(now); if (phase === "gone") { acc = 0; break; } } }
      draw(Math.min(1, acc / stepMs), now);
      raf = requestAnimationFrame(frame);
    }
    function staticFrame() {
      // reduced motion: one calm, representative frame (a short curl heading for a dot)
      if (!layout()) return;
      var cx = Math.floor(cols / 2), cy = Math.floor(rows * 0.62);
      body = []; var path0 = [[3, 0], [2, 0], [1, 0], [0, 0], [-1, 0], [-1, 1], [-2, 1], [-3, 1], [-4, 1], [-4, 0], [-5, 0]];
      path0.forEach(function (o) { body.push([cx + o[0] - 2, cy + o[1]]); });
      dir = [1, 0]; removed = null; phase = "play"; pops = [];
      dots = [[cx + 5, cy], [cx - 6, cy - 4]].filter(function (d) { return ok[d[0]] && ok[d[0]][d[1]]; });
      draw(1, 0);
    }
    this.start = function () {
      if (RM.matches) { running = false; staticFrame(); return; }
      if (running || !visible || D.hidden) return;
      if (!w && !layout()) return;
      running = true; last = 0;
      if (!body.length) reset(performance.now());
      raf = requestAnimationFrame(frame);
    };
    this.stop = function () { running = false; if (raf) cancelAnimationFrame(raf); raf = 0; };
    this.relayout = function () { var was = running; me.stop(); if (layout()) { if (RM.matches) staticFrame(); else { reset(performance.now()); if (was || visible) me.start(); } } };
    this.cv = cv;
    this.state = function () { return { phase: phase, len: body.length, dots: dots.length, running: running, cell: cell, cols: cols, rows: rows, head: body[0] }; };
    this.setMax = function (n) { maxLen = n; };
    if ("IntersectionObserver" in W) new IntersectionObserver(function (es) { visible = es[0].isIntersecting; if (visible) me.start(); else me.stop(); }).observe(cv);
    if ("ResizeObserver" in W) { var rt = 0; new ResizeObserver(function () { clearTimeout(rt); rt = setTimeout(me.relayout, 120); }).observe(cv); }
    else W.addEventListener("resize", function () { me.relayout(); });
  }

  W.__psSnake = { state: function () { return S ? S.state() : null; }, setMax: function (n) { if (S) S.setMax(n); } };
  function ensure() {
    if (!onHub()) { if (S) S.stop(); return; }
    var media = D.querySelector(".ps-disc-pane--games .ps-disc-media");
    if (!media) return;
    if (S && S.cv.isConnected && S.cv.parentNode === media) { S.start(); return; }
    if (S) S.stop();
    try { S = new Snake(media); S.start(); } catch (e) { S = null; }
  }
  var pend = 0;
  function soon() { if (!pend) pend = requestAnimationFrame(function () { pend = 0; ensure(); }); }
  function boot() {
    ensure();
    var root = D.getElementById("root") || D.body;
    new MutationObserver(function () { if (!S || !S.cv.isConnected) soon(); }).observe(root, { childList: true, subtree: true });
    W.addEventListener("popstate", soon);
    D.addEventListener("visibilitychange", function () { if (!S) return; if (D.hidden) S.stop(); else S.start(); });
    if (RM.addEventListener) RM.addEventListener("change", function () { if (S) S.relayout(); });
  }
  // Start after the hub has painted so it never competes with first paint / media preloads.
  function later() { (W.requestIdleCallback || function (f) { setTimeout(f, 200); })(boot, { timeout: 1500 }); }
  if (D.readyState === "complete") later(); else W.addEventListener("load", later);
})();
