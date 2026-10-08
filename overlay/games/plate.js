(function () {
  document.querySelectorAll(".phrase").forEach(function (phrase) {
    var btn = phrase.querySelector(".phrase-btn");
    var tip = phrase.querySelector(".tip-card");
    if (!btn || !tip) return;
    function open() { tip.hidden = false; phrase.classList.add("is-open"); btn.setAttribute("aria-expanded", "true"); }
    function close() { tip.hidden = true; phrase.classList.remove("is-open"); btn.setAttribute("aria-expanded", "false"); }
    phrase.addEventListener("pointerenter", function (e) { if (!e.pointerType || e.pointerType === "mouse") open(); });
    phrase.addEventListener("pointerleave", function (e) { if (e.pointerType === "mouse") close(); });
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (tip.hidden) open(); else close();
    });
    btn.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        e.stopPropagation();
        if (tip.hidden) open(); else close();
      } else if (e.key === "Escape") { close(); }
    });
  });

  function applyFilter(f, push) {
    document.querySelectorAll("[data-filter]").forEach(function (b) {
      b.classList.toggle("is-on", b.getAttribute("data-filter") === f);
    });
    document.querySelectorAll("[data-diff]").forEach(function (el) {
      var hasFeaturedSec = !!document.querySelector('[data-sec="featured"]');
      var show = f === "featured" ? (hasFeaturedSec ? !!el.closest('[data-sec="featured"]') : true) : el.getAttribute("data-diff") === f;
      el.hidden = !show;
    });
    document.querySelectorAll("[data-sec]").forEach(function (sec) {
      sec.hidden = sec.getAttribute("data-sec") !== f;
    });
    if (push && window.history && window.history.replaceState) {
      var url = new URL(location.href);
      if (f === "featured") url.searchParams.delete("diff");
      else url.searchParams.set("diff", f);
      history.replaceState(null, "", url.pathname + url.search + url.hash);
    }
  }

  var gameSearch = document.getElementById("ps-game-search") || document.getElementById("ps-hdr-q"); /* hdr1: canonical bar input */
  if (gameSearch) {
    gameSearch.addEventListener("input", function () {
      var query = String(gameSearch.value || "").trim().toLowerCase();
      document.querySelectorAll("[data-diff]").forEach(function (card) {
        var haystack = (card.textContent || "").toLowerCase();
        card.hidden = !!query && haystack.indexOf(query) < 0;
      });
      document.querySelectorAll("[data-sec]").forEach(function (section) {
        var cards = section.querySelectorAll("[data-diff]");
        var any = Array.prototype.some.call(cards, function (card) { return !card.hidden; });
        section.hidden = !!query && !any;
      });
    });
  }

  document.querySelectorAll("[data-filter]").forEach(function (btn) {
    btn.addEventListener("click", function () { applyFilter(btn.getAttribute("data-filter"), true); });
  });

  var initial = new URLSearchParams(location.search).get("diff");
  if (initial !== "simple" && initial !== "mid" && initial !== "advanced") initial = "featured";
  applyFilter(initial, false);

  // "Playing as NAME · Change" in the Top 10 panel. Identity + rename dialog live in ps-score.js
  // (shared with the game frame); renaming updates every score this browser's player owns.
  var nameInput = document.getElementById("ps-name");
  var whoEl = null;
  if (nameInput) {
    var label = nameInput.closest("label") || nameInput;
    whoEl = document.createElement("div");
    whoEl.className = "ps-name ps-plate-who";
    label.parentNode.replaceChild(whoEl, label);
  }
  function paintWho() { if (whoEl && window.psPlayer) window.psPlayer.chip(whoEl); }
  function withPlayer(cb) {
    if (window.psPlayer) { cb(); return; }
    var sc = document.querySelector('script[data-ps-player]');
    if (!sc) {
      sc = document.createElement("script");
      sc.src = "/games/play/ps-score.js?v=20261007id1";
      sc.setAttribute("data-ps-player", "1");
      document.head.appendChild(sc);
    }
    sc.addEventListener("load", cb);
  }
  withPlayer(paintWho);
  var mineCss = document.createElement("style");
  mineCss.textContent = "#ps-board li.is-mine .nm{color:#2459e8;font-weight:750}" +
    ".ps-scores .ps-plate-who{margin-top:auto;padding-top:.85rem;border-top:1px solid rgba(36,36,34,.08);color:#5c5c56;font-size:.84rem}" +
    ".ps-scores .ps-plate-who strong{color:#242422;background:rgba(36,89,232,.07);border-color:rgba(36,89,232,.22)}" +
    ".ps-scores .ps-plate-who .ps-name-change{color:#2459e8;border-color:rgba(36,89,232,.32);background:#fff}" +
    ".ps-scores .ps-plate-who .ps-name-change:hover{background:rgba(36,89,232,.08);color:#1b46bd}" +
    ".ps-scores .ps-plate-who .ps-name-change:focus-visible{outline:2px solid #2459e8}";
  document.head.appendChild(mineCss);

  // A rename in the game frame or the dialog: repaint the chip and the board.
  window.addEventListener("message", function (ev) {
    if (ev.origin !== location.origin) return;
    var d = ev.data || {};
    if (d.type === "ps-name") { paintWho(); loadBoard(); }
  });
  window.addEventListener("ps:name", function () { paintWho(); loadBoard(); });


  var board = document.querySelector("[data-game]");
  function paintBoard(rows) {
    var list = document.getElementById("ps-board");
    var empty = document.getElementById("ps-score-empty");
    if (!list) return;
    list.innerHTML = "";
    var items = rows || [];
    if (empty) empty.hidden = items.length > 0;
    items.forEach(function (row, i) {
      var li = document.createElement("li");
      var rk = document.createElement("span");
      rk.className = "rk";
      rk.textContent = String(i + 1);
      var nm = document.createElement("span");
      nm.className = "nm";
      nm.textContent = row.name || "Guest";
      if (row.pid && window.psPlayer && row.pid === window.psPlayer.id()) li.classList.add("is-mine");
      var sc = document.createElement("span");
      sc.className = "sc";
      sc.textContent = String(row.score);
      li.appendChild(rk);
      li.appendChild(nm);
      li.appendChild(sc);
      list.appendChild(li);
    });
  }
  function loadBoard() {
    if (!board) return;
    var id = board.getAttribute("data-game");
    if (!id) return;
    fetch("/api/games/" + encodeURIComponent(id) + "/scores", { credentials: "same-origin", cache: "no-store" })
      .then(function (r) { return r.json(); })
      .then(function (data) { paintBoard((data && data.top) || []); })
      .catch(function () { paintBoard([]); });
  }
  loadBoard();
  window.addEventListener("message", function (ev) {
    if (ev.origin !== location.origin) return;
    var d = ev.data || {};
    if (d.type === "ps-score" && board && d.game === board.getAttribute("data-game")) loadBoard();
  });

  document.querySelectorAll(".ps-thumb-btn[data-ps-thumb-id]").forEach(function (btn) {
    var id = btn.getAttribute("data-ps-thumb-id");
    function paint(state) {
      var countEl = btn.querySelector(".ps-thumb-count");
      if (countEl) countEl.textContent = String(state.count || 0);
      btn.classList.toggle("is-on", !!state.thumbed);
      btn.setAttribute("aria-pressed", state.thumbed ? "true" : "false");
    }
    fetch("/api/thumbs?ids=" + encodeURIComponent(id), { credentials: "same-origin" })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var counts = (data && data.counts) || {};
        var voted = (data && data.voted) || {};
        paint({ count: Number(counts[id] || 0), thumbed: !!voted[id] });
      })
      .catch(function () {});
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (btn.disabled) return;
      btn.disabled = true;
      fetch("/api/thumbs/" + encodeURIComponent(id), {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: "{}",
      })
        .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
        .then(function (res) {
          if (res.ok && res.d) paint({ count: Number(res.d.count || 0), thumbed: !!res.d.thumbed });
        })
        .catch(function () {})
        .then(function () { btn.disabled = false; });
    });
  });
})();
