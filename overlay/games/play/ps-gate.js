/* Username gate + Start before any play. Persists name in localStorage. */
(function () {
  var NAME_KEY = "ps_player_name";
  var started = false;

  function clean(v) {
    return String(v || "").replace(/\s+/g, " ").trim().slice(0, 16);
  }
  function getName() {
    try { return clean(localStorage.getItem(NAME_KEY) || ""); } catch (e) { return ""; }
  }
  function setName(v) {
    v = clean(v);
    try { localStorage.setItem(NAME_KEY, v); } catch (e) {}
    try {
      if (parent && parent !== window) parent.postMessage({ type: "ps-name", name: v }, location.origin);
    } catch (e) {}
    return v;
  }

  var style = document.createElement("style");
  style.textContent =
    "#ps-gate{position:absolute;inset:0;z-index:40;display:grid;place-items:center;background:rgba(8,10,16,.72);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);font-family:system-ui,sans-serif;color:#f4f1ff}" +
    "#ps-gate[hidden]{display:none!important}" +
    "#ps-gate .ps-gate-card{background:#16182a;border:1px solid rgba(196,166,255,.42);border-radius:18px;padding:1.15rem 1.25rem 1.2rem;width:min(20.5rem,calc(100% - 2rem));text-align:center;box-shadow:0 18px 48px rgba(0,0,0,.35)}" +
    "#ps-gate h2{margin:0 0 .35rem;font-size:1.15rem;font-weight:750;letter-spacing:-.01em}" +
    "#ps-gate p{margin:0 0 .85rem;color:#c8c3d8;font-size:.9rem;line-height:1.35}" +
    "#ps-gate label{display:grid;gap:.3rem;text-align:left;font-size:.78rem;color:#a8a3b8;margin-bottom:.75rem}" +
    "#ps-gate input{font:inherit;color:#f4f1ff;background:#0e101c;border:1px solid rgba(244,241,255,.18);border-radius:12px;min-height:44px;padding:.45rem .75rem}" +
    "#ps-gate input:focus{outline:2px solid #8ee9ff;outline-offset:1px}" +
    "#ps-gate .ps-gate-err{color:#ffb4a8;font-size:.82rem;margin:-.35rem 0 .65rem;min-height:1.1em}" +
    "#ps-gate .ps-gate-actions{display:flex;flex-direction:column;gap:.55rem}" +
    "#ps-gate button{font:inherit;border:0;border-radius:999px;padding:.65rem 1.1rem;font-weight:800;min-height:46px;cursor:pointer}" +
    "#ps-gate #ps-gate-save{background:#d7c6ff;color:#1a1030}" +
    "#ps-gate #ps-gate-start{background:#8ee9ff;color:#0c1520}" +
    "#ps-gate #ps-gate-start[hidden],#ps-gate #ps-gate-save[hidden],#ps-gate .ps-gate-name-wrap[hidden]{display:none!important}" +
    "#ps-gate .ps-gate-who{display:flex;align-items:center;justify-content:center;gap:.45rem;flex-wrap:wrap;margin:0 0 .75rem;font-size:.92rem;color:#b7ecff}" +
    "#ps-gate .ps-gate-who[hidden]{display:none!important}" +
    "#ps-gate .ps-gate-who strong{color:#f4f1ff;font-weight:750;background:rgba(142,233,255,.1);border:1px solid rgba(142,233,255,.32);border-radius:999px;padding:.08rem .6rem;max-width:11rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
    "#ps-gate #ps-gate-change{font-size:.76rem;font-weight:700;min-height:30px;padding:.2rem .7rem;background:transparent;color:#d7c6ff;border:1px solid rgba(196,166,255,.45)}" +
    "#ps-gate #ps-gate-change:hover{background:rgba(196,166,255,.14);color:#fff}" +
    "#ps-gate button[disabled]{opacity:.65;cursor:progress}" +
    /* Stopwatch graphic for countdown timers */
    ".ps-stopwatch{display:inline-flex;align-items:center;justify-content:center;pointer-events:none;margin-left:.35rem}" +
    ".ps-sw-body{position:relative;width:54px;height:54px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff8e8,#e8d4a8 55%,#b8965a);box-shadow:inset 0 1px 0 rgba(255,255,255,.55),0 2px 8px rgba(0,0,0,.35);border:2px solid rgba(255,255,255,.35)}" +
    ".ps-sw-body::before{content:\"\";position:absolute;top:-7px;left:50%;width:10px;height:8px;margin-left:-5px;border-radius:3px 3px 2px 2px;background:#d7c49a;box-shadow:0 -2px 0 #c4ae7a}" +
    ".ps-sw-body::after{content:\"\";position:absolute;top:4px;right:6px;width:6px;height:6px;border-radius:50%;background:#8ee9ff;box-shadow:0 0 6px #8ee9ff}" +
    ".ps-sw-face{position:absolute;inset:7px;border-radius:50%;background:radial-gradient(circle at 50% 40%,#1a2230,#0c121c);display:grid;place-items:center;box-shadow:inset 0 0 0 1.5px rgba(255,255,255,.12)}" +
    ".ps-sw-digits{font-variant-numeric:tabular-nums;font-weight:800;font-size:11px;letter-spacing:.02em;color:#f6efe4;text-shadow:0 1px 2px #000;line-height:1}" +
    "#hud{box-sizing:border-box}" +
    "body.ps-has-timer #hud{top:16px!important;left:18px!important;right:18px!important;padding-right:4px}";
  document.head.appendChild(style);

  var gate = document.createElement("div");
  gate.id = "ps-gate";
  gate.innerHTML =
    '<div class="ps-gate-card">' +
      "<h2>High score name</h2>" +
      '<p id="ps-gate-sub">Enter a short name for the leaderboard, then press Start.</p>' +
      '<p class="ps-gate-who" id="ps-gate-who" hidden><span>Playing as</span><strong id="ps-gate-who-name"></strong><button type="button" id="ps-gate-change">Change</button></p>' +
      '<div class="ps-gate-name-wrap" id="ps-gate-name-wrap">' +
        '<label>Display name<input id="ps-gate-input" maxlength="16" autocomplete="nickname" placeholder="Initials or a short name"/></label>' +
        '<div class="ps-gate-err" id="ps-gate-err"></div>' +
      "</div>" +
      '<div class="ps-gate-actions">' +
        '<button type="button" id="ps-gate-save">Continue</button>' +
        '<button type="button" id="ps-gate-start" hidden>Start</button>' +
      "</div>" +
    "</div>";
  document.body.appendChild(gate);

  var input = document.getElementById("ps-gate-input");
  var err = document.getElementById("ps-gate-err");
  var who = document.getElementById("ps-gate-who");
  var wrap = document.getElementById("ps-gate-name-wrap");
  var saveBtn = document.getElementById("ps-gate-save");
  var startBtn = document.getElementById("ps-gate-start");
  var whoName = document.getElementById("ps-gate-who-name");
  var sub = document.getElementById("ps-gate-sub");
  var mode = "name";

  function showStart(name) {
    mode = "start";
    wrap.hidden = true;
    saveBtn.hidden = true;
    who.hidden = false;
    whoName.textContent = name;
    sub.textContent = "Your score saves to this game's Top 10 automatically.";
    startBtn.hidden = false;
    startBtn.focus();
  }
  function showNameForm(prefill) {
    mode = "name";
    sub.textContent = prefill
      ? "Change your name — it updates on every score you've already set."
      : "Enter a short name for the leaderboard, then press Start.";
    wrap.hidden = false;
    saveBtn.hidden = false;
    who.hidden = true;
    startBtn.hidden = true;
    input.value = prefill || "";
    err.textContent = "";
    setTimeout(function () { try { input.focus(); } catch (e) {} }, 30);
  }

  var existing = getName();
  if (existing) showStart(existing);
  else showNameForm("");

  var saving = false;
  saveBtn.addEventListener("click", function () {
    if (saving) return;
    var v = clean(input.value);
    if (!v) {
      err.textContent = "Add a name to save high scores.";
      input.focus();
      return;
    }
    if (!window.psPlayer) { setName(v); showStart(v); return; }
    if (!window.psPlayer.valid(v)) { err.textContent = "Letters, numbers, spaces and - _ . ' only."; input.focus(); return; }
    // Server-checked: creates this browser's player, or renames it (every score follows).
    saving = true;
    saveBtn.disabled = true;
    saveBtn.textContent = "Checking name…";
    err.textContent = "";
    window.psPlayer.setName(v).then(function (r) {
      saving = false;
      saveBtn.disabled = false;
      saveBtn.textContent = "Continue";
      if (!r || !r.ok) { err.textContent = (r && r.error) || "That name isn't allowed — try another."; try { input.focus(); input.select(); } catch (e) {} return; }
      showStart(r.name);
    });
  });
  document.getElementById("ps-gate-change").addEventListener("click", function () { showNameForm(getName()); });
  window.addEventListener("ps:name", function (e) {
    var n = clean(e.detail && e.detail.name);
    if (n && mode === "start") whoName.textContent = n;
  });
  input.addEventListener("keydown", function (e) {
    e.stopPropagation();
    if (e.key === "Enter") { e.preventDefault(); saveBtn.click(); }
  });
  input.addEventListener("keyup", function (e) { e.stopPropagation(); });

  function begin() {
    if (started) return;
    var n = getName();
    if (!n) { showNameForm(""); return; }
    started = true;
    gate.hidden = true;
    try {
      if (typeof window.psBeginGame === "function") window.psBeginGame();
    } catch (e) {}
  }
  startBtn.addEventListener("click", begin);

  // Hide courier's native start sheet — gate replaces it.
  var nativeStart = document.getElementById("start");
  if (nativeStart) nativeStart.style.display = "none";

  // Upgrade countdown timer nodes into stopwatch graphics.
  function wrapTimer(el) {
    if (!el || el.classList.contains("ps-stopwatch")) return;
    document.body.classList.add("ps-has-timer");
    var digits = document.createElement("span");
    digits.className = "ps-sw-digits";
    digits.textContent = el.textContent || "";
    var face = document.createElement("span");
    face.className = "ps-sw-face";
    face.appendChild(digits);
    var body = document.createElement("span");
    body.className = "ps-sw-body";
    body.appendChild(face);
    el.classList.add("ps-stopwatch");
    el.textContent = "";
    el.appendChild(body);
    var desc = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "textContent") ||
               Object.getOwnPropertyDescriptor(Node.prototype, "textContent");
    Object.defineProperty(el, "textContent", {
      configurable: true,
      get: function () { return digits.textContent; },
      set: function (v) { digits.textContent = v == null ? "" : String(v); }
    });
    // Also proxy common innerHTML writes used by some games
    Object.defineProperty(el, "innerHTML", {
      configurable: true,
      get: function () { return digits.textContent; },
      set: function (v) {
        var tmp = document.createElement("div");
        tmp.innerHTML = v == null ? "" : String(v);
        digits.textContent = tmp.textContent || "";
      }
    });
  }
  wrapTimer(document.getElementById("time"));
  wrapTimer(document.getElementById("clock"));

  window.psGate = {
    getName: getName,
    setName: setName,
    reopen: function () {
      started = false;
      gate.hidden = false;
      var n = getName();
      if (n) showStart(n);
      else showNameForm("");
    }
  };
})();
