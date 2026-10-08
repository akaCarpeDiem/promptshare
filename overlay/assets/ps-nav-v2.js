/* PromptShare — gallery-only public nav: Discover (eye-O) only */
(function () {
  var MARK = "data-ps-nav-v1";
  var EYE_MARK = "data-ps-eye";

  /* Closed: brow arc + lower U lid + 4 lashes. Open group: almond + iris + pupil. */
  var EYE_SVG =
    '<svg class="ps-eye-o" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
    "<defs>" +
    '<linearGradient id="ps-eye-iris" x1="20%" y1="15%" x2="80%" y2="90%">' +
    '<stop offset="0%" stop-color="#9af0fa"/>' +
    '<stop offset="55%" stop-color="#6ad8ea"/>' +
    '<stop offset="100%" stop-color="#a78bfa"/>' +
    "</linearGradient>" +
    "</defs>" +
    /* —— closed state —— */
    '<g class="eye-closed">' +
    '<path class="brow" d="M4.8 10.35 C8.0 7.35 10.7 6.55 12 6.55 C13.3 6.55 16.0 7.35 19.2 10.35"/>' +
    '<path class="lid-u" d="M5.0 11.2 C8.0 14.2 10.35 15.15 12 15.15 C13.65 15.15 16.0 14.2 19.0 11.2"/>' +
    '<path class="crease" d="M5.8 11.15 H18.2"/>' +
    '<path class="lash" d="M6.85 14.55 L5.95 17.05"/>' +
    '<path class="lash" d="M9.45 15.4 L8.85 17.85"/>' +
    '<path class="lash" d="M14.55 15.4 L15.15 17.85"/>' +
    '<path class="lash" d="M17.15 14.55 L18.05 17.05"/>' +
    "</g>" +
    /* —— open state —— */
    '<g class="eye-open">' +
    '<path class="almond" d="M3.8 12 C6.6 7.6 9.4 5.8 12 5.8 C14.6 5.8 17.4 7.6 20.2 12 C17.4 16.4 14.6 18.2 12 18.2 C9.4 18.2 6.6 16.4 3.8 12 Z"/>' +
    '<circle class="iris" cx="12" cy="12" r="3.45" fill="url(#ps-eye-iris)"/>' +
    '<circle class="pupil" cx="12" cy="12" r="1.45"/>' +
    '<circle class="shine" cx="10.9" cy="10.85" r="0.5"/>' +
    "</g>" +
    "</svg>";

  function path() {
    return (location.pathname || "/").replace(/\/+$/, "") || "/";
  }

  function syncRouteChrome() {
    var onHub = path() === "/" || path() === "/discover";
    document.documentElement.setAttribute("data-ps-route", onHub ? "discover" : path().slice(1) || "home");
    /* The canonical hub has no corner logo/button; remove any legacy instance. */
    var home = document.getElementById("ps-discover-home");
    if (home) home.remove();
  }

  function redirectCreators() {
    var p = path();
    if (p === "/creators" || p.indexOf("/creators/") === 0) {
      try {
        history.replaceState({}, "", "/");
      } catch (e) {}
      if (location.pathname.replace(/\/+$/, "") === "/creators" || location.pathname.indexOf("/creators") === 0) {
        location.replace("/");
      }
    }
  }

  function installCrossNav() {
    var p = path();
    if (p !== "/images" && p !== "/videos") return;
    var links = document.querySelectorAll("nav.net-links, nav.net-tabbar");
    links.forEach(function (nav) {
      var cross = nav.querySelectorAll("a.ps-cross-nav");
      var discover = nav.querySelector('a[href="/discover"], a[href="/discover/"]') || cross[0];
      // Once the first pass has repurposed the original links, the first
      // cross-nav link still has /videos as its href. Always prefer the
      // second cross-nav slot for Games so repeated scans cannot collapse
      // both targets onto the same link.
      var videos = cross[1] || nav.querySelector('a[href="/videos"], a[href="/videos/"]');
      if (!discover || !videos || discover === videos) return;
      var imagePage = p === "/images";
      var first = imagePage
        ? { href: "/videos", label: "Videos", key: "videos" }
        : { href: "/images", label: "Images", key: "images" };
      var second = { href: "/games/", label: "Games", key: "games" };
      [ [discover, first], [videos, second] ].forEach(function (entry) {
        var link = entry[0], item = entry[1];
        link.removeAttribute("hidden");
        link.hidden = false;
        link.style.display = "";
        link.classList.remove("ps-discover", "ps-nav-swap", "is-on");
        link.classList.add("ps-cross-nav");
        link.setAttribute("data-ps-cross-nav", item.key);
        link.setAttribute("href", item.href);
        link.setAttribute("aria-label", item.label);
        link.textContent = item.label;
      });
      var creators = nav.querySelectorAll('a[href="/creators"], a[href="/creators/"]');
      creators.forEach(function (a) {
        a.setAttribute("hidden", "true");
        a.style.display = "none";
      });
    });
  }

  function hideAuthAndDeadNav() {
    document.querySelectorAll("nav.net-links, nav.net-tabbar").forEach(function (nav) {
      nav.querySelectorAll('a[href="/creators"], a[href="/creators/"], a[href="/videos"], a[href="/videos/"]').forEach(function (a) {
        if (a.classList.contains("ps-discover") || a.classList.contains("ps-cross-nav") || a.getAttribute("data-ps-eye") === "1" || a.getAttribute("data-ps-swap")) return;
        a.setAttribute("hidden", "true");
        a.style.display = "none";
      });
      nav.querySelectorAll('a[href="/me"], a[href="/me/"]').forEach(function (a) {
        if (nav.classList.contains("net-tabbar") || a.classList.contains("you-link")) {
          a.setAttribute("hidden", "true");
          a.style.display = "none";
        }
      });
    });

    document.querySelectorAll("a.you-link, .ps-you-wrap").forEach(function (el) {
      el.setAttribute("hidden", "true");
      el.style.display = "none";
    });

    document.querySelectorAll(".net-bar > button.btn, .net-bar button.btn-line").forEach(function (btn) {
      var t = (btn.textContent || "").trim();
      if (/^sign in$/i.test(t)) {
        btn.setAttribute("hidden", "true");
        btn.style.display = "none";
        btn.setAttribute("data-ps-auth-hidden", "1");
      }
    });
  }

  function swapTarget() {
    var p = path();
    if (p === "/images") return { href: "/videos", label: "Videos", key: "videos" };
    if (p === "/videos") return { href: "/images", label: "Images", key: "images" };
    return null;
  }

  function paintSwap(link, swap) {
    link.setAttribute(EYE_MARK, "1");
    link.classList.add("ps-discover", "ps-nav-swap");
    link.hidden = false;
    link.style.display = "";
    link.removeAttribute("hidden");
    link.setAttribute("href", swap.href);
    link.setAttribute("aria-label", swap.label);
    if (link.getAttribute("data-ps-swap") === swap.key && link.querySelector(".ps-swap-label")) return;
    link.setAttribute("data-ps-swap", swap.key);
    link.textContent = "";
    var label = document.createElement("span");
    label.className = "ps-discover-label ps-swap-label";
    label.textContent = swap.label;
    link.appendChild(label);
  }

  function cleanSearchPlaceholder() {
    document.querySelectorAll("input[name='q'], input#q, input#search-q").forEach(function (el) {
      var ph = el.getAttribute("placeholder") || "";
      var next = ph.replace(/,\s*creators?\b/ig, "").replace(/\s+,/g, ",").replace(/,\s*$/g, "").replace(/\s{2,}/g, " ").trim();
      if (next && next !== ph) el.setAttribute("placeholder", next);
    });
  }

  function enhanceDiscover(link) {
    if (!link) return;
    var swap = swapTarget();
    if (swap) {
      paintSwap(link, swap);
      return;
    }
    link.classList.remove("ps-nav-swap");
    if (link.getAttribute("data-ps-swap")) {
      link.removeAttribute("data-ps-swap");
      link.textContent = "";
    }
    link.setAttribute(EYE_MARK, "1");
    link.classList.add("ps-discover");
    link.setAttribute("href", "/");
    /* Rebuild malformed/legacy markup instead of trusting a stale marker. */
    if (link.querySelector(".ps-discover-label .ps-eye-o")) return;
    link.setAttribute("aria-label", "Discover");
    link.setAttribute("href", "/");
    var label = document.createElement("span");
    label.className = "ps-discover-label";
    label.setAttribute("aria-hidden", "true");
    var uid = Math.random().toString(36).slice(2, 8);
    var svg = EYE_SVG
      .replace(/id="ps-eye-iris"/g, 'id="ps-eye-iris-' + uid + '"')
      .replace(/url\(#ps-eye-iris\)/g, "url(#ps-eye-iris-" + uid + ")");
    var pre = document.createElement("span");
    pre.className = "ps-disc-pre";
    pre.textContent = "Disc";
    var post = document.createElement("span");
    post.className = "ps-disc-post";
    post.textContent = "ver";
    label.appendChild(pre);
    label.insertAdjacentHTML("beforeend", svg);
    label.appendChild(post);
    link.textContent = "";
    link.appendChild(label);
  }

  function markActiveDiscover() {
    var onDiscover = path() === "/" || path() === "/discover";
    document.querySelectorAll("a.ps-discover").forEach(function (a) {
      if (onDiscover) a.classList.add("is-on");
      else a.classList.remove("is-on");
    });
  }

  function scanDiscover() {
    document.querySelectorAll("nav.net-links a, nav.net-tabbar a, nav[aria-label='Primary'] a, nav[aria-label='App'] a").forEach(function (a) {
      var href = a.getAttribute("href") || "";
      var text = (a.textContent || "").replace(/\s+/g, " ").trim();
      var looksDisc =
        /^discover$/i.test(text) ||
        /^disc\s*ver$/i.test(text) ||
        a.classList.contains("ps-discover") ||
        a.getAttribute(EYE_MARK) === "1" ||
        href === "/discover" ||
        href === "/discover/";
      if (!looksDisc) return;
      enhanceDiscover(a);
    });
    markActiveDiscover();
  }

  function scan() {
    syncRouteChrome();
    redirectCreators();
    installCrossNav();
    hideAuthAndDeadNav();
    scanDiscover();
    cleanSearchPlaceholder();
  }

  function boot() {
    if (document.documentElement.getAttribute(MARK)) {
      scan();
      return;
    }
    document.documentElement.setAttribute(MARK, "1");
    scan();
    var root = document.getElementById("root") || document.body;
    if (!root || root.__psNavObs) return;
    var obs = new MutationObserver(function () {
      scan();
    });
    obs.observe(root, { childList: true, subtree: true });
    root.__psNavObs = obs;
    window.addEventListener("popstate", function () {
      setTimeout(scan, 0);
    });
    document.addEventListener(
      "click",
      function (ev) {
        var a = ev.target && ev.target.closest && ev.target.closest("a[href]");
        if (!a) return;
        var href = a.getAttribute("href") || "";
        if (href.indexOf("/creators") === 0) {
          ev.preventDefault();
          ev.stopPropagation();
          location.assign("/");
          return;
        }
        if (a.classList.contains("ps-cross-nav")) {
          if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey || ev.button !== 0) return;
          ev.preventDefault();
          ev.stopPropagation();
          location.assign(a.getAttribute("href") || "/");
          return;
        }
        if ((a.classList.contains("ps-discover") || a.getAttribute("data-ps-eye") === "1") && swapTarget()) {
          if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey || ev.button !== 0) return;
          ev.preventDefault();
          ev.stopPropagation();
          var dest = swapTarget().href;
          try { history.pushState({}, "", dest); } catch (e2) { location.assign(dest); return; }
          window.dispatchEvent(new PopStateEvent("popstate"));
          return;
        }
        setTimeout(scan, 0);
      },
      true
    );
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
