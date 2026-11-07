/*
 * Oppgaveplanlegger: gjør en fritekst-beskrivelse av en oppgave om til en plan
 * med data, fremgangsmåte, karttype og anbefalt plattform.
 * Ren logikk uten DOM, slik at den kan testes med Node.
 */
(function (root) {
  "use strict";

  var S = root.DatasetSearch || require("./search.js");
  var K = root.Knowledge || require("../data/recipes.js");
  var DATA = root.DATASETS || require("../data/datasets.js");

  var PLAN_TOOLS = {
    arcgis: "ArcGIS Pro",
    online: "ArcGIS Online",
    qgis: "QGIS",
    vscode: "VS Code / Python"
  };

  function byId(id) {
    for (var i = 0; i < DATA.length; i++) if (DATA[i].id === id) return DATA[i];
    return null;
  }

  function norm(t) { return S.normalize(t); }

  function hasAny(text, words) {
    var t = norm(text);
    return words.some(function (w) { return S.containsPhrase(t, norm(w)); });
  }

  // ------------------------------------------------------------ Gjenkjenning
  function detectPlace(text) {
    var raw = String(text || "");
    if (/\b(hele landet|hele norge|nasjonalt|landsdekkende)\b/i.test(raw)) return { name: "Hele landet", type: "land" };
    var caps = K.PLACES.capitalOnly;
    function find(list, type) {
      var sorted = list.slice().sort(function (a, b) { return b.length - a.length; });
      for (var i = 0; i < sorted.length; i++) {
        var name = sorted[i];
        var found;
        if (caps.indexOf(name) !== -1) {
          var re = new RegExp("(^|[^A-Za-zÆØÅæøå0-9])" + name.replace(/[-]/g, "\\-") + "($|[^A-Za-zÆØÅæøå0-9])");
          found = re.test(raw);
        } else {
          found = S.containsPhrase(norm(raw), norm(name));
        }
        if (found) return { name: name, type: type };
      }
      return null;
    }
    return find(K.PLACES.kommuner, "kommune") || find(K.PLACES.fylker, "fylke");
  }

  function detectDeliverable(text) {
    var best = "", bestN = 0;
    Object.keys(K.DELIVERABLES).forEach(function (k) {
      var n = K.DELIVERABLES[k].keywords.filter(function (w) { return hasAny(text, [w]); }).length;
      if (n > bestN) { best = k; bestN = n; }
    });
    return best;
  }

  function detectTargets(text) {
    return Object.keys(K.TARGETS).filter(function (k) { return hasAny(text, K.TARGETS[k].words); });
  }

  function detectHazards(text) {
    return Object.keys(K.HAZARDS).filter(function (k) { return hasAny(text, K.HAZARDS[k].words); });
  }

  function detectTool(text) {
    if (/arcgis online|\bagol\b|storymap|dashboards|map viewer|experience builder|portal for arcgis/i.test(text)) return "online";
    var t = S.detectIntent(text).tools;
    for (var i = 0; i < t.length; i++) if (PLAN_TOOLS[t[i]]) return t[i];
    return "";
  }

  var MAPTYPE_WORDS = [
    { type: "hotspot", words: ["varmekart", "heatmap", "heat map", "hotspot", "heksagon", "hexbin"] },
    { type: "flyt", words: ["flytkart", "flow map", "strømmer"] },
    { type: "tilgjengelighet", words: ["isokron", "isokroner", "serviceområde", "serviceområder"] },
    { type: "koroplet", words: ["koroplet", "per kommune", "per fylke", "kommunevis", "fylkesvis", "temakart"] },
    { type: "rutenett", words: ["rutenett", "ruter"] }
  ];

  function detectMapType(text) {
    for (var i = 0; i < MAPTYPE_WORDS.length; i++) {
      if (hasAny(text, MAPTYPE_WORDS[i].words)) return MAPTYPE_WORDS[i].type;
    }
    return "";
  }

  // ------------------------------------------------------------ Oppskrift
  function scoreRecipes(text) {
    var t = norm(text);
    return K.RECIPES.map(function (r) {
      var rel = S.relevance(text, { name: r.name, tags: r.keywords, description: r.description }).score;
      var phrases = r.keywords.filter(function (k) { return S.containsPhrase(t, norm(k)); }).length;
      return { recipe: r, score: rel + phrases * 2 };
    }).sort(function (a, b) { return b.score - a.score; });
  }

  // ------------------------------------------------------------ Datavalg
  function pickDatasets(role, searchScores, place) {
    var cands = role.candidates.map(byId).filter(Boolean);
    var max = 0;
    cands.forEach(function (d) { max = Math.max(max, searchScores[d.id] || 0); });
    var n = cands.length;
    var ranked = cands.map(function (d, i) {
      var s = (n - i) * 1.0;                                   // fagekspertens rekkefølge
      if (max > 0) s += ((searchScores[d.id] || 0) / max) * 1.5; // tilpasset teksten
      if (place && d.region !== "Norge") s -= 1;
      return { d: d, s: s };
    }).sort(function (a, b) { return b.s - a.s; });
    return ranked.map(function (x) { return x.d; });
  }

  // ------------------------------------------------------------ Plattform
  var DELIV_FIT = {
    rapport: { arcgis: 3, qgis: 3, vscode: 1.5, online: 1, kepler: 0.5, powerbi: 0.5 },
    nett: { online: 3, kepler: 2, vscode: 2, arcgis: 1.5, qgis: 1, powerbi: 1 },
    dashboard: { online: 3, powerbi: 3, vscode: 1.5, arcgis: 1, kepler: 0.5, qgis: 0 },
    presentasjon: { arcgis: 2.5, qgis: 2.5, online: 2, kepler: 2, vscode: 1.5, powerbi: 1.5 },
    analyse: { arcgis: 3, vscode: 3, qgis: 2.5, online: 1.5, powerbi: 0.5, kepler: 0.5 }
  };
  var DELIV_REASON = {
    rapport: { arcgis: "Layout gir full kontroll over tegnforklaring, målestokk og eksport til PDF i høy oppløsning.", qgis: "Print Layout gir like gode trykkekart som ArcGIS, og er gratis.", vscode: "matplotlib gir figurer til rapport, men det tar lengre tid å få et pent kart.", online: "Kan skrive ut, men gir lite kontroll over layout.", kepler: "Laget for skjerm, ikke trykk.", powerbi: "Laget for skjerm, ikke trykk." },
    nett: { online: "Del kartet med en lenke og tilgangsstyring i organisasjonen. Kan bygges ut til StoryMap.", kepler: "Gir et interaktivt kart på sekunder, og kan eksporteres som én HTML-fil.", vscode: "folium eller lonboard lager en HTML-fil du kan dele.", arcgis: "Publiser fra Pro til ArcGIS Online med Share → Web Map.", qgis: "qgis2web-pluginen lager et enkelt nettkart.", powerbi: "Fint hvis mottakerne allerede bruker Power BI." },
    dashboard: { online: "ArcGIS Dashboards kobler kart, tall og grafer, og oppdateres når dataene endres.", powerbi: "Kart sammen med tabeller og KPI-er. Godt egnet for tall per kommune.", vscode: "Streamlit eller Dash for egne dashboards med automatisk oppdatering.", arcgis: "Lag kartet her og publiser det til ArcGIS Online for dashboard.", kepler: "Ikke laget for dashboards.", qgis: "Ikke laget for dashboards." },
    presentasjon: { arcgis: "Eksporter et rent kart som PNG i 16:9.", qgis: "Eksporter et rent kart som PNG fra Print Layout.", online: "StoryMaps fungerer godt som presentasjon i seg selv.", kepler: "Animasjon over tid og 3D gir effekt i presentasjoner.", vscode: "Fint for grafer, mer arbeid for pene kart.", powerbi: "Fint hvis presentasjonen er et dashboard." },
    analyse: { arcgis: "Har flest ferdige analyseverktøy, inkludert Network Analyst.", vscode: "Analysen kan gjentas og dokumenteres i kode, og tåler store datamengder.", qgis: "Processing Toolbox dekker de fleste analyser, gratis.", online: "Enkle analyser, men de bruker kreditter.", powerbi: "Kun enkle beregninger.", kepler: "Kun visualisering, ingen analyse." }
  };
  var MAP_FIT = {
    flyt: { kepler: 2, vscode: 1, qgis: 0.5 },
    tilgjengelighet: { arcgis: 1.5, vscode: 1, online: 0.5 },
    hotspot: { kepler: 1, arcgis: 1, online: 0.5 },
    raster: { arcgis: 1, qgis: 1, vscode: 0.5, online: -1, kepler: -1, powerbi: -2 },
    tidsserie: { vscode: 1.5, kepler: 1, powerbi: 1 },
    koroplet: { powerbi: 1, online: 0.5 },
    kategori: { arcgis: 0.5, qgis: 0.5 },
    overlay: { arcgis: 0.5, qgis: 0.5 },
    linjer: { kepler: 0.5 },
    punkt: { online: 0.5, kepler: 0.5 },
    rutenett: {}
  };
  var MAP_REASON = {
    flyt: { kepler: "Har innebygde lag for flytlinjer.", vscode: "Lett å lage linjer fra en fra–til-tabell." },
    tilgjengelighet: { arcgis: "Network Analyst lager serviceområder direkte.", vscode: "osmnx og r5py beregner reisetid gratis." },
    hotspot: { kepler: "Viser heksagoner og varmekart for millioner av punkter.", arcgis: "Optimized Hot Spot Analysis finner statistisk signifikante klynger." },
    raster: { arcgis: "Spatial Analyst har helning, terrengskygge og sikt.", qgis: "Har alle terrengverktøyene innebygd.", online: "Rasteranalyse krever ekstra lisens." },
    tidsserie: { vscode: "pandas og xarray er laget for tidsserier.", kepler: "Kan animere data over tid.", powerbi: "Grafer over tid er standard." },
    koroplet: { powerbi: "Temakart per kommune passer godt i Power BI.", online: "Smart Mapping foreslår klasser og farger automatisk." }
  };

  function rankPlatforms(deliverable, mapType, chosenTool, available, realtime, bigData) {
    var keys = Object.keys(K.PLATFORMS);
    return keys.map(function (k) {
      var s = (DELIV_FIT[deliverable] || DELIV_FIT.rapport)[k] || 0;
      var reasons = [];
      var dr = (DELIV_REASON[deliverable] || DELIV_REASON.rapport)[k];
      if (dr) reasons.push(dr);
      var mf = (MAP_FIT[mapType] || {})[k] || 0;
      s += mf;
      var mr = (MAP_REASON[mapType] || {})[k];
      if (mr) reasons.push(mr);
      if (realtime && (k === "vscode" || k === "online")) {
        s += k === "vscode" ? 1 : 0.5;
        reasons.push(k === "vscode" ? "Sanntidsdata kan hentes på nytt automatisk med et skript." : "Kan vise lag som oppdateres jevnlig.");
      }
      if (bigData && (k === "vscode" || k === "kepler")) { s += 1; reasons.push("Tåler store datamengder."); }
      if (chosenTool && chosenTool === k) { s += 1; reasons.push("Det er verktøyet du har valgt."); }
      var isAvailable = !available || available.indexOf(k) !== -1;
      if (!isAvailable) s -= 3;
      return { key: k, label: K.PLATFORMS[k].label, url: K.PLATFORMS[k].url, strength: K.PLATFORMS[k].strength, score: s, reasons: reasons, available: isAvailable };
    }).sort(function (a, b) { return b.score - a.score; });
  }

  // ------------------------------------------------------------ Fremgangsmåte
  var RUN_SCRIPT = {
    arcgis: "Kjør skriptet med Python fra ArcGIS Pro: Start-menyen → ArcGIS → «Python Command Prompt», gå til mappen med cd og skriv: python {file}",
    online: "Kjør skriptet på PC-en (Python fra ArcGIS Pro eller VS Code): python {file}. Filene lastes opp til ArcGIS Online i neste steg.",
    qgis: "Kjør skriptet med Python: «OSGeo4W Shell» (følger med QGIS) eller vanlig Python 3: python {file}",
    vscode: "Åpne mappen i VS Code, Terminal → New Terminal, og kjør: python {file}"
  };

  var LOAD_STEPS = {
    arcgis: [
      "Opprett prosjekt: Project → New → Map. Lagre det i samme mappe som dataene.",
      "Kommunegrensen: Analysis → Tools → «JSON To Features» på 00_avgrensning/kommunegrense.geojson.",
      "Mapper som slutter på .gdb: Catalog → høyreklikk Databases → Add Database. Andre filer: Map → Add Data.",
      "Data som dekker mer enn området: Pairwise Clip mot kommunegrensen.",
      "Kartets koordinatsystem: Map Properties → Coordinate Systems → EUREF89 UTM sone 33 (EPSG 25833)."
    ],
    qgis: [
      "Project → New. Sett prosjektets CRS til EPSG:25833 nede til høyre.",
      "Dra kommunegrense.geojson og datafilene inn i kartet (zip-filer kan dras inn direkte).",
      "Data som dekker mer enn området: Vector → Geoprocessing → Clip mot kommunegrensen."
    ],
    vscode: [
      "pip install geopandas matplotlib folium mapclassify",
      "kommune = gpd.read_file(\"00_avgrensning/kommunegrense.geojson\").to_crs(25833)",
      "data = gpd.read_file(\"<fil fra nedlastingen>\").to_crs(25833)",
      "data = gpd.clip(data, kommune)"
    ],
    online: [
      "Content → New item → last opp zip-, GeoJSON- eller CSV-filene. Hver fil blir et lag.",
      "Åpne Map Viewer, legg til lagene og velg «Light Gray Canvas» som bakgrunnskart.",
      "Data som dekker mer enn området: Analysis → «Clip layer» (bruker kreditter)."
    ]
  };

  var FINISH = {
    arcgis: {
      rapport: ["Insert → New Layout → A4 eller A3 liggende.", "Insert → Map Frame, deretter Legend, Scale Bar og North Arrow.", "Legg inn tittel og kildetekst (se sjekklisten).", "Share → Export Layout → PDF eller PNG i 300 dpi."],
      nett: ["Share → Web Map, del med organisasjonen.", "Åpne kartet i ArcGIS Online og sett opp pop-ups med de viktigste feltene."],
      dashboard: ["Share → Web Map.", "Bygg dashboardet på arcgis.com: Create app → Dashboards, med kart, indikator og graf."],
      presentasjon: ["Insert → New Layout → Custom 33,867 × 19,05 cm (16:9).", "Export Layout → PNG i 150 dpi, og sett bildet inn i PowerPoint."],
      analyse: ["Table To Excel for resultattabellen.", "Behold resultatlagene i prosjektets geodatabase."]
    },
    qgis: {
      rapport: ["Project → New Print Layout. Add Item → Map, Legend, Scale Bar, North Arrow og Label.", "Layout → Export as PDF eller Image (300 dpi)."],
      nett: ["Plugins → qgis2web → Export (Leaflet) gir en nettside med kartet.", "Eller eksporter lagene som GeoJSON og åpne dem i kepler.gl eller ArcGIS Online."],
      dashboard: ["Eksporter resultatene (CSV/GeoJSON) og bygg dashboardet i Power BI eller ArcGIS Dashboards."],
      presentasjon: ["Print Layout i 16:9 → Export as Image (150 dpi)."],
      analyse: ["Høyreklikk laget → Export → Save Features As → XLSX eller CSV."]
    },
    vscode: {
      rapport: ["fig.savefig(\"kart.png\", dpi=300, bbox_inches=\"tight\")", "Tittel med ax.set_title, kilde med fig.text og målestokk med pip install matplotlib-scalebar."],
      nett: ["m = gdf.explore(); m.save(\"kart.html\") lager et interaktivt kart i én fil.", "Mange punkter: pip install lonboard."],
      dashboard: ["pip install streamlit streamlit-folium, og lag app.py med kartet og nøkkeltall.", "Start med: streamlit run app.py"],
      presentasjon: ["fig, ax = plt.subplots(figsize=(13.3, 7.5)) gir 16:9. savefig med dpi=150."],
      analyse: ["df.to_excel(\"resultat.xlsx\") eller gdf.to_file(\"resultat.gpkg\")."]
    },
    online: {
      rapport: ["Map Viewer → Print → velg A4/A3 og PDF.", "Trenger du mer kontroll: åpne kartet i ArcGIS Pro og bruk Layout."],
      nett: ["Save → Share med organisasjonen eller offentlig.", "Lag gjerne en StoryMap med kartet og forklarende tekst."],
      dashboard: ["Create app → Dashboards. Legg til kart, indikatorer og grafer fra de samme lagene."],
      presentasjon: ["StoryMaps «Briefing» er laget for presentasjoner."],
      analyse: ["Åpne laget i Data-fanen og eksporter til CSV eller Excel."]
    }
  };

  function sourceText(datasets) {
    var seen = {};
    var parts = [];
    datasets.forEach(function (d) {
      var key = d.provider + "|" + d.license;
      if (seen[key]) return;
      seen[key] = true;
      parts.push(d.provider + " (" + d.license + ")");
    });
    return "Kilde: " + parts.join(", ") + ", " + new Date().getFullYear() + ".";
  }

  // ------------------------------------------------------------ Hovedfunksjon
  /**
   * options: { tool, deliverable, place, available: ["arcgis", ...] }
   */
  function buildPlan(text, options) {
    options = options || {};
    text = String(text || "").trim();

    var recipeScores = scoreRecipes(text);
    var best = recipeScores[0];
    var recipe = best && best.score >= 3 ? best.recipe : K.GENERIC_RECIPE;
    if (options.recipe) {
      recipe = K.RECIPES.filter(function (r) { return r.id === options.recipe; })[0] || recipe;
    }

    var detectedPlace = detectPlace(text);
    var place = detectedPlace;
    if (options.place) {
      var isFylke = K.PLACES.fylker.some(function (f) { return f.toLowerCase() === options.place.toLowerCase(); });
      place = { name: options.place, type: isFylke ? "fylke" : "kommune" };
    }
    if (place && /^hele (landet|norge)$/i.test(place.name)) place = { name: "Hele landet", type: "land" };

    var detectedTool = detectTool(text);
    var tool = options.tool || detectedTool || "arcgis";
    var detectedDeliverable = detectDeliverable(text);
    var deliverable = options.deliverable || detectedDeliverable || "rapport";

    var mapTypeKey = detectMapType(text) || recipe.mapType;
    var mapType = K.MAPTYPES[mapTypeKey];

    var targets = detectTargets(text);
    if (!targets.length && recipe.targetsDefault) targets = recipe.targetsDefault.slice();
    var hazards = detectHazards(text);
    if (recipe.id === "naturfare" && !hazards.length) hazards = ["flom"];

    // Søkerelevans for alle datasett gir finjustering av valg per rolle
    var search = S.search(DATA, { query: text });
    var searchScores = {};
    search.results.forEach(function (r) { searchScores[r.dataset.id] = r.score; });

    var roles = recipe.roles.slice();
    if (recipe === K.GENERIC_RECIPE) {
      var top = search.results.slice(0, 4).map(function (r) { return r.dataset.id; });
      roles = top.length ? [{ key: "hoved", label: "Mest relevante datasett", candidates: top }] : [];
      if (place && place.type !== "land") roles.push({ key: "avgrensning", label: "Avgrensning", candidates: ["admin-enheter"] });
    }

    var planRoles = roles.map(function (role) {
      var ranked = pickDatasets(role, searchScores, place);
      return {
        key: role.key,
        label: role.label,
        optional: !!role.optional,
        targets: !!role.targets,
        dataset: ranked[0] || null,
        alternatives: ranked.slice(1)
      };
    }).filter(function (r) { return r.dataset; });

    var chosen = planRoles.map(function (r) { return r.dataset; });
    var realtime = chosen.some(function (d) { return /sanntid/i.test(d.updated); });
    var bigData = chosen.some(function (d) { return ["osm-geofabrik", "kystverket-ais", "nyc-taxi", "copernicus-dataspace", "overture", "pems"].indexOf(d.id) !== -1; });

    var platforms = rankPlatforms(deliverable, mapTypeKey, tool, options.available, realtime, bigData);

    var slug = (place && place.type !== "land" ? place.name + "_" : "") + recipe.id;
    slug = norm(slug).replace(/æ/g, "ae").replace(/ø/g, "o").replace(/å/g, "a").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    var scriptName = "last_ned_" + slug + ".py";

    var analysis = (recipe.analysis && (recipe.analysis[tool] || recipe.analysis.arcgis)) || [];
    var phases = [
      { title: "Hent data", minutes: 10, steps: [RUN_SCRIPT[tool].replace("{file}", scriptName), "Skriptet lager én mappe per datasett og en LES_MEG.txt med kilder og lisenser. Datasett som må lastes ned manuelt, står i listen over."] },
      { title: "Last inn og avgrens til området", minutes: 10, steps: LOAD_STEPS[tool].slice(), code: tool === "vscode" },
      { title: "Analyse", minutes: 20, steps: analysis.slice(), code: tool === "vscode" },
      { title: "Symboliser: " + mapType.name.toLowerCase(), minutes: 10, steps: [mapType.symbology[tool] || mapType.symbology.arcgis].concat(mapType.tips.slice(0, 2)) },
      { title: "Ferdigstill: " + K.DELIVERABLES[deliverable].label.toLowerCase(), minutes: 15, steps: (FINISH[tool][deliverable] || FINISH[tool].rapport).slice() }
    ];
    if (!place || place.type === "land") phases[1].steps = phases[1].steps.filter(function (s) { return !/kommunegrense|Clip/i.test(s); });

    var src = sourceText(chosen);
    var checklist = [
      "Tittel som sier hva kartet viser, hvor og når (f.eks. «Bygninger i flomsone, Bergen 2026»).",
      "Tegnforklaring med enhet.",
      "Målestokk, og nordpil på kart for trykk.",
      "Kildetekst: " + src,
      "Koordinatsystem: EUREF89 UTM sone 33 (EPSG:25833) for hele landet.",
      "Dempet bakgrunnskart slik at temaet ditt står fram.",
      "Fargeskala med god kontrast, også for fargeblinde (ColorBrewer)."
    ];

    return {
      text: text,
      recipe: recipe,
      recipeScore: best ? best.score : 0,
      otherRecipes: recipeScores.filter(function (x) { return x.score >= 3 && x.recipe !== recipe; }).slice(0, 3).map(function (x) { return x.recipe; }),
      place: place,
      detected: { place: detectedPlace, tool: detectedTool, deliverable: detectedDeliverable },
      tool: tool,
      toolLabel: PLAN_TOOLS[tool],
      deliverable: deliverable,
      deliverableLabel: K.DELIVERABLES[deliverable].label,
      mapTypeKey: mapTypeKey,
      mapType: mapType,
      targets: targets,
      hazards: hazards,
      roles: planRoles,
      platforms: platforms,
      phases: phases,
      totalMinutes: phases.reduce(function (a, p) { return a + p.minutes; }, 0),
      checklist: checklist,
      sourceText: src,
      tips: recipe.tips || [],
      scriptName: scriptName
    };
  }

  var api = {
    PLAN_TOOLS: PLAN_TOOLS,
    buildPlan: buildPlan,
    detectPlace: detectPlace,
    detectDeliverable: detectDeliverable,
    detectTargets: detectTargets,
    detectHazards: detectHazards,
    detectTool: detectTool,
    scoreRecipes: scoreRecipes
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Planner = api;
})(this);
