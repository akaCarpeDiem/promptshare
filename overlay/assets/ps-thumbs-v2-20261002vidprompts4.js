/* PromptShare — interactive thumbs-up (D1-backed). Removes author/date footers. */
(function () {
  var MARK = "data-ps-thumbs-v2";
  var CACHE = {}; // id -> { count, thumbed }
  var PENDING = {};
  var FETCH_TIMER = null;
  var QUEUE = {};
  var scanning = false;
  var scanTimer = null;

  function path() {
    return (location.pathname || "/").replace(/\/+$/, "") || "/";
  }

  function creationIdFromHref(href) {
    if (!href) return null;
    var m = String(href).match(/\/p\/([^/?#]+)/);
    return m ? decodeURIComponent(m[1]) : null;
  }

  function plateIdFromPath() {
    var m = path().match(/^\/p\/([^/]+)$/);
    return m ? decodeURIComponent(m[1]) : null;
  }

  function makeBtn(id) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ps-thumb-btn";
    btn.setAttribute("data-ps-thumb-id", id);
    btn.setAttribute("aria-label", "Thumbs up");
    btn.innerHTML =
      '<span class="ps-thumb-emoji" aria-hidden="true">👍</span>' +
      '<span class="ps-thumb-count">0</span>';
    btn.addEventListener("click", onThumbClick);
    paintBtn(btn, CACHE[id] || { count: 0, thumbed: false });
    return btn;
  }

  function paintBtn(btn, state) {
    if (!btn || !state) return;
    var countEl = btn.querySelector(".ps-thumb-count");
    if (countEl) countEl.textContent = String(state.count || 0);
    btn.classList.toggle("is-on", !!state.thumbed);
    btn.setAttribute("aria-pressed", state.thumbed ? "true" : "false");
    btn.title = state.thumbed ? "Remove thumbs up" : "Thumbs up";
  }

  function paintAll(id) {
    var state = CACHE[id] || { count: 0, thumbed: false };
    var esc = typeof CSS !== "undefined" && CSS.escape ? CSS.escape(id) : String(id).replace(/"/g, '\"');
    document.querySelectorAll('.ps-thumb-btn[data-ps-thumb-id="' + esc + '"]').forEach(function (btn) {
      paintBtn(btn, state);
    });
  }

  function scheduleFetch(id) {
    if (!id || CACHE[id]) return;
    QUEUE[id] = true;
    if (FETCH_TIMER) return;
    FETCH_TIMER = setTimeout(flushFetch, 40);
  }

  function flushFetch() {
    FETCH_TIMER = null;
    var ids = Object.keys(QUEUE);
    QUEUE = {};
    var need = ids.filter(function (id) {
      return !CACHE[id] && !PENDING[id];
    });
    if (!need.length) return;
    need.forEach(function (id) {
      PENDING[id] = true;
    });
    // chunk ≤60
    var chunks = [];
    for (var i = 0; i < need.length; i += 60) chunks.push(need.slice(i, i + 60));
    chunks.forEach(function (chunk) {
      fetch("/api/thumbs?ids=" + encodeURIComponent(chunk.join(",")), {
        credentials: "same-origin",
      })
        .then(function (r) {
          return r.json();
        })
        .then(function (data) {
          var counts = (data && data.counts) || {};
          var voted = (data && data.voted) || {};
          chunk.forEach(function (id) {
            CACHE[id] = {
              count: Number(counts[id] || 0),
              thumbed: !!voted[id],
            };
            delete PENDING[id];
            paintAll(id);
          });
        })
        .catch(function () {
          chunk.forEach(function (id) {
            delete PENDING[id];
            if (!CACHE[id]) CACHE[id] = { count: 0, thumbed: false };
            paintAll(id);
          });
        });
    });
  }

  function onThumbClick(ev) {
    ev.preventDefault();
    ev.stopPropagation();
    var btn = ev.currentTarget;
    var id = btn.getAttribute("data-ps-thumb-id");
    if (!id || btn.disabled) return;
    btn.disabled = true;
    var prev = CACHE[id] || { count: 0, thumbed: false };
    // optimistic
    var next = {
      thumbed: !prev.thumbed,
      count: Math.max(0, (prev.count || 0) + (prev.thumbed ? -1 : 1)),
    };
    CACHE[id] = next;
    paintAll(id);
    fetch("/api/thumbs/" + encodeURIComponent(id), {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: "{}",
    })
      .then(function (r) {
        return r.json().then(function (d) {
          return { ok: r.ok, d: d };
        });
      })
      .then(function (res) {
        if (res.ok && res.d) {
          CACHE[id] = {
            count: Number(res.d.count || 0),
            thumbed: !!res.d.thumbed,
          };
        } else {
          CACHE[id] = prev;
        }
        paintAll(id);
      })
      .catch(function () {
        CACHE[id] = prev;
        paintAll(id);
      })
      .finally(function () {
        btn.disabled = false;
      });
  }

  function cardButton(card, id) {
    var btn = card && card.querySelector(".ps-thumb-btn");
    if (btn && btn.getAttribute("data-ps-thumb-id") !== id) {
      btn.remove();
      btn = null;
    }
    return btn || makeBtn(id);
  }

  function hoistCardTitle(card) {
    if (!card) return;
    var row = card.querySelector(".card-row, .ps-grow");
    if (!row) return;
    var title = row.querySelector(":scope > h3, :scope > h2");
    if (!title) return;
    // Move title to its own full-width line directly under the chip row.
    if (title.parentElement === row) {
      row.insertAdjacentElement("afterend", title);
    }
  }

  function placeCardThumb(card, id) {
    if (!card) return;
    hoistCardTitle(card);
    var row = card.querySelector(".card-row, .ps-grow");
    var chip = row && row.querySelector(".model-chip, .diff");
    var by = card.querySelector(".card-by");
    var btn = cardButton(card, id);
    var previousParent = btn.parentElement;

    // Title row, immediately to the right of the model / difficulty chip.
    if (row && chip) {
      if (btn.parentElement !== row || btn.previousElementSibling !== chip) {
        chip.insertAdjacentElement("afterend", btn);
      }
      row.classList.add("ps-thumb-row-target");
      if (by && (by.childNodes.length || !by.hidden)) {
        by.textContent = "";
        by.hidden = true;
      }
      if (previousParent && previousParent !== row && previousParent.classList.contains("ps-thumb-row") && !previousParent.children.length) {
        previousParent.remove();
      }
    } else if (row) {
      row.appendChild(btn);
      row.classList.add("ps-thumb-row-target");
    } else if (by) {
      by.hidden = false;
      by.appendChild(btn);
    } else {
      var body = card.querySelector(".card-body, .ps-videos-card-body, .ps-ia-card-body") || card;
      by = document.createElement("p");
      by.className = "card-by";
      body.appendChild(by);
      by.appendChild(btn);
    }
    scheduleFetch(id);
  }

  function wireSpaCards(root) {
    (root || document).querySelectorAll("a.card[href*='/p/']").forEach(function (card) {
      var id = creationIdFromHref(card.getAttribute("href"));
      if (id) placeCardThumb(card, id);
    });
  }

  function wireHomeCards(root) {
    (root || document).querySelectorAll("a.ps-home-card[href*='/p/']").forEach(function (card) {
      var id = creationIdFromHref(card.getAttribute("href"));
      if (id) placeCardThumb(card, id);
    });
  }


  function wireIaCards(root) {
    (root || document).querySelectorAll("a.ps-ia-featured-card[href*='/p/']").forEach(function (card) {
      var id = creationIdFromHref(card.getAttribute("href"));
      if (id) placeCardThumb(card, id);
    });
  }

  function wireVideoCards(root) {
    (root || document).querySelectorAll("a.ps-videos-card[href*='/p/']").forEach(function (card) {
      var id = creationIdFromHref(card.getAttribute("href"));
      if (id) placeCardThumb(card, id);
    });
  }

  function hideAuthLikeButtons(root) {
    (root || document).querySelectorAll(".creation-actions button.btn, .creation-actions .btn").forEach(function (btn) {
      if (btn.classList.contains("ps-thumb-btn")) return;
      var t = (btn.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
      if (/^(liked|like)\b/.test(t) || /^save\b/.test(t) || /^saved\b/.test(t)) {
        btn.setAttribute("hidden", "true");
        btn.style.display = "none";
      }
    });
  }

  function placeBesideChip(page, btn) {
    var chip = page.querySelector(".creation-head .model-chip") || page.querySelector(".model-chip");
    if (chip) {
      if (btn.parentElement !== chip.parentElement || btn.previousElementSibling !== chip) {
        chip.insertAdjacentElement("afterend", btn);
      }
      return true;
    }
    var head = page.querySelector(".creation-head");
    if (head) {
      head.appendChild(btn);
      return true;
    }
    return false;
  }

  function wirePlate() {
    var id = plateIdFromPath();
    if (!id) return;
    var page = document.querySelector(".net-page.creation");
    if (!page) return;
    hideAuthLikeButtons(page);

    var existing = page.querySelector('.ps-thumb-btn[data-ps-thumb-id="' + id + '"]');
    var btn = existing || makeBtn(id);
    var slot = btn.closest && btn.closest(".ps-thumb-plate-slot");
    if (!placeBesideChip(page, btn)) {
      var actions = page.querySelector(".creation-actions");
      if (actions) actions.insertBefore(btn, actions.firstChild);
      else page.appendChild(btn);
    }
    if (slot && slot !== btn && !slot.querySelector(".ps-thumb-btn")) slot.remove();
    page.querySelectorAll(".stage > .ps-thumb-plate-slot").forEach(function (el) {
      if (!el.querySelector(".ps-thumb-btn")) el.remove();
    });
    scheduleFetch(id);
  }

  function scan() {
    wireSpaCards(document);
    wireHomeCards(document);
    wireIaCards(document);
    wireVideoCards(document);
    wirePlate();
  }

  window.psThumbsRescan = function () {
    if (document.documentElement.dataset.psMuteObs === "1") return;
    scanning = true;
    try { scan(); } finally { scanning = false; }
  };

  function scheduleScan() {
    if (document.documentElement.dataset.psMuteObs === "1") {
      // Cards often paint while muted; retry once mute clears.
      clearTimeout(scanTimer);
      scanTimer = setTimeout(scheduleScan, 120);
      return;
    }
    if (scanning) return;
    clearTimeout(scanTimer);
    scanTimer = setTimeout(function () {
      scanning = true;
      try { scan(); } finally { scanning = false; }
    }, 100);
  }

  function boot() {
    if (document.documentElement.getAttribute(MARK)) {
      scan();
      [0, 150, 400, 1000, 2000].forEach(function (ms) { setTimeout(scan, ms); });
      return;
    }
    document.documentElement.setAttribute(MARK, "1");
    scan();
    // Category/SPA grids often paint after first scan — catch them.
    [0, 150, 400, 1000, 2000].forEach(function (ms) { setTimeout(scan, ms); });
    var root = document.getElementById("root") || document.body;
    if (!root || root.__psThumbsObs) return;
    var obs = new MutationObserver(function () {
      scheduleScan();
    });
    obs.observe(root, { childList: true, subtree: true });
    root.__psThumbsObs = obs;
    window.addEventListener("popstate", function () {
      setTimeout(scan, 30);
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
