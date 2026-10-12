/* The retro snake on the home page's Games tile (brought back from ps-hub-snake-v1.js, Oct 7 2026,
   which ran in the old Games triangle). A canvas sits above the circuit picture and below the tile's
   shade and its "Games" text. The snake eats warm dots, grows one cell per dot, leaves off the bottom
   edge, pauses, and comes back small. Forever.
   Runs only while the tile is on screen and the tab is visible. prefers-reduced-motion: one still frame.
   pointer-events: none, so the tile link works as before. */
const rnd = (n) => Math.floor(Math.random() * n);
const TAU = Math.PI * 2;

export function mountDoorSnake(door) {
  if (!door || !door.isConnected || door.querySelector(".door-snake")) return () => {};
  const W = window, D = document;
  const RM = W.matchMedia("(prefers-reduced-motion: reduce)");
  const cv = D.createElement("canvas");
  cv.className = "door-snake";
  cv.setAttribute("aria-hidden", "true");
  const bg = door.querySelector("img, video");
  if (bg) bg.after(cv); else door.prepend(cv);
  const ctx = cv.getContext("2d");
  const text = door.querySelector("div");

  let raf = 0, last = 0, acc = 0, visible = false, running = false, dead = false;
  let w = 0, h = 0, dpr = 1, cell = 14, cols = 0, rows = 0, ok = null, noDot = null, grid = null;
  let body = [], dir = [0, -1], grow = 0, dots = [], pops = [], removed = null;
  let phase = "enter", born = 0, pauseUntil = 0, maxLen = 20, stepMs = 125;

  function layout() {
    const r = cv.getBoundingClientRect();
    if (!r.width || !r.height) return false;
    dpr = Math.min(2, W.devicePixelRatio || 1);
    w = r.width; h = r.height;
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    cell = Math.max(10, Math.min(16, Math.round(w / 30)));
    stepMs = w < 500 ? 140 : 120;
    maxLen = Math.max(12, Math.min(26, Math.round((w * h) / (cell * cell) / 12)));
    cols = Math.floor(w / cell); rows = Math.floor(h / cell);
    const ox = (w - cols * cell) / 2, oy = (h - rows * cell) / 2;
    cv._ox = ox; cv._oy = oy;
    const tr = text && text.getBoundingClientRect();
    ok = []; noDot = [];
    for (let x = 0; x < cols; x++) {
      ok[x] = []; noDot[x] = [];
      for (let y = 0; y < rows; y++) {
        ok[x][y] = x >= 1 && x < cols - 1 && y >= 1 && y < rows - 1;
        const ax = r.left + ox + (x + 0.5) * cell, ay = r.top + oy + (y + 0.5) * cell;
        // no dots on the edge cells or behind the title and subtitle
        noDot[x][y] = !(x >= 2 && x < cols - 2 && y >= 2 && y < rows - 2) ||
          !!(tr && ax > tr.left - cell && ax < tr.right + cell && ay > tr.top - cell * 1.5 && ay < tr.bottom + cell);
      }
    }
    // faint retro dot grid, drawn once per layout
    grid = D.createElement("canvas"); grid.width = cv.width; grid.height = cv.height;
    const g = grid.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.fillStyle = "rgba(142,233,255,0.10)";
    for (let x = 0; x < cols; x++) for (let y = 0; y < rows; y++) if (ok[x][y]) g.fillRect(ox + (x + 0.5) * cell - 0.75, oy + (y + 0.5) * cell - 0.75, 1.5, 1.5);
    return true;
  }
  const free = (x, y) => !!(ok[x] && ok[x][y]) && !body.slice(0, -1).some((b) => b[0] === x && b[1] === y);
  function spawnDot() {
    for (let t = 0; t < 300; t++) {
      const x = rnd(cols), y = rnd(rows);
      if (noDot[x] && !noDot[x][y] && free(x, y) && !dots.some((d) => d[0] === x && d[1] === y)) { dots.push([x, y]); return; }
    }
  }
  function reset(now) {
    // come in small from below, somewhere in the right two thirds (away from the text)
    const x = Math.floor(cols / 3) + rnd(Math.max(1, Math.floor((cols * 2) / 3) - 2));
    body = [[x, rows], [x, rows + 1], [x, rows + 2]]; dir = [0, -1]; grow = 0; removed = null;
    phase = "enter"; born = now; dots = []; pops = [];
    const want = w < 500 ? 2 : 3;
    for (let i = 0; i < want; i++) spawnDot();
  }
  function step(now) {
    const hd = body[0];
    if (phase === "enter" && ok[hd[0]] && ok[hd[0]][hd[1]] && hd[1] < rows - 2) phase = "play";
    if (phase === "play" && (body.length >= maxLen || now - born > 60000)) phase = "exit";
    const opts = [[dir[0], dir[1]], [dir[1], -dir[0]], [-dir[1], dir[0]]];
    let best = null, bs = 1e9, tgt = null;
    if (phase === "exit") tgt = [hd[0], rows + 4];
    else if (phase === "enter") tgt = [hd[0], rows - 4];
    else if (dots.length) { let bd = 1e9; for (const d of dots) { const dd = Math.abs(d[0] - hd[0]) + Math.abs(d[1] - hd[1]); if (dd < bd) { bd = dd; tgt = d; } } }
    for (let i = 0; i < 3; i++) {
      const nx = hd[0] + opts[i][0], ny = hd[1] + opts[i][1];
      let safe = phase === "play" ? free(nx, ny) : !body.slice(0, -1).some((b) => b[0] === nx && b[1] === ny);
      if (phase !== "play" && (nx < 0 || nx >= cols)) safe = false;
      if (phase === "exit" && ny < hd[1]) safe = safe && free(nx, ny);
      if (!safe) continue;
      let sc = tgt ? Math.abs(tgt[0] - nx) + Math.abs(tgt[1] - ny) : 0;
      sc += Math.random() * (phase === "play" ? 2.2 : 0.3) + (i ? 0.35 : 0); // wander, slight preference for straight on
      if (sc < bs) { bs = sc; best = opts[i]; }
    }
    if (!best) { phase = "exit"; best = [0, 1]; }
    dir = best;
    body.unshift([hd[0] + dir[0], hd[1] + dir[1]]);
    for (let k = 0; k < dots.length; k++) if (dots[k][0] === body[0][0] && dots[k][1] === body[0][1]) {
      pops.push({ x: dots[k][0], y: dots[k][1], t: now }); dots.splice(k, 1); grow++; if (phase === "play") spawnDot(); break;
    }
    if (grow > 0) { grow--; removed = null; } else removed = body.pop();
    if (phase === "exit" && body.every((b) => b[1] >= rows)) { phase = "gone"; pauseUntil = now + 1600; }
  }
  const c = (p) => [cv._ox + (p[0] + 0.5) * cell, cv._oy + (p[1] + 0.5) * cell];
  function draw(f, now) {
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height);
    if (grid) ctx.drawImage(grid, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    dots.forEach((d, i) => { // warm orange dots with a soft halo
      const p = c(d), pulse = 0.5 + 0.5 * Math.sin(now / 420 + i * 1.7);
      ctx.fillStyle = `rgba(255,154,60,${0.16 + 0.1 * pulse})`; ctx.beginPath(); ctx.arc(p[0], p[1], cell * 0.62, 0, TAU); ctx.fill();
      ctx.fillStyle = "#ffb15e"; ctx.beginPath(); ctx.arc(p[0], p[1], cell * 0.26, 0, TAU); ctx.fill();
    });
    pops = pops.filter((p) => now - p.t < 450);
    for (const p of pops) { const k = (now - p.t) / 450, q = c([p.x, p.y]); ctx.strokeStyle = `rgba(255,177,94,${(1 - k) * 0.8})`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(q[0], q[1], cell * (0.3 + k * 0.9), 0, TAU); ctx.stroke(); }
    if (phase === "gone" || !body.length) return;
    // body: a smooth line through the cell centres, head and tail eased between steps
    const pts = [], n = body.length, h0 = c(body[0]), h1 = c(body[1] || body[0]);
    pts.push([h1[0] + (h0[0] - h1[0]) * f, h1[1] + (h0[1] - h1[1]) * f]);
    for (let i = 1; i < n; i++) pts.push(c(body[i]));
    if (removed) { const t0 = c(removed), tl = c(body[n - 1]); pts.push([t0[0] + (tl[0] - t0[0]) * f, t0[1] + (tl[1] - t0[1]) * f]); }
    const hp = pts[0], tp = pts[pts.length - 1];
    const gr = ctx.createLinearGradient(hp[0], hp[1], tp[0], tp[1]);
    gr.addColorStop(0, "#8ee9ff"); gr.addColorStop(1, "#c4a6ff");
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    const path = () => { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let j = 1; j < pts.length; j++) ctx.lineTo(pts[j][0], pts[j][1]); };
    path(); ctx.strokeStyle = "rgba(142,233,255,0.16)"; ctx.lineWidth = cell * 1.05; ctx.stroke(); // soft glow
    path(); ctx.strokeStyle = gr; ctx.lineWidth = cell * 0.62; ctx.stroke();
    ctx.fillStyle = "#b9f3ff"; ctx.beginPath(); ctx.arc(hp[0], hp[1], cell * 0.38, 0, TAU); ctx.fill(); // head
    const ex = dir[1] * cell * 0.15, ey = -dir[0] * cell * 0.15, fx = dir[0] * cell * 0.12, fy = dir[1] * cell * 0.12, er = Math.max(1, cell * 0.075);
    ctx.fillStyle = "#0b1426";
    ctx.beginPath(); ctx.arc(hp[0] + ex + fx, hp[1] + ey + fy, er, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(hp[0] - ex + fx, hp[1] - ey + fy, er, 0, TAU); ctx.fill();
  }
  function frame(now) {
    raf = 0;
    if (!running) return;
    if (!cv.isConnected) { destroy(); return; }
    const dt = last ? Math.min(250, now - last) : 16; last = now;
    if (phase === "gone") { if (now >= pauseUntil) reset(now); }
    else { acc += dt; while (acc >= stepMs) { acc -= stepMs; step(now); if (phase === "gone") { acc = 0; break; } } }
    draw(Math.min(1, acc / stepMs), now);
    raf = requestAnimationFrame(frame);
  }
  function staticFrame() { // reduced motion: one calm frame, a short curl heading for a dot
    if (!layout()) return;
    const cx = Math.floor(cols * 0.62), cy = Math.floor(rows * 0.4);
    body = [[3, 0], [2, 0], [1, 0], [0, 0], [-1, 0], [-1, 1], [-2, 1], [-3, 1], [-4, 1], [-4, 0], [-5, 0]].map((o) => [cx + o[0] - 2, cy + o[1]]);
    dir = [1, 0]; removed = null; phase = "play"; pops = [];
    dots = [[cx + 4, cy], [cx - 6, cy - 3]].filter((d) => ok[d[0]] && ok[d[0]][d[1]]);
    draw(1, 0);
  }
  function start() {
    if (dead) return;
    if (RM.matches) { stop(); staticFrame(); return; }
    if (running || !visible || D.hidden) return;
    if (!w && !layout()) return;
    running = true; last = 0;
    if (!body.length) reset(performance.now());
    raf = requestAnimationFrame(frame);
  }
  function stop() { running = false; if (raf) cancelAnimationFrame(raf); raf = 0; }
  function relayout() { stop(); w = 0; body = []; if (layout()) { if (RM.matches) staticFrame(); else start(); } }

  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) start(); else stop(); });
  io.observe(cv);
  let rt = 0;
  const ro = "ResizeObserver" in W ? new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(relayout, 120); }) : null;
  ro?.observe(cv);
  const onVis = () => (D.hidden ? stop() : start());
  D.addEventListener("visibilitychange", onVis);
  const onRM = () => relayout();
  RM.addEventListener?.("change", onRM);
  if (RM.matches) staticFrame();

  function destroy() {
    dead = true; stop(); io.disconnect(); ro?.disconnect(); clearTimeout(rt);
    D.removeEventListener("visibilitychange", onVis); RM.removeEventListener?.("change", onRM);
    cv.remove();
  }
  W.__psDoorSnake = { state: () => ({ phase, len: body.length, dots: dots.length, running, visible, cell, cols, rows }) };
  return destroy;
}
