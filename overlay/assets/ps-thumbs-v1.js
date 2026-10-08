/* PromptShare — interactive thumbs-up (D1-backed). Removes author/date footers. */
(function () {
  var MARK = "data-ps-thumbs-v1";
  var CACHE = {}; // id -> { count, thumbed }
  var PENDING = {};
  var FETCH_TIMER = null;
  var QUEUE = {};

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

  function scrubCardBy(el, id) {
    if (!el) return;
    if (el.querySelector(".ps-thumb-btn")) {
      scheduleFetch(id);
      return;
    }
    el.setAttribute("data-ps-thumb-wired", "1");
    // Remove author/date/zero chrome; keep only thumbs
    el.innerHTML = "";
    el.appendChild(makeBtn(id));
    scheduleFetch(id);
  }

  function wireSpaCards(root) {
    (root || document).querySelectorAll("a.card[href*='/p/']").forEach(function (card) {
      var id = creationIdFromHref(card.getAttribute("href"));
      if (!id) return;
      var by = card.querySelector(".card-by");
      if (!by) {
        // Some cards may omit card-by — create footer
        var body = card.querySelector(".card-body") || card;
        by = document.createElement("p");
        by.className = "card-by";
        body.appendChild(by);
      }
      scrubCardBy(by, id);
    });
  }

  function wireHomeCards(root) {
    (root || document).querySelectorAll("a.ps-home-card[href*='/p/']").forEach(function (card) {
      var id = creationIdFromHref(card.getAttribute("href"));
      if (!id) return;
      var by = card.querySelector(".card-by");
      if (!by) {
        var body = card.querySelector(".card-body") || card;
        by = document.createElement("p");
        by.className = "card-by";
        body.appendChild(by);
      }
      scrubCardBy(by, id);
    });
  }

  function wireVideoCards(root) {
    (root || document).querySelectorAll("a.ps-videos-card[href*='/p/']").forEach(function (card) {
      var id = creationIdFromHref(card.getAttribute("href"));
      if (!id) return;
      if (card.querySelector(".ps-thumb-btn")) return;
      var body = card.querySelector(".ps-videos-card-body") || card;
      // Remove author <span> (second child text line)
      Array.prototype.slice.call(body.children).forEach(function (child) {
        if (child.tagName === "SPAN" && !child.classList.contains("ps-thumb-count")) {
          child.remove();
        }
      });
      var row = document.createElement("div");
      row.className = "ps-thumb-row";
      row.appendChild(makeBtn(id));
      body.appendChild(row);
      scheduleFetch(id);
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

  function wirePlate() {
    var id = plateIdFromPath();
    if (!id) return;
    var page = document.querySelector(".net-page.creation");
    if (!page) return;
    hideAuthLikeButtons(page);

    if (page.querySelector('.ps-thumb-btn[data-ps-thumb-id="' + id + '"]')) {
      scheduleFetch(id);
      return;
    }

    var actions = page.querySelector(".creation-actions");
    var slot = document.createElement("div");
    slot.className = "ps-thumb-plate-slot";
    slot.appendChild(makeBtn(id));

    if (actions) {
      actions.insertBefore(slot, actions.firstChild);
    } else {
      var stage = page.querySelector(".stage");
      if (stage && stage.parentNode) {
        stage.parentNode.insertBefore(slot, stage.nextSibling);
      } else {
        page.appendChild(slot);
      }
    }
    scheduleFetch(id);
  }

  function scan() {
    wireSpaCards(document);
    wireHomeCards(document);
    wireVideoCards(document);
    wirePlate();
  }

  function boot() {
    if (document.documentElement.getAttribute(MARK)) {
      scan();
      return;
    }
    document.documentElement.setAttribute(MARK, "1");
    scan();
    var root = document.getElementById("root") || document.body;
    if (!root || root.__psThumbsObs) return;
    var obs = new MutationObserver(function () {
      scan();
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
