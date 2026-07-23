/* ============================================================================
   Recipe Book — app logic (vanilla JS, no build step)
   - Hash routing: #/ = list, #/r/<id> = recipe
   - Search over title + tags + ingredients
   - Category filter, favorites (localStorage), checkable ingredients
   - Keep-screen-awake (Wake Lock API) on the recipe view
   ========================================================================== */
(function () {
  "use strict";

  var RECIPES = window.RECIPES || [];
  var CATEGORIES = window.CATEGORIES || [];

  // Emoji per category (purely decorative)
  var CAT_EMOJI = {
    "Mains": "🍽️",
    "Soups & Stews": "🍲",
    "Chili": "🌶️",
    "Salads": "🥗",
    "Sides & Rice": "🍚",
    "Baking & Desserts": "🧁",
    "Sauces & Rubs": "🧂",
    "Breakfast": "🍳",
  };
  function emojiFor(r) { return CAT_EMOJI[r.category] || "🍴"; }

  // ---------- Favorites ----------
  var FAV_KEY = "recipebook.favs";
  function loadFavs() {
    try { return new Set(JSON.parse(localStorage.getItem(FAV_KEY) || "[]")); }
    catch (e) { return new Set(); }
  }
  function saveFavs(set) {
    try { localStorage.setItem(FAV_KEY, JSON.stringify(Array.from(set))); } catch (e) {}
  }
  var favs = loadFavs();
  function isFav(id) { return favs.has(id); }
  function toggleFav(id) {
    if (favs.has(id)) favs.delete(id); else favs.add(id);
    saveFavs(favs);
  }

  // ---------- State ----------
  var state = { q: "", cat: "All" };

  // ---------- Elements ----------
  var el = {
    homeHeader: document.getElementById("home-header"),
    listView: document.getElementById("list-view"),
    detailView: document.getElementById("detail-view"),
    search: document.getElementById("search"),
    searchClear: document.getElementById("search-clear"),
    chips: document.getElementById("category-chips"),
    list: document.getElementById("recipe-list"),
    count: document.getElementById("result-count"),
    empty: document.getElementById("empty-state"),
  };

  // ---------- Build category chips ----------
  function buildChips() {
    var cats = ["Favorites", "All"].concat(CATEGORIES);
    el.chips.innerHTML = "";
    cats.forEach(function (c) {
      var b = document.createElement("button");
      b.className = "chip";
      b.textContent = c === "Favorites" ? "★ Favorites" : c;
      b.setAttribute("aria-pressed", String(state.cat === c));
      b.addEventListener("click", function () {
        state.cat = c;
        renderList();
        // reflect pressed state
        Array.prototype.forEach.call(el.chips.children, function (ch) {
          ch.setAttribute("aria-pressed", String(ch === b));
        });
      });
      el.chips.appendChild(b);
    });
  }

  // ---------- Search / filter ----------
  function matchesQuery(r, q) {
    if (!q) return true;
    var hay = (r.title + " " + (r.tags || []).join(" ") + " " + r.category).toLowerCase();
    if (hay.indexOf(q) !== -1) return true;
    // search ingredient text too
    return (r.ingredients || []).some(function (g) {
      return (g.items || []).some(function (it) { return it.toLowerCase().indexOf(q) !== -1; });
    });
  }

  function currentResults() {
    var q = state.q.trim().toLowerCase();
    return RECIPES.filter(function (r) {
      if (state.cat === "Favorites") { if (!isFav(r.id)) return false; }
      else if (state.cat !== "All") { if (r.category !== state.cat) return false; }
      return matchesQuery(r, q);
    });
  }

  // ---------- Render list ----------
  function cardFor(r) {
    var li = document.createElement("li");
    var card = document.createElement("a");
    card.className = "card";
    card.href = "#/r/" + r.id;

    var emoji = document.createElement("span");
    emoji.className = "card-emoji";
    emoji.textContent = emojiFor(r);

    var body = document.createElement("span");
    body.className = "card-body";
    var title = document.createElement("span");
    title.className = "card-title";
    title.textContent = r.title;
    var meta = document.createElement("span");
    meta.className = "card-meta";
    meta.textContent = r.category + (r.servings ? " · " + r.servings : "");
    body.appendChild(title); body.appendChild(meta);

    var fav = document.createElement("button");
    fav.className = "card-fav";
    fav.type = "button";
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

    card.appendChild(emoji); card.appendChild(body); card.appendChild(fav);
    li.appendChild(card);
    return li;
  }

  function renderList() {
    var results = currentResults();
    el.list.innerHTML = "";

    if (!results.length) {
      el.empty.hidden = false;
      el.count.textContent = "";
      return;
    }
    el.empty.hidden = true;
    el.count.textContent = results.length + (results.length === 1 ? " recipe" : " recipes");

    // Group by category unless already filtered to one category / favorites / searching
    var grouped = (state.cat === "All" && !state.q.trim());
    if (grouped) {
      CATEGORIES.forEach(function (cat) {
        var inCat = results.filter(function (r) { return r.category === cat; });
        if (!inCat.length) return;
        var label = document.createElement("li");
        label.className = "section-label";
        label.textContent = cat;
        el.list.appendChild(label);
        inCat.forEach(function (r) { el.list.appendChild(cardFor(r)); });
      });
    } else {
      results.forEach(function (r) { el.list.appendChild(cardFor(r)); });
    }
  }

  // ---------- Wake Lock ----------
  var wakeLock = null;
  function supportsWakeLock() { return "wakeLock" in navigator; }
  async function requestWake(btn, note) {
    try {
      wakeLock = await navigator.wakeLock.request("screen");
      btn.classList.add("active");
      note.classList.add("on");
      wakeLock.addEventListener("release", function () {
        btn.classList.remove("active"); note.classList.remove("on"); wakeLock = null;
      });
    } catch (e) { /* ignore */ }
  }
  function releaseWake(btn, note) {
    if (wakeLock) { wakeLock.release(); wakeLock = null; }
    btn.classList.remove("active"); note.classList.remove("on");
  }

  // ---------- Render detail ----------
  function renderDetail(id) {
    var r = RECIPES.find(function (x) { return x.id === id; });
    if (!r) { location.hash = "#/"; return; }

    var checkedKey = "recipebook.checked." + id;
    var checked = {};
    try { checked = JSON.parse(sessionStorage.getItem(checkedKey) || "{}"); } catch (e) {}

    var d = el.detailView;
    d.innerHTML = "";

    // Top bar
    var top = document.createElement("div");
    top.className = "detail-top";
    var back = document.createElement("button");
    back.className = "icon-btn";
    back.innerHTML = '<svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg> Back';
    back.addEventListener("click", function () {
      if (history.length > 1) history.back(); else location.hash = "#/";
    });
    var spacer = document.createElement("div"); spacer.className = "spacer";

    var favBtn = document.createElement("button");
    favBtn.className = "icon-btn" + (isFav(r.id) ? " active" : "");
    favBtn.innerHTML = (isFav(r.id) ? "★" : "☆") + " Save";
    favBtn.addEventListener("click", function () {
      toggleFav(r.id);
      favBtn.className = "icon-btn" + (isFav(r.id) ? " active" : "");
      favBtn.innerHTML = (isFav(r.id) ? "★" : "☆") + " Save";
    });

    top.appendChild(back); top.appendChild(spacer); top.appendChild(favBtn);

    var wakeBtn = null;
    if (supportsWakeLock()) {
      wakeBtn = document.createElement("button");
      wakeBtn.className = "icon-btn";
      wakeBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 3v2M12 19v2M5 12H3M21 12h-2M6 6l-1.5-1.5M18 18l1.5 1.5M18 6l1.5-1.5M6 18l-1.5 1.5"/><circle cx="12" cy="12" r="4"/></svg> Keep awake';
      top.appendChild(wakeBtn);
    }
    d.appendChild(top);

    // Wake note banner
    var wakeNote = document.createElement("div");
    wakeNote.className = "wake-note";
    wakeNote.textContent = "Screen will stay on while you cook.";
    d.appendChild(wakeNote);
    if (wakeBtn) {
      wakeBtn.addEventListener("click", function () {
        if (wakeLock) releaseWake(wakeBtn, wakeNote);
        else requestWake(wakeBtn, wakeNote);
      });
    }

    // Hero
    var hero = document.createElement("div");
    hero.className = "detail-hero";
    hero.innerHTML = '<div class="emoji">' + emojiFor(r) + "</div>";
    var h2 = document.createElement("h2"); h2.textContent = r.title; hero.appendChild(h2);
    var tags = document.createElement("div");
    tags.className = "detail-tags";
    var catTag = document.createElement("span"); catTag.className = "tag cat"; catTag.textContent = r.category; tags.appendChild(catTag);
    if (r.servings) { var s = document.createElement("span"); s.className = "tag"; s.textContent = "Serves " + r.servings; tags.appendChild(s); }
    (r.tags || []).forEach(function (t) { var e2 = document.createElement("span"); e2.className = "tag"; e2.textContent = t; tags.appendChild(e2); });
    hero.appendChild(tags);
    d.appendChild(hero);

    // Body
    var body = document.createElement("div");
    body.className = "detail-body";

    // Ingredients
    var ih = document.createElement("h3"); ih.textContent = "Ingredients"; body.appendChild(ih);
    (r.ingredients || []).forEach(function (group, gi) {
      if (group.group) {
        var gl = document.createElement("div"); gl.className = "ing-group-label"; gl.textContent = group.group; body.appendChild(gl);
      }
      var list = document.createElement("div"); list.className = "ing-list";
      (group.items || []).forEach(function (item, ii) {
        var key = gi + ":" + ii;
        var row = document.createElement("div");
        row.className = "ing-item" + (checked[key] ? " checked" : "");
        row.setAttribute("role", "checkbox");
        row.setAttribute("aria-checked", String(!!checked[key]));
        row.innerHTML = '<span class="ing-check"><svg viewBox="0 0 24 24"><path d="M4 12l5 5L20 6"/></svg></span>';
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

    // Steps
    if (r.steps && r.steps.length) {
      var sh = document.createElement("h3"); sh.textContent = "Steps"; body.appendChild(sh);
      var steps = document.createElement("ol"); steps.className = "steps";
      r.steps.forEach(function (st) {
        var li = document.createElement("li"); li.className = "step";
        li.innerHTML = '<span class="step-num"></span>';
        var t = document.createElement("span"); t.className = "step-text"; t.textContent = st; li.appendChild(t);
        steps.appendChild(li);
      });
      body.appendChild(steps);
    }

    // Notes
    if (r.notes) {
      var n = document.createElement("div"); n.className = "notes";
      n.innerHTML = "<strong>Notes:</strong> ";
      n.appendChild(document.createTextNode(r.notes));
      body.appendChild(n);
    }
    if (r.source) {
      var src = document.createElement("div"); src.className = "source-line"; src.textContent = "Source: " + r.source; body.appendChild(src);
    }

    d.appendChild(body);
  }

  // ---------- Router ----------
  function showList() {
    el.homeHeader.hidden = false;
    el.listView.hidden = false;
    el.detailView.hidden = true;
    if (wakeLock) { wakeLock.release(); wakeLock = null; }
    renderList();
  }
  function showDetail(id) {
    el.homeHeader.hidden = true;
    el.listView.hidden = true;
    el.detailView.hidden = false;
    window.scrollTo(0, 0);
    renderDetail(id);
  }
  function route() {
    var h = location.hash || "#/";
    var m = h.match(/^#\/r\/(.+)$/);
    if (m) showDetail(decodeURIComponent(m[1]));
    else showList();
  }

  // ---------- Search wiring ----------
  el.search.addEventListener("input", function () {
    state.q = el.search.value;
    el.searchClear.hidden = !state.q;
    renderList();
  });
  el.searchClear.addEventListener("click", function () {
    el.search.value = ""; state.q = ""; el.searchClear.hidden = true; el.search.focus(); renderList();
  });

  // ---------- Init ----------
  buildChips();
  window.addEventListener("hashchange", route);
  route();

  // ---------- Service worker (offline) — only over http(s) ----------
  if ("serviceWorker" in navigator && location.protocol.indexOf("http") === 0) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js").catch(function () {});
    });
  }
})();
