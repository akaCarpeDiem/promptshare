/* PromptShare — hover Sign out on the You chip (any page) */
(function () {
  var MARK = "data-ps-you-wrap";
  var ICON =
    '<img class="ps-signout-icon" src="/media/icons/sign-out.png" width="18" height="18" alt="" />';

  function ensureWrap(link) {
    if (!link || link.closest("[" + MARK + "]")) return link && link.closest("[" + MARK + "]");
    var wrap = document.createElement("div");
    wrap.className = "ps-you-wrap";
    wrap.setAttribute(MARK, "1");
    link.parentNode.insertBefore(wrap, link);
    wrap.appendChild(link);

    var menu = document.createElement("div");
    menu.className = "ps-you-menu";
    menu.setAttribute("role", "menu");

    var btn = document.createElement("button");
    btn.type = "button";
    btn.setAttribute("role", "menuitem");
    btn.className = "ps-signout-btn";
    btn.innerHTML = ICON + "<span>Sign out</span>";
    menu.appendChild(btn);
    wrap.appendChild(menu);

    var signingOut = false;

    function open() {
      wrap.classList.add("is-open");
      link.setAttribute("aria-expanded", "true");
    }
    function closeNow() {
      wrap.classList.remove("is-open");
      link.setAttribute("aria-expanded", "false");
    }

    link.setAttribute("aria-haspopup", "menu");
    link.setAttribute("aria-expanded", "false");

    wrap.addEventListener("mouseenter", open);
    wrap.addEventListener("mouseleave", closeNow);
    wrap.addEventListener("focusin", open);
    wrap.addEventListener("focusout", function (ev) {
      if (!wrap.contains(ev.relatedTarget)) closeNow();
    });

    link.addEventListener(
      "click",
      function (ev) {
        var coarse = window.matchMedia && window.matchMedia("(hover: none)").matches;
        if (!coarse) return;
        if (!wrap.classList.contains("is-open")) {
          ev.preventDefault();
          open();
        }
      },
      true
    );

    btn.addEventListener("click", function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      if (signingOut) return;
      signingOut = true;
      btn.disabled = true;
      btn.querySelector("span").textContent = "Signing out…";
      fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" })
        .catch(function () {})
        .then(function () {
          window.location.href = "/";
        });
    });

    document.addEventListener(
      "keydown",
      function (ev) {
        if (ev.key === "Escape" && wrap.classList.contains("is-open")) closeNow();
      },
      true
    );

    return wrap;
  }

  function scan() {
    document.querySelectorAll("a.you-link").forEach(function (link) {
      ensureWrap(link);
    });
  }

  function boot() {
    scan();
    var root = document.getElementById("root") || document.body;
    if (!root || root.__psSignoutObs) return;
    var obs = new MutationObserver(function () {
      scan();
    });
    obs.observe(root, { childList: true, subtree: true });
    root.__psSignoutObs = obs;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
