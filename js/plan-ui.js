/*
 * Grensesnitt for oppgaveplanleggeren og fanene «Planlegg oppgave» / «Søk i datasett».
 */
(function () {
  "use strict";

  var P = window.Planner, G = window.ScriptGen, K = window.Knowledge, S = window.DatasetSearch;
  var $ = function (sel, el) { return (el || document).querySelector(sel); };
  var AVAIL_KEY = "datafinner.available.v1";

  function el(tag, attrs, children) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === "text") e.textContent = attrs[k];
      else if (k === "class") e.className = attrs[k];
      else if (k === "html") e.innerHTML = attrs[k]; // brukes bare for egne SVG-maler
      else e.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { if (c) e.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return e;
  }

  function link(href, text) { return el("a", { href: href, target: "_blank", rel: "noopener", text: text }); }

  function copyText(text, btn) {
    var label = btn.textContent;
    var done = function (msg) { btn.textContent = msg; setTimeout(function () { btn.textContent = label; }, 2000); };
    try {
      navigator.clipboard.writeText(text).then(function () { done("Kopiert ✓"); }, function () { done("Kunne ikke kopiere"); });
    } catch (e) { done("Kunne ikke kopiere"); }
  }

  function downloadFile(name, content, type) {
    try {
      var blob = new Blob([content], { type: type });
      var a = el("a", { href: URL.createObjectURL(blob), download: name });
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
      return true;
    } catch (e) { return false; }
  }

  // ------------------------------------------------------------ Faner
  function showTab(name) {
    var plan = name !== "sok";
    $("#panel-plan").hidden = !plan;
    $("#panel-sok").hidden = plan;
    $("#tab-plan").setAttribute("aria-current", plan ? "page" : "false");
    $("#tab-sok").setAttribute("aria-current", plan ? "false" : "page");
  }
  function route() { showTab(location.hash === "#sok" ? "sok" : "plan"); }
  window.addEventListener("hashchange", route);

  // ------------------------------------------------------------ Skjema
  var form = $("#plan-form"), taskEl = $("#task"), placeEl = $("#place");

  K.PLACES.kommuner.concat(K.PLACES.fylker).sort().forEach(function (n) {
    $("#place-list").appendChild(el("option", { value: n }));
  });

  function loadAvailable() {
    try { var v = JSON.parse(localStorage.getItem(AVAIL_KEY)); if (Array.isArray(v)) return v; } catch (e) { /* ignorer */ }
    return Object.keys(K.PLATFORMS);
  }
  function saveAvailable(v) { try { localStorage.setItem(AVAIL_KEY, JSON.stringify(v)); } catch (e) { /* ignorer */ } }
  var available = loadAvailable();
  Object.keys(K.PLATFORMS).forEach(function (k) {
    var cb = el("input", { type: "checkbox", id: "av-" + k, value: k });
    cb.checked = available.indexOf(k) !== -1;
    cb.addEventListener("change", function () {
      available = Array.prototype.filter.call(document.querySelectorAll("#available input"), function (i) { return i.checked; }).map(function (i) { return i.value; });
      saveAvailable(available);
      if (currentPlanOptions) render(currentPlanOptions);
    });
    $("#available").appendChild(el("label", { class: "check", for: "av-" + k }, [cb, " " + K.PLATFORMS[k].label]));
  });

  var EXAMPLES = [
    { label: "Bygninger i flomsone", text: "Lag et kart over hvilke bygninger i Bergen som ligger i flomsone og skredfareområder, til en ROS-analyse i ArcGIS Pro. Kartet skal inn i en rapport.", tool: "arcgis" },
    { label: "ÅDT på vegnettet", text: "Kart over trafikkmengde (ÅDT) på vegene i Stavanger til en rapport om trafikkutvikling.", tool: "arcgis" },
    { label: "Kjøretid til sykehus", text: "Hvor mange innbyggere i Tromsø bor mer enn 30 minutter kjøretid fra sykehus eller legevakt?", tool: "" },
    { label: "Elsparkesykler i Oslo", text: "Hvor står elsparkesyklene i Oslo gjennom dagen? Vil analysere det i Python og vise det på et dashboard.", tool: "vscode" },
    { label: "Pendlingskart", text: "Lag et flytkart over pendling mellom kommunene i Trøndelag til en presentasjon for fylkestinget.", tool: "" },
    { label: "Trafikkulykker", text: "Varmekart over trafikkulykker i Oslo som skal deles med kolleger i ArcGIS Online.", tool: "online" }
  ];
  EXAMPLES.forEach(function (ex) {
    var b = el("button", { type: "button", class: "link-btn", text: ex.label });
    b.addEventListener("click", function () {
      taskEl.value = ex.text; placeEl.value = ""; placeTouched = false;
      setRadio("ptool", ex.tool); setRadio("pdeliv", "");
      submit();
    });
    $("#plan-examples").appendChild(b);
  });

  function setRadio(name, v) {
    var r = form.querySelector('input[name="' + name + '"][value="' + (v || "") + '"]');
    if (r) r.checked = true;
  }
  function radio(name) {
    var r = form.querySelector('input[name="' + name + '"]:checked');
    return r ? r.value : "";
  }

  // Fyll inn kommune automatisk når teksten nevner en
  var placeTouched = false;
  placeEl.addEventListener("input", function () { placeTouched = !!placeEl.value; });
  taskEl.addEventListener("input", function () {
    if (placeTouched) return;
    var p = P.detectPlace(taskEl.value);
    placeEl.value = p && p.type !== "land" ? p.name : "";
  });

  var currentPlanOptions = null;

  function submit(extra) {
    var text = taskEl.value.trim();
    if (!text) { taskEl.focus(); return; }
    currentPlanOptions = {
      text: text,
      tool: radio("ptool"),
      deliverable: radio("pdeliv"),
      place: placeEl.value.trim(),
      recipe: extra && extra.recipe
    };
    render(currentPlanOptions);
    try {
      var p = new URLSearchParams();
      p.set("oppgave", text);
      if (currentPlanOptions.place) p.set("sted", currentPlanOptions.place);
      if (currentPlanOptions.tool) p.set("verktoy", currentPlanOptions.tool);
      if (currentPlanOptions.deliverable) p.set("leveranse", currentPlanOptions.deliverable);
      history.replaceState(null, "", "?" + p.toString() + "#planlegg");
    } catch (e) { /* file:// */ }
  }

  form.addEventListener("submit", function (e) { e.preventDefault(); submit(); });
  form.addEventListener("change", function (e) {
    if ((e.target.name === "ptool" || e.target.name === "pdeliv") && currentPlanOptions) submit();
  });
  $("#plan-reset").addEventListener("click", function () {
    form.reset(); placeTouched = false; currentPlanOptions = null; $("#plan").textContent = "";
    try { history.replaceState(null, "", location.pathname + "#planlegg"); } catch (e) { /* ignorer */ }
    taskEl.focus();
  });

  // ------------------------------------------------------------ Illustrasjoner av karttyper
  function mapSvg(type) {
    var bg = '<rect x="0" y="0" width="200" height="130" rx="8" fill="var(--map-bg)"/>';
    var water = '<path d="M0 95 C40 85 60 110 100 100 S170 80 200 92 V130 H0Z" fill="var(--map-water)"/>';
    var c = ["var(--seq-1)", "var(--seq-2)", "var(--seq-3)", "var(--seq-4)", "var(--seq-5)"];
    var body = "";
    switch (type) {
      case "overlay":
        body = water + '<path d="M20 70 C60 55 90 80 130 70 S180 60 195 72 L195 100 C150 95 100 110 60 100 S20 98 20 98Z" fill="var(--seq-3)" opacity=".45"/>';
        [[30, 30], [55, 40], [80, 25], [110, 45], [140, 30], [165, 42], [45, 78], [90, 82], [120, 76], [160, 80], [70, 60], [175, 68]].forEach(function (p, i) {
          var hit = p[1] > 65;
          body += '<rect x="' + p[0] + '" y="' + p[1] + '" width="11" height="9" fill="' + (hit ? "var(--hit)" : "var(--map-muted)") + '"/>';
        });
        break;
      case "koroplet":
        var cells = [[10, 10, 60, 50, 1], [70, 10, 55, 40, 3], [125, 10, 65, 55, 2], [10, 60, 45, 60, 4], [55, 50, 70, 45, 0], [125, 65, 65, 55, 3], [55, 95, 70, 25, 2]];
        cells.forEach(function (r) { body += '<rect x="' + r[0] + '" y="' + r[1] + '" width="' + r[2] + '" height="' + r[3] + '" fill="' + c[r[4]] + '" stroke="var(--map-bg)" stroke-width="2"/>'; });
        break;
      case "rutenett":
        for (var gx = 0; gx < 10; gx++) for (var gy = 0; gy < 6; gy++) {
          var d = Math.max(0, 4 - Math.round(Math.hypot(gx - 4.5, gy - 2.5) * 0.9));
          if (d > 0 || (gx + gy) % 3 === 0) body += '<rect x="' + (10 + gx * 18) + '" y="' + (10 + gy * 18) + '" width="17" height="17" fill="' + c[d] + '"/>';
        }
        break;
      case "linjer":
        body = '<path d="M5 110 C50 90 80 70 120 60 S180 30 195 15" stroke="var(--seq-5)" stroke-width="9" fill="none" stroke-linecap="round"/>' +
          '<path d="M120 60 C130 85 150 100 195 110" stroke="var(--seq-4)" stroke-width="5" fill="none" stroke-linecap="round"/>' +
          '<path d="M60 92 C55 60 40 40 10 20" stroke="var(--seq-3)" stroke-width="3" fill="none" stroke-linecap="round"/>' +
          '<path d="M150 40 C150 20 170 10 190 8" stroke="var(--seq-2)" stroke-width="2" fill="none" stroke-linecap="round"/>';
        break;
      case "hotspot":
        for (var hx = 0; hx < 9; hx++) for (var hy = 0; hy < 5; hy++) {
          var cx = 18 + hx * 21 + (hy % 2) * 10.5, cy = 18 + hy * 24;
          var v = Math.max(0, 4 - Math.round(Math.hypot(hx - 5, (hy - 2) * 1.2) * 1.1));
          var pts = [];
          for (var a = 0; a < 6; a++) { var ang = Math.PI / 3 * a + Math.PI / 6; pts.push((cx + 11.5 * Math.cos(ang)).toFixed(1) + "," + (cy + 11.5 * Math.sin(ang)).toFixed(1)); }
          body += '<polygon points="' + pts.join(" ") + '" fill="' + c[v] + '" stroke="var(--map-bg)" stroke-width="1.5"/>';
        }
        break;
      case "tilgjengelighet":
        body = '<path d="M100 8 C160 10 192 50 185 80 S140 125 95 122 S10 105 15 70 S50 6 100 8Z" fill="var(--seq-1)"/>' +
          '<path d="M100 28 C145 30 165 55 160 78 S130 105 98 103 S38 92 40 68 S60 26 100 28Z" fill="var(--seq-2)"/>' +
          '<path d="M100 48 C125 48 138 62 134 76 S118 88 99 88 S64 82 66 68 S78 48 100 48Z" fill="var(--seq-4)"/>' +
          '<circle cx="100" cy="68" r="6" fill="var(--hit)" stroke="var(--map-bg)" stroke-width="2"/>';
        break;
      case "flyt":
        var hubs = [[40, 80], [100, 40], [160, 85], [70, 115], [150, 25]];
        [[0, 1, 7], [3, 1, 3], [2, 1, 5], [4, 1, 2], [0, 2, 2]].forEach(function (f) {
          var a1 = hubs[f[0]], b1 = hubs[f[1]];
          var mx = (a1[0] + b1[0]) / 2 + (b1[1] - a1[1]) * 0.3, my = (a1[1] + b1[1]) / 2 - (b1[0] - a1[0]) * 0.3;
          body += '<path d="M' + a1[0] + " " + a1[1] + " Q" + mx + " " + my + " " + b1[0] + " " + b1[1] + '" stroke="var(--seq-4)" stroke-width="' + f[2] + '" fill="none" opacity=".8" stroke-linecap="round"/>';
        });
        hubs.forEach(function (h) { body += '<circle cx="' + h[0] + '" cy="' + h[1] + '" r="5" fill="var(--hit)"/>'; });
        break;
      case "raster":
        for (var ry = 0; ry < 13; ry++) for (var rx = 0; rx < 20; rx++) {
          var z = Math.sin(rx / 3) + Math.cos(ry / 2.5) + Math.sin((rx + ry) / 5);
          var k = Math.max(0, Math.min(4, Math.round((z + 2) / 1.2)));
          body += '<rect x="' + rx * 10 + '" y="' + ry * 10 + '" width="10" height="10" fill="' + c[k] + '"/>';
        }
        break;
      case "kategori":
        body = '<path d="M0 0 H110 C90 40 120 60 90 130 H0Z" fill="var(--cat-1)"/>' +
          '<path d="M110 0 H200 V60 C160 70 130 50 120 30Z" fill="var(--cat-2)"/>' +
          '<path d="M120 30 C130 50 160 70 200 60 V130 H90 C120 60 90 40 110 0Z" fill="var(--cat-3)" opacity=".9"/>' +
          '<path d="M60 70 C80 60 100 80 90 100 S50 110 45 95 S50 75 60 70Z" fill="var(--map-water)"/>';
        break;
      case "tidsserie":
        body = '<polyline points="10,100 35,90 60,95 85,70 110,75 135,50 160,55 190,30" fill="none" stroke="var(--seq-5)" stroke-width="3"/>' +
          '<line x1="10" y1="110" x2="190" y2="110" stroke="var(--map-muted)"/>' +
          [10, 35, 60, 85, 110, 135, 160, 190].map(function (x, i) { var y = [100, 90, 95, 70, 75, 50, 55, 30][i]; return '<circle cx="' + x + '" cy="' + y + '" r="3" fill="var(--seq-5)"/>'; }).join("");
        break;
      default: // punkt
        body = water;
        [[30, 30, 5], [60, 50, 9], [95, 30, 4], [120, 60, 12], [150, 35, 6], [175, 65, 8], [45, 75, 6], [85, 80, 4]].forEach(function (p) {
          body += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="' + p[2] + '" fill="var(--seq-4)" fill-opacity=".75" stroke="var(--map-bg)" stroke-width="1.5"/>';
        });
    }
    return '<svg viewBox="0 0 200 130" role="img" aria-label="Illustrasjon av karttypen" xmlns="http://www.w3.org/2000/svg">' + bg + body + "</svg>";
  }

  // ------------------------------------------------------------ Planvisning
  function section(title, num, children, cls) {
    return el("section", { class: "plan-section" + (cls ? " " + cls : "") }, [
      el("h3", {}, [el("span", { class: "step-num", text: num }), title])
    ].concat(children));
  }

  function render(opts) {
    var plan = P.buildPlan(opts.text, { tool: opts.tool, deliverable: opts.deliverable, place: opts.place, available: available, recipe: opts.recipe });
    var script = G.generate(plan);
    if (!placeTouched) placeEl.value = plan.place && plan.place.type !== "land" ? plan.place.name : "";
    var box = $("#plan");
    box.textContent = "";

    // Sammendrag
    var pills = el("div", { class: "plan-pills" });
    function pill(label, value, auto) { pills.appendChild(el("span", { class: "pill", text: label + ": " + value + (auto ? " (auto)" : "") })); }
    pill("Område", plan.place ? plan.place.name : "ikke angitt", !opts.place && plan.place);
    pill("Verktøy", plan.toolLabel, !opts.tool);
    pill("Leveranse", plan.deliverableLabel, !opts.deliverable);
    pill("Karttype", plan.mapType.name, false);
    pill("Tidsestimat", "ca. " + plan.totalMinutes + " min", false);

    var head = el("div", { class: "plan-head" }, [
      el("p", { class: "eyebrow", text: "Plan" }),
      el("h2", { text: plan.recipe.name }),
      el("p", { class: "muted", text: plan.recipe.description }),
      pills
    ]);
    if (plan.otherRecipes.length) {
      var alt = el("p", { class: "small muted alt-recipes" }, ["Mente du heller: "]);
      plan.otherRecipes.forEach(function (r, i) {
        var b = el("button", { type: "button", class: "link-btn", text: r.name });
        b.addEventListener("click", function () { submit({ recipe: r.id }); });
        if (i) alt.appendChild(document.createTextNode(" · "));
        alt.appendChild(b);
      });
      head.appendChild(alt);
    }
    if (!plan.place) head.appendChild(el("p", { class: "small warn-text", text: "Skriv inn en kommune for å få data avgrenset til området. Uten kommune lastes landsdekkende data ned." }));
    box.appendChild(head);

    // 1. Data
    var dataList = el("ul", { class: "data-list" });
    plan.roles.forEach(function (role) {
      var ds = role.dataset;
      var d = G.describe(ds, role, plan);
      var status = d.auto ? el("span", { class: "badge fit", text: "Lastes ned av skriptet" }) : el("span", { class: "badge warn", text: "Manuell nedlasting" });
      var save = el("button", { type: "button", class: "btn small ghost r-save" });
      var L = window.DatafinnerList;
      if (L) {
        L.mark(save, L.has(ds.id));
        save.addEventListener("click", function () {
          L.toggle(ds, save, { why: plan.text, tool: plan.toolLabel });
          L.mark(save, L.has(ds.id));
        });
      } else save.remove();
      var li = el("li", { class: "data-item" }, [
        el("div", { class: "data-role", text: role.label + (role.optional ? " (valgfritt)" : "") }),
        el("div", { class: "data-main" }, [link(ds.url, ds.name), el("span", { class: "muted small", text: " · " + ds.provider + " · " + ds.license })]),
        el("div", { class: "data-meta" }, [status, d.jobs.filter(function (j) { return j.auto; }).length ? el("span", { class: "small muted", text: d.jobs.filter(function (j) { return j.auto; }).map(function (j) { return j.label; }).join(" · ") }) : null, save])
      ]);
      if (role.targets && plan.targets.length) li.appendChild(el("p", { class: "small", text: "Målpunkter: " + plan.targets.map(function (t) { return K.TARGETS[t].label; }).join(", ") }));
      if (d.manual.length) li.appendChild(el("p", { class: "small warn-text", text: d.manual[0].reason }));
      if (role.alternatives.length) {
        var alts = el("p", { class: "small muted" }, ["Alternativer: "]);
        role.alternatives.forEach(function (a, i) { if (i) alts.appendChild(document.createTextNode(", ")); alts.appendChild(link(a.url, a.name)); });
        li.appendChild(alts);
      }
      dataList.appendChild(li);
    });
    box.appendChild(section("Data du trenger", "1", [dataList]));

    // 2. Nedlastingsprogram
    var dlBtn = el("button", { type: "button", class: "btn primary", text: "Last ned " + script.filename });
    dlBtn.addEventListener("click", function () {
      var ok = downloadFile(script.filename, script.code, "text/x-python;charset=utf-8");
      if (!ok) copyText(script.code, dlBtn);
    });
    var cpBtn = el("button", { type: "button", class: "btn", text: "Kopier skriptet" });
    cpBtn.addEventListener("click", function () { copyText(script.code, cpBtn); });
    var codeBox = el("details", { class: "code-details" }, [
      el("summary", { text: "Vis skriptet (" + script.code.split("\n").length + " linjer)" }),
      el("pre", {}, [el("code", { text: script.code })])
    ]);
    var scriptChildren = [
      el("p", { text: "Skriptet henter " + script.autoCount + " datasett automatisk, avgrenset til " + (plan.place ? plan.place.name : "hele landet") + ", i formater som passer for " + plan.toolLabel + ". Det trenger bare Python, ingen ekstra pakker." }),
      el("div", { class: "actions" }, [dlBtn, cpBtn]),
      el("p", { class: "small" }, [el("b", { text: "Slik kjører du det: " }), plan.phases[0].steps[0]]),
      el("p", { class: "small muted", text: "Resultatet havner i mappen «" + script.outDir + "» med en LES_MEG.txt som viser hva som ble hentet, og kildeteksten du skal bruke på kartet. Feiler en kilde, fortsetter skriptet med de andre." })
    ];
    if (script.manual.length) {
      var ml = el("ul", { class: "small" });
      script.manual.forEach(function (m) { ml.appendChild(el("li", {}, [link(m.url, m.label), " – " + m.reason])); });
      scriptChildren.push(el("p", { class: "small", text: "Last ned disse manuelt:" }), ml);
    }
    scriptChildren.push(codeBox);
    box.appendChild(section("Nedlastingsprogram", "2", scriptChildren));

    // 3. Fremgangsmåte
    var phases = el("ol", { class: "phases" });
    plan.phases.forEach(function (ph) {
      var steps = el(ph.code ? "div" : "ul", { class: "phase-steps" });
      if (ph.code) steps.appendChild(el("pre", {}, [el("code", { text: ph.steps.join("\n") })]));
      else ph.steps.forEach(function (s) { steps.appendChild(el("li", { text: s })); });
      phases.appendChild(el("li", { class: "phase" }, [
        el("div", { class: "phase-head" }, [el("b", { text: ph.title }), el("span", { class: "time", text: "ca. " + ph.minutes + " min" })]),
        steps
      ]));
    });
    var stepsChildren = [el("p", { class: "muted small", text: "Raskeste vei til ferdig kart i " + plan.toolLabel + ". Tidene gjelder når du kjenner verktøyet." }), phases];
    if (plan.tips.length) {
      var tl = el("ul", { class: "small" });
      plan.tips.forEach(function (t) { tl.appendChild(el("li", { text: t })); });
      stepsChildren.push(el("p", { class: "small", text: "Verdt å vite for denne oppgaven:" }), tl);
    }
    box.appendChild(section("Fremgangsmåte", "3", stepsChildren));

    // 4. Karttype og eksempler
    var mt = plan.mapType;
    var tips = el("ul", { class: "small" });
    mt.tips.forEach(function (t) { tips.appendChild(el("li", { text: t })); });
    var ex = el("ul", { class: "small examples-list" });
    mt.examples.forEach(function (e) { ex.appendChild(el("li", {}, [link(e.url, e.title + " ↗")])); });
    ex.appendChild(el("li", {}, [link("https://register.geonorge.no/kartografi", "Geonorge – ferdige tegneregler (lyrx/qml) ↗")]));
    box.appendChild(section("Karttype og gode eksempler", "4", [
      el("div", { class: "maptype" }, [
        el("div", { class: "maptype-figure", html: mapSvg(plan.mapTypeKey) }),
        el("div", { class: "maptype-text" }, [
          el("h4", { text: mt.name }),
          el("p", { class: "small", text: mt.when }),
          el("p", { class: "small" }, [el("b", { text: "I " + plan.toolLabel + ": " }), mt.symbology[plan.tool] || mt.symbology.arcgis]),
          tips
        ])
      ]),
      el("p", { class: "small", text: "Se gode eksempler:" }),
      ex
    ]));

    // Sidenotat: hvor bør kartet lages?
    var top = plan.platforms[0], second = plan.platforms[1];
    var others = el("ul", { class: "small platform-others" });
    plan.platforms.slice(2).forEach(function (p) {
      others.appendChild(el("li", {}, [el("b", { text: p.label }), (p.available ? "" : " (ikke tilgjengelig for deg)") + " – " + (p.reasons[0] || p.strength)]));
    });
    function platformBlock(p, label) {
      var r = el("ul", { class: "small" });
      p.reasons.forEach(function (x) { r.appendChild(el("li", { text: x })); });
      return el("div", { class: "platform" }, [
        el("p", { class: "eyebrow", text: label }),
        el("h4", {}, [p.label, p.available ? null : el("span", { class: "badge warn", text: "Ikke tilgjengelig for deg" })]),
        el("p", { class: "small muted", text: p.strength }),
        r
      ]);
    }
    box.appendChild(el("aside", { class: "plan-section sidenote" }, [
      el("h3", { text: "Sidenotat: hvor bør du lage kartet?" }),
      el("p", { class: "small muted", text: "Vurdert ut fra leveranse (" + plan.deliverableLabel.toLowerCase() + "), karttype og data." }),
      el("div", { class: "platforms" }, [platformBlock(top, "Beste valg"), platformBlock(second, "Godt alternativ")]),
      el("p", { class: "small", text: "Andre muligheter:" }),
      others
    ]));

    // 5. Sjekkliste
    var cl = el("ul", { class: "checklist" });
    plan.checklist.forEach(function (c, i) {
      var id = "chk-" + i;
      cl.appendChild(el("li", {}, [el("label", { class: "check", for: id }, [el("input", { type: "checkbox", id: id }), " " + c])]));
    });
    box.appendChild(section("Sjekkliste før du leverer", "5", [cl]));

    // Eksport
    var md = toMarkdown(plan, script);
    var mdCopy = el("button", { type: "button", class: "btn", text: "Kopier planen (Markdown)" });
    mdCopy.addEventListener("click", function () { copyText(md, mdCopy); });
    var mdDl = el("button", { type: "button", class: "btn", text: "Last ned planen (.md)" });
    mdDl.addEventListener("click", function () { if (!downloadFile(script.filename.replace(/^last_ned_/, "plan_").replace(/\.py$/, ".md"), md, "text/markdown;charset=utf-8")) copyText(md, mdDl); });
    box.appendChild(el("div", { class: "actions plan-export" }, [mdCopy, mdDl]));

    box.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  }

  function toMarkdown(plan, script) {
    var L = [];
    L.push("# Plan: " + plan.recipe.name, "");
    L.push("**Oppgave:** " + plan.text, "");
    L.push("- Område: " + (plan.place ? plan.place.name : "hele landet"));
    L.push("- Verktøy: " + plan.toolLabel);
    L.push("- Leveranse: " + plan.deliverableLabel);
    L.push("- Karttype: " + plan.mapType.name);
    L.push("- Tidsestimat: ca. " + plan.totalMinutes + " min", "");
    L.push("## 1. Data", "");
    plan.roles.forEach(function (r) {
      var d = G.describe(r.dataset, r, plan);
      L.push("- **" + r.label + ":** [" + r.dataset.name + "](" + r.dataset.url + ") – " + r.dataset.provider + ", " + r.dataset.license + (d.auto ? " (hentes av skriptet)" : " (manuell nedlasting)"));
    });
    L.push("", "## 2. Nedlasting", "", "Kjør `" + script.filename + "`: " + plan.phases[0].steps[0], "");
    L.push("## 3. Fremgangsmåte", "");
    plan.phases.forEach(function (p, i) {
      L.push("### " + (i + 1) + ". " + p.title + " (ca. " + p.minutes + " min)", "");
      if (p.code) L.push("```python", p.steps.join("\n"), "```", "");
      else { p.steps.forEach(function (s) { L.push("- " + s); }); L.push(""); }
    });
    L.push("## 4. Karttype: " + plan.mapType.name, "", plan.mapType.when, "");
    plan.mapType.tips.forEach(function (t) { L.push("- " + t); });
    L.push("", "Eksempler:");
    plan.mapType.examples.forEach(function (e) { L.push("- [" + e.title + "](" + e.url + ")"); });
    L.push("", "## Hvor bør kartet lages?", "");
    plan.platforms.slice(0, 2).forEach(function (p, i) {
      L.push("- **" + (i ? "Alternativ" : "Beste valg") + ": " + p.label + "** – " + p.reasons.join(" "));
    });
    L.push("", "## Sjekkliste", "");
    plan.checklist.forEach(function (c) { L.push("- [ ] " + c); });
    L.push("", "_Laget med Datafinner_");
    return L.join("\n");
  }

  // ------------------------------------------------------------ Oppstart
  var params = new URLSearchParams(location.search);
  if (params.get("oppgave")) {
    taskEl.value = params.get("oppgave");
    placeEl.value = params.get("sted") || "";
    placeTouched = !!params.get("sted");
    setRadio("ptool", params.get("verktoy") || "");
    setRadio("pdeliv", params.get("leveranse") || "");
    if (!location.hash) location.hash = "#planlegg";
  } else if (params.get("q") || params.get("why")) {
    if (!location.hash) location.hash = "#sok";
  }
  route();
  if (taskEl.value) {
    currentPlanOptions = { text: taskEl.value.trim(), tool: radio("ptool"), deliverable: radio("pdeliv"), place: placeEl.value.trim() };
    render(currentPlanOptions);
    window.scrollTo(0, 0);
  }
})();
