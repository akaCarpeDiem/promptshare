/* Adds a Games pane on the Images | Videos hub. Does not rewrite those panes. */
(function () {
  var MARK = "data-ps-games-pane";
  var SRC = "/games/posters/hub-arrow-keys.svg?v=20261004hub2";
  function ensure() {
    var split = document.querySelector(".ps-disc-split");
    if (!split) return;
    var games = split.querySelector(".ps-disc-pane--games");
    if (!games) {
      split.insertAdjacentHTML(
        "beforeend",
        '<a class="ps-disc-pane ps-disc-pane--games" href="/games/" ' + MARK + '="1">' +
          '<div class="ps-disc-media" style="background:#07101e url(/games/posters/hub-tech-bg-custom.webp?v=20261004hub2) center center / cover no-repeat">' +
          '<img class="ps-disc-img" src="' + SRC + '" alt=""/>' +
          '<div class="ps-disc-shade"></div>' +
          '<div class="ps-disc-label"><span class="ps-disc-word">Games</span></div>' +
          "</div></a>"
      );
      games = split.querySelector(".ps-disc-pane--games");
    }
    if (games && games !== split.lastElementChild) split.appendChild(games);
    var img = games && games.querySelector("img.ps-disc-img");
    if (img && img.getAttribute("src") !== SRC) img.setAttribute("src", SRC);
    split.setAttribute("aria-label", "Images, Videos, and Games");
  }
  function boot() {
    ensure();
    var root = document.getElementById("root") || document.body;
    if (!root || root.__psGamesObs) return;
    var obs = new MutationObserver(function () { ensure(); });
    obs.observe(root, { childList: true, subtree: true });
    root.__psGamesObs = obs;
    window.addEventListener("popstate", function () { setTimeout(ensure, 0); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
