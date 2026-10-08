/* PromptShare games: scores + player identity.
 *
 * - psReport(slug, score) posts a finished run to /api/games/:slug/scores under this browser's
 *   player (created on first name entry via /api/games/players; {playerId, playerToken} in
 *   localStorage). Renaming (psPlayer.setName / the Change dialog) updates every score that
 *   player owns. Identity lives in this browser only; another device gets its own player.
 * - Names are checked on the server (word filter + AI). Errors come back as a friendly message.
 * - Also loaded by /games/plate.js on plate pages for the "Playing as NAME · Change" control.
 */
(function () {
  if (window.psPlayer) return;
  var NAME_KEY = "ps_player_name", ID_KEY = "ps_player_id", TOKEN_KEY = "ps_player_token";
  var BLOCKED_MSG = "That name isn't allowed — try another.";
  var OFFLINE_MSG = "Couldn't reach the leaderboard — try again in a moment.";
  var NAME_RE = /^[\p{L}\p{N} _.\-']{1,16}$/u;
  var sent = false;

  function lsGet(k) { try { return localStorage.getItem(k) || ""; } catch (e) { return ""; } }
  function lsSet(k, v) { try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch (e) {} }
  function clean(v) { return String(v || "").replace(/\s+/g, " ").trim().slice(0, 16); }
  function getName() { return clean(lsGet(NAME_KEY)); }
  function playerId() { return lsGet(ID_KEY); }
  function playerToken() { return lsGet(TOKEN_KEY); }
  function hasPlayer() { return !!(playerId() && playerToken()); }
  function clearPlayer() { lsSet(ID_KEY, ""); lsSet(TOKEN_KEY, ""); }
  function validName(v) { return NAME_RE.test(v) && /[\p{L}\p{N}]/u.test(v); }

  function postJson(url, body) {
    var ctrl = typeof AbortController === "function" ? new AbortController() : null;
    var t = setTimeout(function () { if (ctrl) ctrl.abort(); }, 6000);
    return fetch(url, {
      method: "POST", credentials: "same-origin", cache: "no-store",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(body), signal: ctrl ? ctrl.signal : undefined
    }).then(function (res) {
      clearTimeout(t);
      return res.json().catch(function () { return {}; }).then(function (d) {
        return { status: res.status, ok: res.ok && d && d.ok !== false, data: d || {} };
      });
    }, function (e) { clearTimeout(t); throw e; });
  }
  function applyName(n) {
    var old = getName();
    lsSet(NAME_KEY, n);
    try { window.dispatchEvent(new CustomEvent("ps:name", { detail: { name: n, previous: old } })); } catch (e) {}
    try { if (parent && parent !== window) parent.postMessage({ type: "ps-name", name: n }, location.origin); } catch (e) {}
    return n;
  }
  function register(name) {
    var previous = getName();
    return postJson("/api/games/players", { name: name, previousName: previous }).then(function (r) {
      if (r.ok && r.data.playerId) {
        lsSet(ID_KEY, r.data.playerId); lsSet(TOKEN_KEY, r.data.playerToken);
        return { ok: true, name: applyName(r.data.name), claimed: r.data.claimed || 0 };
      }
      if (r.status === 404 || r.status >= 500) return { ok: true, name: applyName(name), offline: true };
      return { ok: false, error: r.data.message || BLOCKED_MSG };
    }, function () { return { ok: true, name: applyName(name), offline: true }; });
  }
  function rename(name) {
    if (!hasPlayer()) return register(name);
    return postJson("/api/games/players/rename", { playerId: playerId(), playerToken: playerToken(), name: name }).then(function (r) {
      if (r.ok) return { ok: true, name: applyName(r.data.name) };
      if (r.status === 401) { clearPlayer(); return register(name); }
      if (r.status >= 500) return { ok: false, error: OFFLINE_MSG };
      return { ok: false, error: r.data.message || BLOCKED_MSG };
    }, function () { return { ok: false, error: OFFLINE_MSG }; });
  }
  function setName(name) {
    name = clean(name);
    if (!validName(name)) return Promise.resolve({ ok: false, error: "Use 1–16 letters, numbers, spaces or - _ . '" });
    return hasPlayer() ? rename(name) : register(name);
  }
  function ensure() {
    if (hasPlayer()) return Promise.resolve(true);
    var n = getName();
    if (!n || !validName(n)) return Promise.resolve(false);
    return register(n).then(function (r) { return !!(r.ok && hasPlayer()); });
  }
  function sync() {
    if (!hasPlayer()) return;
    try {
      var last = Number(sessionStorage.getItem("ps_player_sync") || 0);
      if (Date.now() - last < 5 * 60 * 1000) return;
      sessionStorage.setItem("ps_player_sync", String(Date.now()));
    } catch (e) {}
    postJson("/api/games/players/me", { playerId: playerId(), playerToken: playerToken() }).then(function (r) {
      if (r.status === 401) clearPlayer();
      else if (r.ok && r.data.name && r.data.name !== getName()) applyName(r.data.name);
    }, function () {});
  }
  window.addEventListener("storage", function (e) {
    if (e.key === NAME_KEY) { try { window.dispatchEvent(new CustomEvent("ps:name", { detail: { name: e.newValue || "" } })); } catch (x) {} }
  });

  /* ---------- styles (PromptShare games palette) ---------- */
  function css() {
    if (document.getElementById("ps-player-css")) return;
    var st = document.createElement("style");
    st.id = "ps-player-css";
    st.textContent =
      "#ps-rename{position:fixed;inset:0;z-index:90;display:grid;place-items:center;padding:14px;background:rgba(8,10,16,.72);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#f4f1ff}" +
      "#ps-rename[hidden]{display:none!important}" +
      "#ps-rename .ps-rn-card{width:min(21rem,100%);background:#16182a;border:1px solid rgba(196,166,255,.42);border-radius:18px;padding:1.1rem 1.2rem 1.05rem;box-shadow:0 18px 48px rgba(0,0,0,.35);text-align:left}" +
      "#ps-rename h2{margin:0 0 .3rem;font-size:1.12rem;font-weight:750;letter-spacing:-.01em}" +
      "#ps-rename p{margin:0 0 .8rem;color:#c8c3d8;font-size:.88rem;line-height:1.38}" +
      "#ps-rename label{display:grid;gap:.3rem;font-size:.78rem;color:#a8a3b8;margin-bottom:.45rem}" +
      "#ps-rename input{font:inherit;font-size:1rem;color:#f4f1ff;background:#0e101c;border:1px solid rgba(244,241,255,.18);border-radius:12px;min-height:44px;padding:.45rem .75rem}" +
      "#ps-rename input:focus{outline:2px solid #8ee9ff;outline-offset:1px}" +
      "#ps-rename .ps-rn-err{color:#ffb4a8;font-size:.82rem;min-height:1.15em;margin:0 0 .55rem}" +
      "#ps-rename .ps-rn-btns{display:flex;gap:.5rem}" +
      "#ps-rename button{flex:1;font:inherit;border:0;border-radius:999px;padding:.6rem 1rem;font-weight:800;min-height:44px;cursor:pointer}" +
      "#ps-rename button[disabled]{opacity:.6;cursor:progress}" +
      "#ps-rename .ps-rn-save{background:#8ee9ff;color:#0c1520}" +
      "#ps-rename .ps-rn-cancel{background:transparent;color:#d7c6ff;border:1px solid rgba(196,166,255,.42)}" +
      "#ps-rename .ps-rn-fine{margin:.7rem 0 0;font-size:.74rem;color:#8e89a2}" +
      ".ps-name-chip{display:flex;align-items:center;gap:.45rem;flex-wrap:wrap;font-size:.86rem;color:#c8c3d8}" +
      ".ps-name-chip strong{color:#f4f1ff;font-weight:750;background:rgba(142,233,255,.1);border:1px solid rgba(142,233,255,.32);border-radius:999px;padding:.08rem .55rem;max-width:11rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
      ".ps-name-change{font:inherit;font-size:.76rem;font-weight:700;border-radius:999px;padding:.2rem .65rem;min-height:28px;cursor:pointer;background:transparent;color:#d7c6ff;border:1px solid rgba(196,166,255,.45)}" +
      ".ps-name-change:hover{background:rgba(196,166,255,.14);color:#fff}.ps-name-change:focus-visible{outline:2px solid #8ee9ff;outline-offset:2px}" +
      "#ps-saved-chip{position:fixed;left:50%;bottom:14px;transform:translateX(-50%);z-index:45;display:flex;align-items:center;gap:.45rem;padding:.38rem .45rem .38rem .85rem;border-radius:999px;background:rgba(22,24,42,.94);border:1px solid rgba(196,166,255,.42);box-shadow:0 10px 30px rgba(0,0,0,.4);font:600 .84rem system-ui,sans-serif;color:#c8c3d8;white-space:nowrap}" +
      "#ps-saved-chip[hidden]{display:none!important}#ps-saved-chip b{color:#f4f1ff}";
    document.head.appendChild(st);
  }

  /* ---------- rename dialog ---------- */
  var dlg = null;
  function openRename(opts) {
    opts = opts || {};
    css();
    if (!dlg) {
      dlg = document.createElement("div");
      dlg.id = "ps-rename";
      dlg.setAttribute("role", "dialog");
      dlg.setAttribute("aria-modal", "true");
      dlg.setAttribute("aria-labelledby", "ps-rn-h");
      dlg.innerHTML = '<form class="ps-rn-card" novalidate><h2 id="ps-rn-h">Change your name</h2>' +
        '<p>Your new name replaces the old one on every score you’ve set from this browser.</p>' +
        '<label>Display name<input id="ps-rn-input" maxlength="16" autocomplete="nickname" spellcheck="false" placeholder="Initials or a short name"/></label>' +
        '<div class="ps-rn-err" id="ps-rn-err" role="alert"></div>' +
        '<div class="ps-rn-btns"><button type="button" class="ps-rn-cancel" id="ps-rn-cancel">Cancel</button><button type="submit" class="ps-rn-save" id="ps-rn-save">Save name</button></div>' +
        '<p class="ps-rn-fine">Names are checked automatically. Up to 5 changes a day.</p></form>';
      document.body.appendChild(dlg);
      ["keydown", "keyup", "keypress"].forEach(function (t) {
        dlg.addEventListener(t, function (e) { e.stopPropagation(); if (t === "keydown" && e.key === "Escape") close(); });
      });
      dlg.addEventListener("click", function (e) { if (e.target === dlg) close(); });
      dlg.querySelector("#ps-rn-cancel").addEventListener("click", close);
      dlg.querySelector("form").addEventListener("submit", function (e) {
        e.preventDefault();
        var input = dlg.querySelector("#ps-rn-input"), errEl = dlg.querySelector("#ps-rn-err"), save = dlg.querySelector("#ps-rn-save");
        save.disabled = true; save.textContent = "Checking…"; errEl.textContent = "";
        setName(input.value).then(function (r) {
          save.disabled = false; save.textContent = "Save name";
          if (!r.ok) { errEl.textContent = r.error || BLOCKED_MSG; input.focus(); input.select(); return; }
          var cb = dlg._onDone; close();
          if (typeof cb === "function") cb(r.name);
        });
      });
    }
    function close() { dlg.hidden = true; try { if (dlg._ret) dlg._ret.focus(); } catch (e) {} }
    dlg._onDone = opts.onDone;
    dlg._ret = document.activeElement;
    dlg.querySelector("#ps-rn-h").textContent = getName() ? "Change your name" : "Pick a display name";
    dlg.querySelector("#ps-rn-input").value = getName();
    dlg.querySelector("#ps-rn-err").textContent = "";
    dlg.hidden = false;
    setTimeout(function () { try { var i = dlg.querySelector("#ps-rn-input"); i.focus(); i.select(); } catch (e) {} }, 40);
  }
  function chip(el, label) {
    if (!el) return;
    css();
    var n = getName();
    el.classList.add("ps-name-chip");
    el.innerHTML = "";
    var s = document.createElement("span"); s.textContent = n ? (label || "Playing as") : "No display name yet"; el.appendChild(s);
    if (n) { var b = document.createElement("strong"); b.textContent = n; el.appendChild(b); }
    var c = document.createElement("button"); c.type = "button"; c.className = "ps-name-change"; c.textContent = n ? "Change" : "Set name";
    c.addEventListener("click", function () { openRename(); });
    el.appendChild(c);
  }

  /* ---------- "Score saved as NAME · Change" after a run (inside the game frame) ---------- */
  var savedChip = null;
  function showSaved(name) {
    css();
    if (!savedChip) {
      savedChip = document.createElement("div");
      savedChip.id = "ps-saved-chip";
      savedChip.setAttribute("aria-live", "polite");
      document.body.appendChild(savedChip);
    }
    chip(savedChip, "Score saved as");
    savedChip.hidden = false;
  }
  function hideSaved() { if (savedChip) savedChip.hidden = true; }
  window.addEventListener("ps:name", function () { if (savedChip && !savedChip.hidden) chip(savedChip, "Score saved as"); });

  function allowAgain(e) {
    var t = e.target;
    if (!t || !t.id) return;
    if (t.id === "again" || t.id === "begin" || t.id === "restart" || t.id === "ps-gate-start") { sent = false; hideSaved(); }
  }
  document.addEventListener("click", allowAgain, true);

  window.psReport = function (slug, score) {
    if (sent) return;
    var n = Math.round(Number(score) || 0);
    if (!isFinite(n)) n = 0;
    if (n < 0) n = 0;
    if (n > 1000000) n = 1000000;
    sent = true;
    function send() {
      var body = { score: n, name: getName() };
      if (hasPlayer()) { body.playerId = playerId(); body.playerToken = playerToken(); }
      return postJson("/api/games/" + encodeURIComponent(slug) + "/scores", body);
    }
    ensure()
      .then(send)
      .then(function (r) { if (r.status !== 401) return r; clearPlayer(); return ensure().then(send); })
      .then(function (r) {
        try { if (parent && parent !== window) parent.postMessage({ type: "ps-score", game: slug, score: n }, location.origin); } catch (e) {}
        if (r && r.ok && getName()) showSaved(getName());
      })
      .catch(function () {
        try { if (parent && parent !== window) parent.postMessage({ type: "ps-score", game: slug, score: n }, location.origin); } catch (e) {}
      });
  };

  window.psPlayer = {
    id: playerId, hasPlayer: hasPlayer, getName: getName, setName: setName, ensure: ensure,
    openRename: openRename, chip: chip, valid: validName
  };
  setTimeout(sync, 1200);
})();
