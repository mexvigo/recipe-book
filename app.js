/* ============================================================================
   RECIPE_DB — app logic (vanilla JS, no build step)
   - Hash routing: #/ = grid, #/r/<id> = recipe
   - Search over title + tags + ingredients
   - Category filter, favorites (localStorage), checkable ingredients
   - Keep-screen-awake (Wake Lock API), theme toggle
   ========================================================================== */
(function () {
  "use strict";

  var RECIPES = window.RECIPES || [];
  var CATEGORIES = window.CATEGORIES || [];

  // Per-recipe emoji (keyed by id). Falls back to a category emoji.
  var EMOJI = {
    "papas-roast-chicken": "🍗",
    "linsen-erbseneintopf": "🥘",
    "vegetarian-lentil-soup": "🍲",
    "pearl-couscous-chicken": "🍗",
    "toms-sauce": "🥫",
    "jamiels-sardine-greens": "🥬",
    "arroz-verde": "🍚",
    "yellow-rice": "🍛",
    "goulash": "🥘",
    "hoppin-john": "🍚",
    "baked-fish": "🐟",
    "epic-chili": "🌶️",
    "vegetarian-chili": "🫘",
    "tomato-soup": "🍅",
    "avocado-tuna-cucumber-salad": "🥑",
    "vegan-choc-chip-cookies": "🍪",
    "muffins": "🧁",
    "cupcakes": "🧁",
    "empanada-crust": "🥟",
    "cheese-biscuits": "🧀",
    "chicken-wing-dry-rub": "🧂",
    "cornbread": "🌽",
    "jalapeno-poppers": "🌶️",
    "pineapple-fluff": "🍍",
    "chicken-burrito-bowl": "🌯",
    "tortellini-soup": "🍲",
    "white-chili": "🍗",
    "lasagna-rolls": "🍝",
    "sichuan-pork-green-beans": "🥢",
    "chicken-soup": "🍜",
    "creamy-chicken-soup-no-cream": "🥣",
    "mrs-walias-chicken-marinade": "🧂",
    "baked-oatmeal": "🥣",
    "snickerdoodles": "🍪",
    "shepherds-pie": "🥧",
    "walnut-chicken-salad": "🥗",
    "buffalo-chicken-salad": "🥗",
    "toddler-rice-pudding": "🍮",
    "toddler-smoothie-ice-pops": "🍓",
    "pasta-sausage-mushroom-thyme": "🍝",
    "chicken-shawarma-bowls": "🥙",
    "smoky-tomato-rice-soup": "🍅",
    "tuscan-white-bean-potato-soup": "🥣",
  };
  var CAT_EMOJI = {
    "Mains": "🍽️", "Soups & Stews": "🍲", "Chili": "🌶️", "Salads": "🥗",
    "Sides & Rice": "🍚", "Baking & Desserts": "🧁", "Sauces & Rubs": "🧂", "Breakfast": "🍳", "Toddler": "🧸",
  };
  function emojiFor(r) { return EMOJI[r.id] || CAT_EMOJI[r.category] || "🍴"; }

  // Stable index number per recipe (order in the data file), 2-digit.
  var INDEX = {};
  RECIPES.forEach(function (r, i) { INDEX[r.id] = String(i + 1).padStart(2, "0"); });

  // ---------- Favorites ----------
  var FAV_KEY = "recipebook.favs";
  function loadFavs() {
    try { return new Set(JSON.parse(localStorage.getItem(FAV_KEY) || "[]")); }
    catch (e) { return new Set(); }
  }
  function saveFavs(set) { try { localStorage.setItem(FAV_KEY, JSON.stringify(Array.from(set))); } catch (e) {} }
  var favs = loadFavs();
  function isFav(id) { return favs.has(id); }
  function toggleFav(id) { if (favs.has(id)) favs.delete(id); else favs.add(id); saveFavs(favs); }

  // ---------- Theme ----------
  var THEME_KEY = "recipebook.theme";
  function applyTheme(t) {
    if (t === "light" || t === "dark") document.documentElement.setAttribute("data-theme", t);
    else document.documentElement.removeAttribute("data-theme");
  }
  (function initTheme() { try { applyTheme(localStorage.getItem(THEME_KEY)); } catch (e) {} })();
  function currentTheme() {
    var attr = document.documentElement.getAttribute("data-theme");
    if (attr) return attr;
    return (window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches) ? "light" : "dark";
  }

  // ---------- State ----------
  var state = { q: "", cat: "All" };

  var el = {
    homeHeader: document.getElementById("home-header"),
    listView: document.getElementById("list-view"),
    detailView: document.getElementById("detail-view"),
    search: document.getElementById("search"),
    searchClear: document.getElementById("search-clear"),
    chips: document.getElementById("category-chips"),
    list: document.getElementById("recipe-list"),
    empty: document.getElementById("empty-state"),
    count: document.getElementById("result-count"),
    themeToggle: document.getElementById("theme-toggle"),
  };

  // ---------- Chips ----------
  function buildChips() {
    var cats = ["All", "Favorites", "Untried"].concat(CATEGORIES);
    el.chips.innerHTML = "";
    cats.forEach(function (c) {
      var b = document.createElement("button");
      b.className = "chip";
      b.textContent = c === "Favorites" ? "★ FAV" : c === "Untried" ? "◌ UNTRIED" : c;
      b.setAttribute("aria-pressed", String(state.cat === c));
      b.addEventListener("click", function () {
        state.cat = c;
        Array.prototype.forEach.call(el.chips.children, function (ch) { ch.setAttribute("aria-pressed", String(ch === b)); });
        renderList();
      });
      el.chips.appendChild(b);
    });
  }

  // ---------- Search / filter ----------
  function matchesQuery(r, q) {
    if (!q) return true;
    var hay = (r.title + " " + (r.tags || []).join(" ") + " " + r.category).toLowerCase();
    if (hay.indexOf(q) !== -1) return true;
    return (r.ingredients || []).some(function (g) {
      return (g.items || []).some(function (it) { return it.toLowerCase().indexOf(q) !== -1; });
    });
  }
  function currentResults() {
    var q = state.q.trim().toLowerCase();
    return RECIPES.filter(function (r) {
      if (state.cat === "Favorites") { if (!isFav(r.id)) return false; }
      else if (state.cat === "Untried") { if (!r.untried) return false; }
      else if (state.cat !== "All") { if (r.category !== state.cat) return false; }
      return matchesQuery(r, q);
    });
  }

  // ---------- Tile ----------
  function tileFor(r) {
    var li = document.createElement("li");
    var a = document.createElement("a");
    a.className = "tile";
    a.href = "#/r/" + r.id;
    a.setAttribute("data-cat", r.category);

    var idx = document.createElement("span"); idx.className = "tile-index"; idx.textContent = INDEX[r.id];
    var emoji = document.createElement("span"); emoji.className = "tile-emoji"; emoji.textContent = emojiFor(r);
    var title = document.createElement("span"); title.className = "tile-title"; title.textContent = r.title;
    var cat = document.createElement("span"); cat.className = "tile-cat"; cat.textContent = r.category;

    var fav = document.createElement("button");
    fav.className = "tile-fav"; fav.type = "button";
    fav.setAttribute("aria-pressed", String(isFav(r.id)));
    fav.setAttribute("aria-label", "Favorite " + r.title);
    fav.textContent = isFav(r.id) ? "★" : "☆";
    fav.addEventListener("click", function (e) {
      e.preventDefault(); e.stopPropagation();
      toggleFav(r.id);
      fav.textContent = isFav(r.id) ? "★" : "☆";
      fav.setAttribute("aria-pressed", String(isFav(r.id)));
      if (state.cat === "Favorites") renderList();
    });

    a.appendChild(idx); a.appendChild(fav);
    a.appendChild(emoji); a.appendChild(title); a.appendChild(cat);
    if (r.untried) { var ut = document.createElement("span"); ut.className = "tile-untried"; ut.textContent = "UNTRIED"; a.appendChild(ut); }
    li.appendChild(a);
    return li;
  }

  function renderList() {
    var results = currentResults();
    el.list.innerHTML = "";
    el.count.textContent = results.length + (results.length === 1 ? " ENTRY" : " ENTRIES");
    if (!results.length) { el.empty.hidden = false; return; }
    el.empty.hidden = true;
    results.forEach(function (r) { el.list.appendChild(tileFor(r)); });
  }

  // ---------- Wake Lock ----------
  var wakeLock = null;
  function supportsWakeLock() { return "wakeLock" in navigator; }
  async function requestWake(btn, note) {
    try {
      wakeLock = await navigator.wakeLock.request("screen");
      btn.classList.add("active"); note.classList.add("on");
      wakeLock.addEventListener("release", function () { btn.classList.remove("active"); note.classList.remove("on"); wakeLock = null; });
    } catch (e) {}
  }
  function releaseWake(btn, note) {
    if (wakeLock) { wakeLock.release(); wakeLock = null; }
    if (btn) btn.classList.remove("active"); if (note) note.classList.remove("on");
  }

  // ---------- Detail ----------
  function renderDetail(id) {
    var r = RECIPES.find(function (x) { return x.id === id; });
    if (!r) { location.hash = "#/"; return; }

    var checkedKey = "recipebook.checked." + id;
    var checked = {};
    try { checked = JSON.parse(sessionStorage.getItem(checkedKey) || "{}"); } catch (e) {}

    var d = el.detailView; d.innerHTML = "";

    // Top bar
    var top = document.createElement("div"); top.className = "detail-top";
    var back = document.createElement("button"); back.className = "icon-btn";
    back.innerHTML = '<svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg> BACK';
    back.addEventListener("click", function () { if (history.length > 1) history.back(); else location.hash = "#/"; });
    var spacer = document.createElement("div"); spacer.className = "spacer";
    var favBtn = document.createElement("button");
    favBtn.className = "icon-btn" + (isFav(r.id) ? " active" : "");
    favBtn.textContent = (isFav(r.id) ? "★ SAVED" : "☆ SAVE");
    favBtn.addEventListener("click", function () {
      toggleFav(r.id);
      favBtn.className = "icon-btn" + (isFav(r.id) ? " active" : "");
      favBtn.textContent = (isFav(r.id) ? "★ SAVED" : "☆ SAVE");
    });
    top.appendChild(back); top.appendChild(spacer); top.appendChild(favBtn);
    var wakeBtn = null;
    if (supportsWakeLock()) {
      wakeBtn = document.createElement("button"); wakeBtn.className = "icon-btn";
      wakeBtn.innerHTML = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M5 12H3M21 12h-2M6 6l-1 -1M18 18l1 1M18 6l1-1M6 18l-1 1"/></svg> AWAKE';
      top.appendChild(wakeBtn);
    }
    d.appendChild(top);

    var wakeNote = document.createElement("div"); wakeNote.className = "wake-note";
    wakeNote.textContent = "SCREEN LOCK DISABLED"; d.appendChild(wakeNote);
    if (wakeBtn) wakeBtn.addEventListener("click", function () { if (wakeLock) releaseWake(wakeBtn, wakeNote); else requestWake(wakeBtn, wakeNote); });

    // Hero
    var hero = document.createElement("div"); hero.className = "detail-hero"; hero.setAttribute("data-cat", r.category);
    var idline = document.createElement("div"); idline.className = "detail-idline";
    idline.textContent = "REC " + INDEX[r.id] + " · " + r.category;
    hero.appendChild(idline);
    var em = document.createElement("div"); em.className = "emoji"; em.textContent = emojiFor(r); hero.appendChild(em);
    var h2 = document.createElement("h2"); h2.textContent = r.title; hero.appendChild(h2);
    var tags = document.createElement("div"); tags.className = "detail-tags";
    if (r.untried) { var un = document.createElement("span"); un.className = "tag untried"; un.textContent = "UNTRIED"; tags.appendChild(un); }
    if (r.servings) { var sv = document.createElement("span"); sv.className = "tag cat"; sv.textContent = "SERVES " + r.servings; tags.appendChild(sv); }
    (r.tags || []).forEach(function (t) { var e2 = document.createElement("span"); e2.className = "tag"; e2.textContent = t; tags.appendChild(e2); });
    hero.appendChild(tags);
    d.appendChild(hero);

    // Body
    var body = document.createElement("div"); body.className = "detail-body";
    var ih = document.createElement("h3"); ih.appendChild(document.createTextNode("INGREDIENTS")); body.appendChild(ih);
    (r.ingredients || []).forEach(function (group, gi) {
      if (group.group) { var gl = document.createElement("div"); gl.className = "ing-group-label"; gl.textContent = group.group; body.appendChild(gl); }
      var list = document.createElement("div"); list.className = "ing-list";
      (group.items || []).forEach(function (item, ii) {
        var key = gi + ":" + ii;
        var row = document.createElement("div");
        row.className = "ing-item" + (checked[key] ? " checked" : "");
        row.setAttribute("role", "checkbox"); row.setAttribute("aria-checked", String(!!checked[key]));
        var box = document.createElement("span"); box.className = "ing-check mono"; row.appendChild(box);
        var txt = document.createElement("span"); txt.className = "ing-text"; txt.textContent = item; row.appendChild(txt);
        row.addEventListener("click", function () {
          checked[key] = !checked[key];
          row.classList.toggle("checked", checked[key]);
          row.setAttribute("aria-checked", String(!!checked[key]));
          try { sessionStorage.setItem(checkedKey, JSON.stringify(checked)); } catch (e) {}
        });
        list.appendChild(row);
      });
      body.appendChild(list);
    });

    if (r.steps && r.steps.length) {
      var sh = document.createElement("h3"); sh.appendChild(document.createTextNode("METHOD")); body.appendChild(sh);
      var steps = document.createElement("ol"); steps.className = "steps";
      r.steps.forEach(function (st) {
        var li = document.createElement("li"); li.className = "step";
        var n = document.createElement("span"); n.className = "step-num mono"; li.appendChild(n);
        var t = document.createElement("span"); t.className = "step-text"; t.textContent = st; li.appendChild(t);
        steps.appendChild(li);
      });
      body.appendChild(steps);
    }

    if (r.notes) {
      var n2 = document.createElement("div"); n2.className = "notes";
      var lbl = document.createElement("strong"); lbl.textContent = "Notes"; n2.appendChild(lbl);
      n2.appendChild(document.createTextNode(r.notes));
      body.appendChild(n2);
    }
    if (r.source) { var src = document.createElement("div"); src.className = "source-line mono"; src.textContent = r.source; body.appendChild(src); }
    d.appendChild(body);
  }

  // ---------- Router ----------
  function showList() {
    el.homeHeader.hidden = false; el.listView.hidden = false; el.detailView.hidden = true;
    releaseWake(null, null);
    renderList();
  }
  function showDetail(id) {
    el.homeHeader.hidden = true; el.listView.hidden = true; el.detailView.hidden = false;
    window.scrollTo(0, 0); renderDetail(id);
  }
  function route() {
    var m = (location.hash || "#/").match(/^#\/r\/(.+)$/);
    if (m) showDetail(decodeURIComponent(m[1])); else showList();
  }

  // ---------- Wiring ----------
  el.search.addEventListener("input", function () {
    state.q = el.search.value; el.searchClear.hidden = !state.q; renderList();
  });
  el.searchClear.addEventListener("click", function () {
    el.search.value = ""; state.q = ""; el.searchClear.hidden = true; el.search.focus(); renderList();
  });
  el.themeToggle.addEventListener("click", function () {
    var next = currentTheme() === "dark" ? "light" : "dark";
    applyTheme(next);
    try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
  });

  buildChips();
  window.addEventListener("hashchange", route);
  route();

  if ("serviceWorker" in navigator && location.protocol.indexOf("http") === 0) {
    window.addEventListener("load", function () { navigator.serviceWorker.register("sw.js").catch(function () {}); });
  }
})();
