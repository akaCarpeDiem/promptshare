/* PromptShare — browse grid thumbs + lazy first-row paint. No layout change. */
(function () {
  function gridThumbUrl(src) {
    var raw = String(src || "");
    if (!raw) return raw;
    if (raw.indexOf("/media/thumbs/") >= 0) {
      var pathOnly = raw.replace(/^https?:\/\/[^/]+/i, "");
      if (pathOnly.indexOf("/media/thumbs/") === 0) return pathOnly;
    }
    if (raw.indexOf("/media/thumbs/") === 0) return raw;
    var m = raw.match(/^(\/media\/(images|posters)\/)([^/?#]+?)(\.[a-z0-9]+)(\?.*)?$/i);
    if (!m) return raw;
    return "/media/thumbs/" + m[2].toLowerCase() + "/" + m[3] + ".webp" + (m[5] || "");
  }

  function originalFromThumb(src) {
    var pathOnly = String(src || "").replace(/^https?:\/\/[^/]+/i, "");
    var m = pathOnly.match(/^\/media\/thumbs\/(images|posters)\/([^/?#]+)\.(webp|avif)(\?.*)?$/i);
    if (!m) return pathOnly;
    if (m[1].toLowerCase() === "posters") return "/media/posters/" + m[2] + ".jpg" + (m[4] || "");
    return "/media/images/" + m[2] + ".webp" + (m[4] || "");
  }

  window.psGridThumb = gridThumbUrl;

  function isBrowseCardImg(img) {
    if (!img || !img.tagName || img.tagName !== "IMG") return false;
    if (img.closest(".stage, .creation, .ps-disc-media")) return false;
    return !!(
      img.closest(".card-media, .ps-ia-card-media, .ps-videos-thumb, .ps-ia-featured-card, a.card, a.ps-videos-card")
    );
  }

  function wireImg(img, eager) {
    if (!img || img.dataset.psBrowseThumb === "1") return;
    var rawSrc = img.getAttribute("src") || "";
    var full = img.getAttribute("data-ps-full") || "";
    if (!full || full.indexOf("/media/thumbs/") >= 0) {
      full = originalFromThumb(full || rawSrc);
    }
    if (!full || full.indexOf("/media/") < 0) return;
    img.dataset.psBrowseThumb = "1";
    img.setAttribute("data-ps-full", full);
    var thumb = gridThumbUrl(full.indexOf("/media/thumbs/") === 0 ? originalFromThumb(full) : full);
    if (thumb !== img.getAttribute("src")) img.src = thumb;
    if (!img.getAttribute("width")) img.setAttribute("width", img.closest(".ps-videos-thumb, .ps-ia-card-media.is-video") ? "640" : "640");
    if (!img.getAttribute("height")) {
      img.setAttribute("height", img.closest(".ps-videos-thumb, .ps-ia-card-media.is-video") ? "400" : "480");
    }
    img.decoding = "async";
    img.loading = eager ? "eager" : img.loading || "lazy";
    if (eager) img.setAttribute("fetchpriority", "high");
    if (!img.__psThumbFb) {
      img.__psThumbFb = true;
      img.addEventListener("error", function () {
        var orig = img.getAttribute("data-ps-full");
        if (orig && img.src && img.src.indexOf("/media/thumbs/") >= 0) {
          img.src = orig;
        }
      });
    }
  }

  function wireRoot(root) {
    var list = (root || document).querySelectorAll(
      ".ps-ia-featured-card img, .ps-videos-card img, a.card .card-media img, .ps-ia-card-media img, .ps-videos-poster",
    );
    var eagerLeft = 3;
    list.forEach(function (img) {
      if (!isBrowseCardImg(img)) return;
      var eager = eagerLeft > 0;
      if (eager) eagerLeft -= 1;
      wireImg(img, eager);
    });
    (root || document).querySelectorAll("video.ps-disc-video, .stage video, .ps-videos-thumb video, .ps-ia-card-media video").forEach(function (v) {
      if (v.closest(".ps-disc-media")) return;
      if (!v.getAttribute("preload") || v.preload === "auto") v.preload = "metadata";
    });
  }

  window.psBrowseWireThumbs = wireRoot;

  var timer = null;
  function schedule() {
    if (document.documentElement.dataset.psMuteObs === "1") return;
    clearTimeout(timer);
    timer = setTimeout(function () {
      wireRoot(document);
    }, 40);
  }

  function boot() {
    wireRoot(document);
    var root = document.getElementById("root") || document.body;
    if (!root || root.__psBrowsePerfObs) return;
    var obs = new MutationObserver(function () {
      schedule();
    });
    obs.observe(root, { childList: true, subtree: true });
    root.__psBrowsePerfObs = obs;
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
