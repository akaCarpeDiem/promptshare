/* Category pagination for /images and /videos ?tag= views. Featured stays unpaged.
   fix2: always sync feed offset from URL ?page=; capture-phase pager clicks.
   pager-stable: do not tear down .ps-pager nodes on unrelated #root mutations. */
(function () {
  var PAGE_SIZE = 9;
  var last = { total: 0, tag: "", page: 1, kind: "" };

  function path() {
    return (location.pathname || "/").replace(/\/+$/, "") || "/";
  }

  function browseKind() {
    var p = path();
    if (p === "/videos") return "video";
    if (p === "/images") return "image";
    return "";
  }

  function activeTag() {
    try {
      return new URL(location.href).searchParams.get("tag") || "";
    } catch (e) {
      return "";
    }
  }

  function readPage() {
    try {
      var n = parseInt(new URL(location.href).searchParams.get("page") || "1", 10);
      if (!isFinite(n) || n < 1) return 1;
      return Math.floor(n);
    } catch (e) {
      return 1;
    }
  }

  function displayModel(c) {
    if (window.psDisplayModel && window.psDisplayModel !== displayModel) return window.psDisplayModel(c);
    var id = String((c && c.id) || "").trim();
    var map = window.psModelLabelOverrides || {};
    if (id && map[id]) return map[id];
    function familyOnly(model) {
      var n = String(model || "").trim();
      if (/^grok$/i.test(n)) return "grok";
      if (/^midjourney$/i.test(n)) return "midjourney";
      return null;
    }
    var explicit = String((c && (c.modelVersion || c.model_version)) || "").trim();
    if (explicit && !familyOnly(explicit)) return explicit;
    var model = String((c && c.model) || "").trim();
    if (model && !familyOnly(model)) return model;
    var family = familyOnly(explicit || model);
    if (family === "midjourney") return "Midjourney V7";
    if (family === "grok") return (c && c.mediaKind) === "video" ? "Grok Imagine Video 1.5" : "Grok Imagine 2.0";
    return model || "Grok";
  }

  function pageHref(tag, page, kind) {
    var base = (kind || browseKind()) === "video" ? "/videos/" : "/images/";
    var url = new URL(base, location.origin);
    if (tag) url.searchParams.set("tag", tag);
    if (page > 1) url.searchParams.set("page", String(page));
    return url.pathname + url.search;
  }

  function pageList(current, pages) {
    if (pages <= 7) {
      var all = [];
      var i;
      for (i = 1; i <= pages; i++) all.push(i);
      return all;
    }
    var set = { 1: 1, 2: 1 };
    set[pages] = 1;
    set[pages - 1] = 1;
    var n;
    for (n = current - 1; n <= current + 1; n++) {
      if (n >= 1 && n <= pages) set[n] = 1;
    }
    return Object.keys(set)
      .map(function (k) { return Number(k); })
      .sort(function (a, b) { return a - b; });
  }

  function pagerSignature(page, pages) {
    var nums = pageList(page, pages);
    var parts = ["Prev"];
    var prevNum = 0;
    nums.forEach(function (n) {
      if (prevNum && n > prevNum + 1) parts.push("gap");
      parts.push("p" + n);
      prevNum = n;
    });
    parts.push("Next");
    return parts.join(",");
  }

  function buildState(spec) {
    var tag = (spec && spec.tag) || "";
    var total = Number(spec && spec.total) || 0;
    var page = Math.max(1, Number(spec && spec.page) || 1);
    var kind = (spec && spec.kind) || browseKind();
    var pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (page > pages) page = pages;
    return {
      tag: tag,
      total: total,
      page: page,
      kind: kind,
      pages: pages,
      sig: pagerSignature(page, pages),
      key: [kind, tag, page, total, pages].join("|"),
    };
  }

  function syncHead(tag, page, pages, kind) {
    document.querySelectorAll('link[rel="next"], link[rel="prev"]').forEach(function (el) {
      if (el.getAttribute("data-ps-cat-page") === "1") el.remove();
    });
    if (!tag || pages <= 1) return;
    var head = document.head;
    if (page > 1) {
      var prev = document.createElement("link");
      prev.rel = "prev";
      prev.href = pageHref(tag, page - 1, kind);
      prev.setAttribute("data-ps-cat-page", "1");
      head.appendChild(prev);
    }
    if (page < pages) {
      var next = document.createElement("link");
      next.rel = "next";
      next.href = pageHref(tag, page + 1, kind);
      next.setAttribute("data-ps-cat-page", "1");
      head.appendChild(next);
    }
  }

  function findGrid() {
    var kind = browseKind();
    if (kind === "video") {
      var mount = document.getElementById("ps-videos-mount") || document.querySelector("[data-ps-videos]");
      return (mount && mount.querySelector(".ps-videos-grid")) || document.querySelector(".ps-videos-grid");
    }
    return document.querySelector(".card-grid, .ps-plate-grid");
  }

  function scrollToGrid() {
    var grid = findGrid();
    if (!grid) return;
    try {
      grid.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (e) {
      grid.scrollIntoView(true);
    }
  }

  function go(href, opts) {
    if (!href) return;
    var next = new URL(href, location.origin);
    var there = next.pathname + next.search;
    var here = location.pathname + location.search;
    if (here === there) {
      window.dispatchEvent(new PopStateEvent("popstate"));
      if (opts && opts.scroll) scrollToGrid();
      return;
    }
    history.pushState({}, "", there);
    window.dispatchEvent(new PopStateEvent("popstate"));
    if (!opts || opts.scroll !== false) scrollToGrid();
  }

  function onPagerActivate(a, ev) {
    if (!a || !a.classList || !a.closest) return false;
    if (!a.closest(".ps-pager")) return false;
    if (a.classList.contains("is-off")) {
      if (ev) ev.preventDefault();
      return true;
    }
    if (ev && (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey)) return false;
    if (ev && typeof ev.button === "number" && ev.button !== 0) return false;
    if (ev) {
      ev.preventDefault();
      if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
      else ev.stopPropagation();
    }
    go(a.getAttribute("href") || a.href, { scroll: true });
    return true;
  }

  function stampPager(nav, built) {
    nav.setAttribute("data-ps-pager-key", built.key);
    nav.setAttribute("data-ps-pager-sig", built.sig);
    nav.setAttribute("data-ps-tag", built.tag);
    nav.setAttribute("data-ps-page", String(built.page));
    nav.setAttribute("data-ps-total", String(built.total));
  }

  function applyLinkState(a, built, label, target) {
    a.href = pageHref(built.tag, target, built.kind);
    a.textContent = label;
    a.setAttribute("data-ps-page-label", label);
    a.setAttribute("data-ps-page-target", String(target));
    a.className = "";
    a.removeAttribute("aria-current");
    if (label === "Prev" && built.page <= 1) a.className = "is-off";
    else if (label === "Next" && built.page >= built.pages) a.className = "is-off";
    else if (label !== "Prev" && label !== "Next" && target === built.page) {
      a.className = "is-on";
      a.setAttribute("aria-current", "page");
    }
  }

  function addPagerLink(nav, built, label, target) {
    var a = document.createElement("a");
    applyLinkState(a, built, label, target);
    a.addEventListener("click", function (ev) {
      onPagerActivate(a, ev);
    });
    nav.appendChild(a);
    return a;
  }

  function fillPager(nav, built) {
    if (nav.getAttribute("data-ps-pager-sig") === built.sig && nav.querySelector("a[data-ps-page-label]")) {
      Array.prototype.forEach.call(nav.querySelectorAll("a[data-ps-page-label]"), function (a) {
        var label = a.getAttribute("data-ps-page-label");
        var target;
        if (label === "Prev") target = Math.max(1, built.page - 1);
        else if (label === "Next") target = Math.min(built.pages, built.page + 1);
        else target = Number(a.getAttribute("data-ps-page-target"));
        applyLinkState(a, built, label, target);
      });
      stampPager(nav, built);
      return nav;
    }
    while (nav.firstChild) nav.removeChild(nav.firstChild);
    addPagerLink(nav, built, "Prev", Math.max(1, built.page - 1));
    var nums = pageList(built.page, built.pages);
    var prevNum = 0;
    nums.forEach(function (n) {
      if (prevNum && n > prevNum + 1) {
        var gap = document.createElement("span");
        gap.className = "ps-pager-gap";
        gap.textContent = "…";
        nav.appendChild(gap);
      }
      addPagerLink(nav, built, String(n), n);
      prevNum = n;
    });
    addPagerLink(nav, built, "Next", Math.min(built.pages, built.page + 1));
    stampPager(nav, built);
    return nav;
  }

  function createPagerNav() {
    var nav = document.createElement("nav");
    nav.className = "ps-pager";
    nav.setAttribute("aria-label", "Category pages");
    return nav;
  }

  function isPager(el) {
    return !!(el && el.classList && el.classList.contains("ps-pager"));
  }

  function clearSiblingPagers(parent) {
    if (!parent || !parent.querySelectorAll) return;
    Array.prototype.slice.call(parent.querySelectorAll(".ps-pager")).forEach(function (el) {
      if (el.parentNode === parent) el.remove();
    });
  }

  function clearPagers(scope) {
    var root = scope || document;
    root.querySelectorAll(".ps-pager").forEach(function (el) { el.remove(); });
  }

  function placePagersAround(grid, spec) {
    if (!grid || !grid.parentNode) return null;
    var parent = grid.parentNode;
    var built = buildState(spec || {});
    last = { total: built.total, tag: built.tag, page: built.page, kind: built.kind };
    if (!built.tag || built.pages <= 1) {
      clearSiblingPagers(parent);
      syncHead(built.tag, 1, 1, built.kind);
      return null;
    }
    var top = isPager(grid.previousElementSibling) ? grid.previousElementSibling : null;
    var bottom = isPager(grid.nextElementSibling) ? grid.nextElementSibling : null;
    if (!top || !bottom) {
      Array.prototype.slice.call(parent.children).forEach(function (el) {
        if (!isPager(el) || el === top || el === bottom) return;
        if (!top && el.classList.contains("ps-pager--top")) top = el;
        else if (!bottom && !el.classList.contains("ps-pager--top")) bottom = el;
      });
    }
    if (
      top &&
      bottom &&
      top.nextElementSibling === grid &&
      grid.nextElementSibling === bottom &&
      top.getAttribute("data-ps-pager-key") === built.key &&
      bottom.getAttribute("data-ps-pager-key") === built.key
    ) {
      return { top: top, bottom: bottom };
    }
    if (!top) top = createPagerNav();
    if (!bottom) bottom = createPagerNav();
    top.classList.add("ps-pager--top");
    if (top.parentNode !== parent || top.nextElementSibling !== grid) {
      parent.insertBefore(top, grid);
    }
    if (bottom.parentNode !== parent || grid.nextElementSibling !== bottom) {
      if (grid.nextSibling) parent.insertBefore(bottom, grid.nextSibling);
      else parent.appendChild(bottom);
    }
    if (top.getAttribute("data-ps-pager-key") !== built.key) fillPager(top, built);
    if (bottom.getAttribute("data-ps-pager-key") !== built.key) fillPager(bottom, built);
    Array.prototype.slice.call(parent.querySelectorAll(".ps-pager")).forEach(function (el) {
      if (el !== top && el !== bottom && el.parentNode === parent) el.remove();
    });
    syncHead(built.tag, built.page, built.pages, built.kind);
    return { top: top, bottom: bottom };
  }

  function renderPager(host, spec) {
    if (!host) return null;
    var built = buildState(spec || {});
    last = { total: built.total, tag: built.tag, page: built.page, kind: built.kind };
    syncHead(built.tag, built.page, built.pages, built.kind);
    if (!built.tag || built.pages <= 1) {
      clearPagers(host);
      return null;
    }
    var nav = host.querySelector && host.querySelector(":scope > .ps-pager");
    if (!nav && host.children) {
      Array.prototype.slice.call(host.children).some(function (el) {
        if (isPager(el)) {
          nav = el;
          return true;
        }
        return false;
      });
    }
    if (nav && nav.getAttribute("data-ps-pager-key") === built.key) return nav;
    if (!nav) {
      nav = createPagerNav();
      if (spec && spec.append !== false) host.appendChild(nav);
    }
    fillPager(nav, built);
    return nav;
  }

  function paintImagesPager() {
    if (browseKind() !== "image") return;
    var tag = activeTag();
    var grid = document.querySelector(".net-page .card-grid, .card-grid.ps-plate-grid, .card-grid");
    if (!tag) {
      clearPagers();
      syncHead("", 1, 1, "image");
      return;
    }
    if (!grid || grid.closest(".ps-ia-featured-block")) return;
    if (last.tag === tag && last.kind === "image") {
      placePagersAround(grid, { tag: tag, total: last.total, page: readPage(), kind: "image" });
    }
  }

  function applyPageToFeedUrl(u) {
    var tag = activeTag();
    var kind = browseKind();
    if (!tag || !kind) return null;
    if (u.searchParams.get("q")) return null;
    if (u.searchParams.get("following") === "1") return null;
    var feedTag = u.searchParams.get("tag") || "";
    if (feedTag && feedTag !== tag) return null;
    if (!feedTag && !u.searchParams.has("tag")) return null;
    var page = readPage();
    u.searchParams.set("tag", tag);
    u.searchParams.set("limit", String(PAGE_SIZE));
    u.searchParams.set("offset", String((page - 1) * PAGE_SIZE));
    if (page > 1) u.searchParams.set("page", String(page));
    else u.searchParams.delete("page");
    if (!u.searchParams.get("fields")) u.searchParams.set("fields", "card");
    if (kind === "video" && !u.searchParams.get("kind")) u.searchParams.set("kind", "video");
    return u.pathname + u.search;
  }

  function interceptFeed() {
    if (window.fetch && window.fetch.__psCatPage) return;
    var orig = window.fetch.bind(window);
    window.fetch = function (input, init) {
      var url = "";
      try {
        url = typeof input === "string" ? input : (input && input.url) || "";
      } catch (e) {
        url = "";
      }
      var rewritten = url;
      if (url && url.indexOf("/api/feed") >= 0) {
        try {
          var u = new URL(url, location.origin);
          var next = applyPageToFeedUrl(u);
          if (next) {
            rewritten = next;
            if (typeof input === "string") input = rewritten;
            else if (typeof Request !== "undefined" && input instanceof Request) input = new Request(rewritten, input);
          }
        } catch (eRewrite) {}
      }
      return orig(input, init).then(function (res) {
        try {
          var check = rewritten || url;
          if (!check || check.indexOf("/api/feed") < 0) return res;
          var clone = res.clone();
          clone.json().then(function (data) {
            var tag = activeTag();
            var kind = browseKind();
            if (!tag || !kind || !data) return;
            var total = Number(data.total);
            if (!isFinite(total)) total = ((data.creations || data.items || []).length);
            last = { total: total, tag: tag, page: readPage(), kind: kind };
            if (kind === "image") paintImagesPager();
          }).catch(function () {});
        } catch (eRead) {}
        return res;
      });
    };
    window.fetch.__psCatPage = true;
  }

  function bindPagerCapture() {
    if (document.__psCatPageCapture) return;
    document.__psCatPageCapture = true;
    function fromEvent(ev) {
      var t = ev.target;
      if (!t || !t.closest) return;
      var a = t.closest("a");
      if (!a) return;
      onPagerActivate(a, ev);
    }
    document.addEventListener("click", fromEvent, true);
    document.addEventListener(
      "pointerup",
      function (ev) {
        if (ev.pointerType === "mouse") return;
        fromEvent(ev);
      },
      true
    );
  }

  function boot() {
    interceptFeed();
    bindPagerCapture();
    paintImagesPager();
    window.addEventListener("popstate", function () {
      setTimeout(paintImagesPager, 50);
    });
    var root = document.getElementById("root") || document.body;
    if (root && !root.__psCatPageObs) {
      var timer = null;
      var obs = new MutationObserver(function () {
        if (document.documentElement.dataset.psMuteObs === "1") return;
        clearTimeout(timer);
        timer = setTimeout(paintImagesPager, 80);
      });
      obs.observe(root, { childList: true, subtree: true });
      root.__psCatPageObs = obs;
    }
  }

  if (!window.psDisplayModel) window.psDisplayModel = displayModel;
  window.psCatPage = {
    size: PAGE_SIZE,
    readPage: readPage,
    href: pageHref,
    buildState: buildState,
    render: function (host, spec) {
      var grid =
        (host && host.querySelector && host.querySelector(".ps-videos-grid")) ||
        document.querySelector(".ps-videos-grid");
      if (grid) return placePagersAround(grid, spec || {});
      if (!host) return null;
      return renderPager(host, spec || {});
    },
    placeAround: placePagersAround,
    scrollToGrid: scrollToGrid,
    go: go,
    displayModel: window.psDisplayModel,
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
