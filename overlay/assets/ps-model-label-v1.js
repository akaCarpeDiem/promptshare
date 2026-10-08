/* Display-time model chips. Does not rewrite seed/D1 rows. Games stay "Grok". */
(function () {
  var OVERRIDES = window.psModelLabelOverrides || {};

  function familyOnly(model) {
    var n = String(model || "").trim();
    if (/^grok$/i.test(n)) return "grok";
    if (/^midjourney$/i.test(n)) return "midjourney";
    return null;
  }

  function displayModel(row, opts) {
    if (opts && opts.games) {
      var rawGame = String((row && row.model) || "").trim();
      return rawGame || "Grok";
    }
    row = row || {};
    var id = String(row.id || "").trim();
    var map = window.psModelLabelOverrides || OVERRIDES;
    if (id && map[id]) return map[id];
    var explicit = String(row.modelVersion || row.model_version || "").trim();
    if (explicit && !familyOnly(explicit)) return explicit;
    var model = String(row.model || "").trim();
    if (model && !familyOnly(model)) return model;
    var family = familyOnly(explicit || model);
    if (family === "midjourney") return "Midjourney V7";
    if (family === "grok") {
      return row.mediaKind === "video" ? "Grok Imagine Video 1.5" : "Grok Imagine 2.0";
    }
    return model || "Grok";
  }

  window.psModelLabelOverrides = OVERRIDES;
  window.psDisplayModel = displayModel;
})();
