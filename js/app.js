(function () {
  "use strict";

  var S = window.DatasetSearch;
  var DATA = window.DATASETS;
  var STORE_KEY = "datafinner.list.v1";

  var $ = function (sel, el) { return (el || document).querySelector(sel); };
  var form = $("#search-form");
  var qEl = $("#q"), whyEl = $("#why"), purposeEl = $("#purpose"), regionEl = $("#region"), nologinEl = $("#nologin");
  var resultsEl = $("#results"), interpEl = $("#interpretation"), tpl = $("#tpl-result");

  Object.keys(S.PURPOSES).forEach(function (k) {
    var o = document.createElement("option");
    o.value = k; o.textContent = S.PURPOSES[k].label;
    purposeEl.appendChild(o);
  });

  function el(tag, attrs, children) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === "text") e.textContent = attrs[k];
      else if (k === "class") e.className = attrs[k];
      else e.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { if (c) e.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return e;
  }

  function selectedTool() {
    var r = form.querySelector('input[name="tool"]:checked');
    return r ? r.value : "";
  }
  function setTool(v) {
    var r = form.querySelector('input[name="tool"][value="' + (v || "") + '"]');
    if (r) r.checked = true;
  }

  function stars(n) {
    var full = Math.floor(n), half = n - full >= 0.5;
    return "★".repeat(full) + (half ? "½" : "") + "☆".repeat(5 - full - (half ? 1 : 0));
  }

  // ------------------------------------------------------------ Min liste
  function loadList() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || []; } catch (e) { return memList; }
  }
  var memList = [];
  function saveList(list) {
    memList = list;
    try { localStorage.setItem(STORE_KEY, JSON.stringify(list)); } catch (e) { /* privat modus */ }
    renderList();
  }
  function inList(id) { return loadList().some(function (x) { return x.id === id; }); }

  function toggleSave(ds, btn) {
    var list = loadList();
    if (inList(ds.id)) {
      list = list.filter(function (x) { return x.id !== ds.id; });
    } else {
      var tool = currentState.tool;
      list.push({
        id: ds.id,
        name: ds.name,
        url: ds.url,
        provider: ds.provider,
        license: ds.license,
        tool: tool ? S.TOOLS[tool].label : "",
        format: currentState.bestFormat[ds.id] || "",
        why: whyEl.value.trim() || qEl.value.trim(),
        added: new Date().toISOString().slice(0, 10)
      });
    }
    saveList(list);
    if (btn) markSaved(btn, inList(ds.id));
  }
  function markSaved(btn, saved) {
    btn.classList.toggle("saved", saved);
    btn.textContent = saved ? "✓ I min liste" : "+ Min liste";
  }

  function renderList() {
    var list = loadList();
    var ul = $("#my-list");
    ul.textContent = "";
    $("#list-count").textContent = list.length;
    ["#export-md", "#export-csv", "#clear-list"].forEach(function (s) { $(s).disabled = !list.length; });
    if (!list.length) {
      ul.appendChild(el("li", { class: "muted small", text: "Ingen datasett lagret ennå." }));
      return;
    }
    list.forEach(function (item) {
      var ta = el("textarea", { rows: "2", placeholder: "Hva skal du bruke det til?", "aria-label": "Formål for " + item.name });
      ta.value = item.why || "";
      ta.addEventListener("change", function () {
        var l = loadList();
        l.forEach(function (x) { if (x.id === item.id) x.why = ta.value; });
        saveList(l);
      });
      var rm = el("button", { type: "button", class: "remove", title: "Fjern", "aria-label": "Fjern " + item.name, text: "×" });
      rm.addEventListener("click", function () {
        saveList(loadList().filter(function (x) { return x.id !== item.id; }));
        document.querySelectorAll('.r-save[data-id="' + item.id + '"]').forEach(function (b) { markSaved(b, false); });
      });
      ul.appendChild(el("li", {}, [
        el("div", { class: "li-head" }, [el("a", { href: item.url, target: "_blank", rel: "noopener", text: item.name }), rm]),
        item.tool || item.format ? el("div", { class: "tool-tag", text: [item.tool, item.format].filter(Boolean).join(" · ") }) : null,
        ta
      ]));
    });
  }

  // Kopierer innholdet til utklippstavlen og prøver i tillegg å laste ned fil
  // (nedlasting kan være blokkert når siden vises inne i en annen app).
  function download(name, content, type, btn) {
    var label = btn.textContent;
    var done = function (msg) { btn.textContent = msg; setTimeout(function () { btn.textContent = label; }, 2200); };
    try {
      navigator.clipboard.writeText(content).then(function () { done("Kopiert ✓"); }, function () { done("Lastet ned"); });
    } catch (e) { done("Lastet ned"); }
    try {
      var blob = new Blob([content], { type: type });
      var a = el("a", { href: URL.createObjectURL(blob), download: name });
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    } catch (e) { /* ignorer */ }
  }

  $("#export-md").addEventListener("click", function () {
    var list = loadList();
    var md = "# Datasett for prosjektet\n\n_Generert av Datafinner " + new Date().toISOString().slice(0, 10) + "_\n\n";
    list.forEach(function (x) {
      md += "## " + x.name + "\n\n";
      md += "- **Lenke:** " + x.url + "\n";
      md += "- **Kilde:** " + x.provider + "\n";
      md += "- **Lisens:** " + x.license + "\n";
      if (x.tool) md += "- **Verktøy:** " + x.tool + (x.format ? " (format: " + x.format + ")" : "") + "\n";
      if (x.why) md += "- **Formål:** " + x.why + "\n";
      md += "\n";
    });
    download("datasett.md", md, "text/markdown;charset=utf-8", this);
  });
  $("#export-csv").addEventListener("click", function () {
    var esc = function (v) { return '"' + String(v || "").replace(/"/g, '""') + '"'; };
    var rows = [["navn", "lenke", "kilde", "lisens", "verktøy", "format", "formål", "lagt_til"]];
    loadList().forEach(function (x) { rows.push([x.name, x.url, x.provider, x.license, x.tool, x.format, x.why, x.added]); });
    download("datasett.csv", "﻿" + rows.map(function (r) { return r.map(esc).join(";"); }).join("\n"), "text/csv;charset=utf-8");
  });
  // To-trinns tømming uten dialogboks: første klikk ber om bekreftelse.
  var clearArmed = null;
  $("#clear-list").addEventListener("click", function () {
    var btn = this;
    if (!clearArmed) {
      btn.textContent = "Klikk igjen for å tømme";
      clearArmed = setTimeout(function () { clearArmed = null; btn.textContent = "Tøm"; }, 3000);
      return;
    }
    clearTimeout(clearArmed); clearArmed = null; btn.textContent = "Tøm";
    saveList([]);
    document.querySelectorAll(".r-save").forEach(function (b) { markSaved(b, false); });
  });

  // ------------------------------------------------------------ Veiledning
  function renderHowto(container, ds, activeTool) {
    container.textContent = "";
    var tools = Object.keys(S.TOOLS);
    var tabs = el("div", { class: "tabs", role: "tablist" });
    var body = el("div", { role: "tabpanel" });

    function show(toolKey) {
      Array.prototype.forEach.call(tabs.children, function (t) { t.setAttribute("aria-selected", t.dataset.tool === toolKey ? "true" : "false"); });
      body.textContent = "";
      var h = window.HowTo.forTool(ds, toolKey);
      if (!h) return;
      if (h.format) body.appendChild(el("p", { class: "small muted" }, ["Anbefalt format for " + S.TOOLS[toolKey].label + ": ", el("b", { text: h.format })]));
      var ol = el("ol");
      h.steps.forEach(function (s) { ol.appendChild(el("li", { text: s })); });
      body.appendChild(ol);
      if (h.code) {
        if (h.code.install) body.appendChild(el("pre", {}, [el("code", { text: h.code.install })]));
        var pre = el("pre", {}, [el("code", { text: h.code.code })]);
        var copy = el("button", { type: "button", class: "btn small copy-btn", text: "Kopier" });
        copy.addEventListener("click", function () {
          (navigator.clipboard ? navigator.clipboard.writeText(h.code.code) : Promise.reject()).then(function () {
            copy.textContent = "Kopiert ✓";
          }, function () { copy.textContent = "Marker og kopier"; });
          setTimeout(function () { copy.textContent = "Kopier"; }, 1800);
        });
        body.appendChild(el("div", { class: "code-wrap" }, [pre, copy]));
      }
      var reasons = S.qualityReasons(ds);
      var ql = el("ul", { class: "quality-list" });
      reasons.forEach(function (r) { ql.appendChild(el("li", { class: r.ok ? "" : "no", text: r.text })); });
      body.appendChild(el("p", { class: "small", style: "margin:12px 0 0" }, [el("b", { text: "Kvalitetsvurdering" })]));
      body.appendChild(ql);
    }

    tools.forEach(function (k) {
      var b = el("button", { type: "button", class: "tab", role: "tab", text: S.TOOLS[k].label });
      b.dataset.tool = k;
      b.addEventListener("click", function () { show(k); });
      tabs.appendChild(b);
    });
    container.appendChild(tabs);
    container.appendChild(body);
    show(activeTool || "arcgis");
  }

  // ------------------------------------------------------------ Resultater
  var currentState = { tool: "", bestFormat: {} };

  function renderResults(res) {
    resultsEl.textContent = "";
    currentState.tool = res.intent.tool;
    currentState.bestFormat = {};

    // Tolkning
    interpEl.textContent = "";
    var parts = [];
    if (res.intent.tool) parts.push(["Verktøy", S.TOOLS[res.intent.tool].label, !selectedTool()]);
    if (res.intent.purpose) parts.push(["Formål", S.PURPOSES[res.intent.purpose].label, !purposeEl.value]);
    if (res.intent.region) parts.push(["Område", res.intent.region, !regionEl.value]);
    interpEl.appendChild(el("b", { text: res.results.length + " datasett" }));
    if (parts.length) {
      interpEl.appendChild(document.createTextNode(" · tilpasset "));
      parts.forEach(function (p) {
        interpEl.appendChild(el("span", { class: "pill", title: p[2] ? "Oppdaget fra teksten din" : "Valgt av deg", text: p[0] + ": " + p[1] + (p[2] ? " (auto)" : "") }));
      });
    }

    if (!res.results.length) {
      resultsEl.appendChild(el("div", { class: "empty" }, [
        el("p", { text: "Fant ingen datasett i den kuraterte listen som passer." }),
        el("p", { class: "muted small", text: "Prøv andre ord (norsk eller engelsk), fjern filtre, eller søk i de åpne katalogene under." })
      ]));
    }

    res.results.forEach(function (r) {
      var ds = r.dataset;
      var node = tpl.content.firstElementChild.cloneNode(true);
      $(".r-name", node).textContent = ds.name;
      $(".r-meta", node).textContent = ds.provider + " · " + ds.region + " · Oppdateres: " + ds.updated;
      var q = $(".r-quality", node);
      q.appendChild(el("div", { class: "stars", "aria-label": "Kvalitet " + r.quality + " av 5", text: stars(r.quality) }));
      q.appendChild(el("div", { class: "muted", text: "Kvalitet " + String(r.quality).replace(".", ",") + "/5" }));
      $(".r-desc", node).textContent = ds.description;

      var badges = $(".r-badges", node);
      var fitSet = res.intent.tool ? r.toolFormats : [];
      if (fitSet.length) currentState.bestFormat[ds.id] = fitSet[0];
      ds.formats.forEach(function (f) {
        badges.appendChild(el("span", { class: "badge" + (fitSet.indexOf(f) !== -1 ? " fit" : ""), title: fitSet.indexOf(f) !== -1 ? "Fungerer i " + S.TOOLS[res.intent.tool].label : "", text: f }));
      });
      badges.appendChild(el("span", { class: "badge", text: "Lisens: " + ds.license }));
      if (ds.login) badges.appendChild(el("span", { class: "badge warn", text: "Gratis innlogging kreves" }));
      if (res.intent.tool && !r.toolFit) badges.appendChild(el("span", { class: "badge warn", text: "Må konverteres for " + S.TOOLS[res.intent.tool].label }));
      if (r.purposeMatch) badges.appendChild(el("span", { class: "badge purpose", text: "Egnet til " + S.PURPOSES[res.intent.purpose].label.toLowerCase() }));
      if (ds.note) $(".r-note", node).textContent = ds.note;

      $(".r-open", node).href = ds.url;
      var api = $(".r-api", node);
      if (ds.api) api.href = ds.api; else api.remove();

      var hBtn = $(".r-howto-btn", node), hBox = $(".r-howto", node);
      if (res.intent.tool) hBtn.textContent = "Slik bruker du det i " + S.TOOLS[res.intent.tool].label;
      hBtn.addEventListener("click", function () {
        var open = hBox.classList.toggle("hidden") === false;
        hBtn.setAttribute("aria-expanded", open ? "true" : "false");
        if (open && !hBox.firstChild) renderHowto(hBox, ds, res.intent.tool);
      });

      var save = $(".r-save", node);
      save.dataset.id = ds.id;
      markSaved(save, inList(ds.id));
      save.addEventListener("click", function () { toggleSave(ds, save); });

      resultsEl.appendChild(node);
    });

    $("#live").classList.toggle("hidden", !(qEl.value.trim() || whyEl.value.trim()));
    $("#live-results").textContent = "";
  }

  function run(pushState) {
    var opts = {
      query: qEl.value,
      purposeText: whyEl.value,
      tool: selectedTool(),
      purpose: purposeEl.value,
      region: regionEl.value,
      includeLogin: !nologinEl.checked
    };
    var res = S.search(DATA, opts);
    renderResults(res);
    if (pushState) {
      var p = new URLSearchParams();
      if (opts.query) p.set("q", opts.query);
      if (opts.purposeText) p.set("why", opts.purposeText);
      if (opts.tool) p.set("tool", opts.tool);
      if (opts.purpose) p.set("purpose", opts.purpose);
      if (opts.region) p.set("region", opts.region);
      if (nologinEl.checked) p.set("nologin", "1");
      var qs = p.toString();
      try { history.replaceState(null, "", qs ? "?" + qs : location.pathname); } catch (e) { /* file:// */ }
    }
  }

  // ------------------------------------------------------------ Live-søk
  $("#live-btn").addEventListener("click", function () {
    var q = qEl.value.trim() || res_terms();
    var box = $("#live-results");
    box.textContent = "";
    if (!q) return;
    var btn = this;
    btn.disabled = true; btn.textContent = "Søker …";
    var region = regionEl.value;
    var sources = window.LiveSearch.SOURCES.filter(function (s) { return !region || s.region === region || s.region === "Global"; }).map(function (s) { return s.id; });
    window.LiveSearch.searchAll(q, sources, function (src, out) {
      var sec = el("div", { class: "live-source" }, [el("h3", { text: src.label })]);
      if (out.error) {
        sec.appendChild(el("p", { class: "muted small" }, ["Kunne ikke hente treff (" + out.error + "). ", el("a", { href: liveFallback(src.id, q), target: "_blank", rel: "noopener", text: "Søk direkte hos " + src.label + " ↗" })]));
      } else if (!out.items.length) {
        sec.appendChild(el("p", { class: "muted small", text: "Ingen treff." }));
      } else {
        out.items.forEach(function (it) {
          var meta = [it.provider, it.formats && it.formats.length ? it.formats.join(", ") : "", it.license || ""].filter(Boolean).join(" · ");
          sec.appendChild(el("div", { class: "live-item" }, [
            el("a", { href: it.url, target: "_blank", rel: "noopener", text: it.title }),
            meta ? el("p", { text: meta }) : null,
            it.description ? el("p", { text: it.description }) : null
          ]));
        });
      }
      box.appendChild(sec);
    }).then(function () { btn.disabled = false; btn.textContent = "Søk i kataloger"; });
  });

  function res_terms() { return S.tokenize(whyEl.value).slice(0, 4).join(" "); }

  function liveFallback(id, q) {
    var e = encodeURIComponent(q);
    return {
      geonorge: "https://kartkatalog.geonorge.no/search?text=" + e,
      europa: "https://data.europa.eu/data/datasets?query=" + e,
      zenodo: "https://zenodo.org/search?q=" + e + "&f=resource_type%3Adataset",
      huggingface: "https://huggingface.co/datasets?search=" + e
    }[id];
  }

  // ------------------------------------------------------------ Hendelser
  form.addEventListener("submit", function (e) { e.preventDefault(); run(true); });
  form.addEventListener("change", function (e) {
    if (e.target.name === "tool" || e.target === purposeEl || e.target === regionEl || e.target === nologinEl) run(true);
  });
  var t;
  qEl.addEventListener("input", function () { clearTimeout(t); t = setTimeout(function () { run(true); }, 250); });

  $("#reset").addEventListener("click", function () {
    form.reset(); setTool(""); run(true); qEl.focus();
  });

  document.querySelectorAll(".examples [data-q]").forEach(function (b) {
    b.addEventListener("click", function () {
      qEl.value = b.dataset.q; whyEl.value = b.dataset.why; setTool(b.dataset.tool);
      purposeEl.value = ""; regionEl.value = "";
      run(true);
    });
  });

  // Les tilstand fra URL (delbare søk)
  var params = new URLSearchParams(location.search);
  qEl.value = params.get("q") || "";
  whyEl.value = params.get("why") || "";
  setTool(params.get("tool") || "");
  if (params.get("purpose")) purposeEl.value = params.get("purpose");
  if (params.get("region")) regionEl.value = params.get("region");
  nologinEl.checked = params.get("nologin") === "1";

  renderList();
  run(false);
})();
