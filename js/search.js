/*
 * Søkemotor-logikk. Ren JavaScript uten avhengigheter, slik at den kan
 * brukes både i nettleseren og testes med Node (`node tests/search.test.js`).
 */
(function (root) {
  "use strict";

  // ---------------------------------------------------------------- Verktøy
  // Hvilke formater hvert verktøy håndterer best (rekkefølge = preferanse).
  var TOOLS = {
    arcgis: {
      label: "ArcGIS Pro",
      formats: ["FGDB", "Feature Service", "Image Service", "Vector Tiles", "GeoTIFF", "GeoPackage", "Shapefile", "WMS", "WFS", "WCS", "NetCDF", "CSV", "XLSX", "GeoJSON", "LAZ", "JP2", "HDF", "GRIB", "ESRI ASCII"],
      keywords: ["arcgis", "arcgis pro", "esri", "arcmap", "arcpy"]
    },
    qgis: {
      label: "QGIS",
      formats: ["GeoPackage", "GeoTIFF", "Shapefile", "GeoJSON", "WMS", "WFS", "WCS", "FGDB", "CSV", "NetCDF", "GeoParquet", "LAZ", "PBF", "XLSX", "SOSI", "JP2", "TopoJSON", "ESRI ASCII", "GML", "PostGIS"],
      keywords: ["qgis"]
    },
    vscode: {
      label: "VS Code / Python",
      formats: ["CSV", "Parquet", "GeoParquet", "GeoJSON", "GeoPackage", "JSON", "REST API", "NetCDF", "GeoTIFF", "Shapefile", "FGDB", "JSON-stat", "STAC API", "XLSX", "TSV", "GTFS", "LAZ", "OPeNDAP", "GRIB", "HDF", "PBF", "ARFF"],
      keywords: ["vs code", "vscode", "visual studio code", "python", "jupyter", "notebook", "pandas", "geopandas", "kode", "code", "script", "programmering"]
    },
    excel: {
      label: "Excel / Power BI",
      formats: ["XLSX", "CSV", "TSV", "JSON", "REST API"],
      keywords: ["excel", "power bi", "powerbi", "regneark", "spreadsheet"]
    }
  };

  // ---------------------------------------------------------------- Formål
  var PURPOSES = {
    analyse: { label: "Romlig/statistisk analyse", keywords: ["analyse", "analysere", "analysis", "beregne", "beregning", "undersøke", "sammenligne", "kartlegge", "kartlegging", "nettverksanalyse", "overlay"] },
    visualisering: { label: "Kart og visualisering", keywords: ["kart", "visualisere", "visualisering", "visualization", "presentasjon", "dashboard", "plakat", "figur", "lage kart", "kartografi", "storymap"] },
    maskinlaering: { label: "Maskinlæring / AI", keywords: ["maskinlæring", "maskinlaering", "machine learning", "ml", "ai", "kunstig intelligens", "deep learning", "trene", "modell", "prediksjon", "predikere", "klassifisering", "nevrale"] },
    forskning: { label: "Forskning / masteroppgave", keywords: ["forskning", "research", "master", "masteroppgave", "phd", "doktorgrad", "artikkel", "studie", "vitenskap"] },
    undervisning: { label: "Undervisning / skoleoppgave", keywords: ["undervisning", "skole", "oppgave", "bachelor", "bacheloroppgave", "eksamen", "kurs", "lære", "student", "øving", "teaching"] },
    app: { label: "App / webutvikling", keywords: ["app", "nettside", "webapp", "web", "applikasjon", "tjeneste", "api", "integrasjon", "sanntid", "realtime"] }
  };

  var REGIONS = {
    Norge: ["norge", "norsk", "norske", "norway", "norwegian", "oslo", "bergen", "trondheim", "stavanger", "tromsø", "kommune", "fylke", "vestland", "viken", "nordland", "innlandet", "agder", "rogaland", "finnmark", "troms"],
    Europa: ["europa", "europe", "eu", "europeisk", "european", "sverige", "danmark", "finland", "tyskland"],
    Global: ["global", "verden", "world", "worldwide", "alle land", "internasjonal"]
  };

  // Synonymer: et søkeord utvides til relaterte ord (norsk ⇄ engelsk m.m.).
  var SYNONYMS = {
    flom: ["flood", "flomsone", "oversvømmelse", "vannføring", "elv", "nedbør"],
    flood: ["flom"],
    "oversvømmelse": ["flom", "flood"],
    skred: ["ras", "landslide", "avalanche", "kvikkleire", "snøskred", "naturfare"],
    ras: ["skred", "landslide"],
    naturfare: ["flom", "skred", "kvikkleire", "hazard"],
    klimatilpasning: ["flom", "skred", "klima", "nedbør", "havnivå"],
    "høyde": ["dtm", "dom", "dem", "elevation", "terreng", "høydemodell"],
    "høydemodell": ["dtm", "dem", "terreng", "høyde"],
    terreng: ["dtm", "dem", "høyde", "helning"],
    dem: ["dtm", "elevation", "høyde"],
    elevation: ["høyde", "dem", "dtm"],
    helning: ["slope", "terreng", "dtm"],
    lidar: ["laser", "punktsky", "point cloud"],
    laser: ["lidar", "punktsky"],
    vei: ["veg", "road", "vegnett", "transport", "trafikk"],
    veg: ["vei", "road", "vegnett"],
    road: ["vei", "veg"],
    trafikk: ["traffic", "vei", "ådt", "ulykker"],
    ulykker: ["trafikkulykker", "accidents"],
    kollektiv: ["buss", "tog", "gtfs", "transit", "holdeplass"],
    buss: ["kollektiv", "gtfs", "holdeplass"],
    tog: ["jernbane", "kollektiv", "gtfs"],
    tilgjengelighet: ["kollektiv", "vei", "nettverksanalyse", "befolkning"],
    bygning: ["bygninger", "building", "buildings", "bygningsomriss", "hus"],
    bygninger: ["bygning", "building"],
    hus: ["bygning", "bolig"],
    befolkning: ["population", "innbyggere", "bosatte", "demografi", "befolkningstetthet"],
    innbyggere: ["befolkning", "population"],
    population: ["befolkning"],
    demografi: ["befolkning", "demography", "alder"],
    statistikk: ["statistics", "ssb", "tabell"],
    inntekt: ["økonomi", "income", "lønn"],
    "økonomi": ["economy", "bnp", "gdp", "inntekt"],
    "vær": ["weather", "temperatur", "nedbør", "vind", "klima"],
    klima: ["climate", "temperatur", "nedbør", "klimadata", "vær"],
    klimaendringer: ["klima", "climate", "klimaframskrivning", "temperatur", "co2"],
    temperatur: ["temperature", "vær", "klima"],
    "nedbør": ["precipitation", "regn", "vær", "klima"],
    regn: ["nedbør", "precipitation"],
    "snø": ["snow", "snødybde", "snøskred"],
    satellitt: ["satellite", "sentinel", "landsat", "fjernmåling", "remote sensing"],
    satellittbilder: ["satellitt", "sentinel", "landsat", "imagery"],
    "fjernmåling": ["satellitt", "remote sensing"],
    flyfoto: ["ortofoto", "imagery", "aerial"],
    ortofoto: ["flyfoto", "imagery", "satellitt"],
    ndvi: ["sentinel-2", "vegetasjon", "satellitt"],
    vegetasjon: ["ndvi", "skog", "arealdekke"],
    skog: ["forest", "tree cover", "arealdekke", "ar5"],
    avskoging: ["deforestation", "skog", "forest loss"],
    arealbruk: ["land use", "arealdekke", "ar5"],
    arealdekke: ["land cover", "arealbruk"],
    jordbruk: ["landbruk", "agriculture", "dyrka mark", "ar5"],
    landbruk: ["jordbruk", "agriculture"],
    natur: ["nature", "verneområde", "naturtype", "biologisk mangfold"],
    vern: ["verneområde", "nasjonalpark", "protected areas"],
    "verneområder": ["verneområde", "nasjonalpark"],
    nasjonalpark: ["verneområde", "protected areas"],
    arter: ["species", "artsfunn", "biodiversity", "occurrence"],
    fugl: ["arter", "birds", "species"],
    biologisk: ["biodiversity", "arter"],
    geologi: ["geology", "berggrunn", "løsmasser"],
    grunnvann: ["groundwater", "brønn", "geologi"],
    radon: ["geologi", "helse"],
    hav: ["ocean", "marine", "havbunn", "kyst", "sjø"],
    sjø: ["hav", "kyst", "marine"],
    kyst: ["hav", "coastline", "kystlinje"],
    dybde: ["bathymetry", "havbunn"],
    fiske: ["fisheries", "akvakultur", "oppdrett"],
    oppdrett: ["akvakultur", "aquaculture", "laks"],
    elv: ["river", "vassdrag", "elvenett"],
    innsjø: ["lake", "vann", "vassdrag"],
    vann: ["vassdrag", "elv", "innsjø", "water", "hydrologi"],
    "nedbørfelt": ["catchment", "watershed", "vassdrag"],
    energi: ["energy", "kraft", "vannkraft", "strøm"],
    strøm: ["energi", "kraftlinje", "kraft"],
    vindkraft: ["energi", "vind"],
    grense: ["grenser", "boundaries", "kommunegrenser"],
    grenser: ["grense", "boundaries"],
    kommune: ["kommunegrenser", "administrative", "kommunestatistikk"],
    kommuner: ["kommune", "kommunegrenser"],
    fylke: ["fylkesgrenser", "administrative"],
    land: ["countries", "landegrenser"],
    verdenskart: ["world map", "countries", "natural earth"],
    adresse: ["adresser", "address", "geokoding"],
    adresser: ["adresse", "address"],
    stedsnavn: ["place names", "navn"],
    grunnkart: ["basemap", "topografi", "basiskart"],
    bakgrunnskart: ["basemap", "grunnkart"],
    kart: ["basemap", "grunnkart"],
    helse: ["health", "sykdom"],
    co2: ["utslipp", "emissions", "klima"],
    utslipp: ["co2", "emissions"],
    tekst: ["nlp", "text", "språkmodell"],
    bilder: ["images", "imagery"],
    tidsserie: ["time series"],
    sanntid: ["realtime", "api"]
  };

  var STOPWORDS = ["og", "i", "på", "til", "for", "av", "med", "som", "en", "et", "ei", "jeg", "vi", "skal", "vil", "har", "er", "det", "den", "de", "å", "om", "fra", "trenger", "bruke", "lage", "finne", "data", "datasett", "dataset", "datasets", "the", "and", "of", "to", "in", "a", "an", "want", "need", "hvor", "hva", "hvordan", "kan", "meg", "min", "mitt", "mine", "noe", "litt", "gjerne", "eller", "ved", "inn", "ut", "bruk", "laste", "ned", "nedlasting", "about", "over", "under", "mellom", "alle"];

  // ---------------------------------------------------------------- Hjelpere
  function normalize(str) {
    return String(str || "").toLowerCase().replace(/[^a-z0-9æøåäöü\s\-]/gi, " ").replace(/\s+/g, " ").trim();
  }

  function tokenize(str) {
    return normalize(str).split(" ").filter(function (t) {
      return t.length > 1 && STOPWORDS.indexOf(t) === -1;
    });
  }

  function containsPhrase(text, phrase) {
    // Ordgrense-sjekk, slik at f.eks. "ml" ikke treffer "html".
    var re = new RegExp("(^|[^a-z0-9æøå])" + phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "($|[^a-z0-9æøå])", "i");
    return re.test(text);
  }

  /** Finn verktøy, formål og region nevnt i fritekst. */
  function detectIntent(text) {
    var t = normalize(text);
    var intent = { tools: [], purposes: [], regions: [] };
    Object.keys(TOOLS).forEach(function (k) {
      if (TOOLS[k].keywords.some(function (kw) { return containsPhrase(t, kw); })) intent.tools.push(k);
    });
    Object.keys(PURPOSES).forEach(function (k) {
      if (PURPOSES[k].keywords.some(function (kw) { return containsPhrase(t, kw); })) intent.purposes.push(k);
    });
    Object.keys(REGIONS).forEach(function (k) {
      if (REGIONS[k].some(function (kw) { return containsPhrase(t, kw); })) intent.regions.push(k);
    });
    return intent;
  }

  /** Kvalitetsscore 1–5 basert på kilde, lisens, dokumentasjon og vedlikehold. */
  function qualityScore(ds) {
    var q = ds.quality || {};
    var score = 1;
    if (q.official) score += 1.25;
    if (q.licenseClear) score += 1;
    if (q.documented) score += 1;
    if (q.maintained) score += 0.75;
    return Math.round(Math.min(5, score) * 2) / 2; // halve stjerner
  }

  function qualityReasons(ds) {
    var q = ds.quality || {};
    return [
      { ok: !!q.official, text: q.official ? "Offisiell / autoritativ kilde" : "Ikke offisiell myndighetskilde" },
      { ok: !!q.licenseClear, text: q.licenseClear ? "Tydelig åpen lisens" : "Lisens varierer – sjekk før bruk" },
      { ok: !!q.documented, text: q.documented ? "God dokumentasjon/metadata" : "Varierende dokumentasjon" },
      { ok: !!q.maintained, text: q.maintained ? "Aktivt vedlikeholdt" : "Oppdateres sjelden" }
    ];
  }

  /** Hvor godt passer datasettet med valgt verktøy? Returnerer 0–1 og beste format. */
  function toolFit(ds, toolKey) {
    var tool = TOOLS[toolKey];
    if (!tool) return { fit: 0, formats: [] };
    var matching = tool.formats.filter(function (f) { return ds.formats.indexOf(f) !== -1; });
    if (!matching.length) return { fit: 0, formats: [] };
    var bestIdx = tool.formats.indexOf(matching[0]);
    var fit = 1 - bestIdx / (tool.formats.length * 1.5);
    return { fit: Math.max(0.3, fit), formats: matching };
  }

  function expandTokens(tokens) {
    var out = [];
    tokens.forEach(function (t) {
      out.push({ term: t, weight: 1 });
      (SYNONYMS[t] || []).forEach(function (s) { out.push({ term: normalize(s), weight: 0.55 }); });
      // Enkel stamming for norsk/engelsk flertall og bestemt form.
      var stem = t.replace(/(ene|ane|er|en|et|a|s)$/, "");
      if (stem !== t && stem.length >= 4) {
        out.push({ term: stem, weight: 0.8, prefix: true });
        (SYNONYMS[stem] || []).forEach(function (s) { out.push({ term: normalize(s), weight: 0.5 }); });
      }
      // Norske sammensetninger og bøyninger: "flomsoner" → "flom", "veier" → "vei".
      if (!SYNONYMS[t]) {
        Object.keys(SYNONYMS).forEach(function (key) {
          if (key === t || t.indexOf(key) !== 0) return;
          var rest = t.length - key.length;
          if (key.length >= 4 || rest <= 3) {
            out.push({ term: key, weight: 0.8 });
            SYNONYMS[key].forEach(function (s) { out.push({ term: normalize(s), weight: 0.45 }); });
          }
        });
      }
    });
    // Fjern duplikater (behold høyeste vekt)
    var best = {};
    out.forEach(function (x) {
      if (!best[x.term] || best[x.term].weight < x.weight) best[x.term] = x;
    });
    return Object.keys(best).map(function (k) { return best[k]; });
  }

  function textMatchScore(ds, terms) {
    if (!terms.length) return { score: 0, matched: [] };
    var fields = [
      { text: normalize(ds.name), w: 4 },
      { text: normalize(ds.tags.join(" | ")), w: 3 },
      { text: normalize(ds.categories.join(" ")), w: 2.5 },
      { text: normalize(ds.description), w: 1.5 },
      { text: normalize(ds.provider), w: 1.5 },
      { text: normalize(ds.formats.join(" ")), w: 1 }
    ];
    var score = 0;
    var matched = [];
    terms.forEach(function (t) {
      var best = 0;
      fields.forEach(function (f) {
        var hit = t.prefix ? f.text.indexOf(t.term) !== -1 : containsPhrase(f.text, t.term) || (t.term.length >= 5 && f.text.indexOf(t.term) !== -1);
        if (hit && f.w > best) best = f.w;
      });
      if (best > 0) {
        score += best * t.weight;
        if (t.weight >= 0.8) matched.push(t.term);
      }
    });
    return { score: score, matched: matched };
  }

  /**
   * Hovedfunksjon.
   * options: { query, purposeText, tool, purpose, region, maxResults, includeLogin }
   * - query:       hva du leter etter ("flomsoner i Bergen")
   * - purposeText: hvorfor / hva du skal bruke det til (fritekst)
   * - tool:        nøkkel i TOOLS ("arcgis", "vscode", ...) eller "" for automatisk
   * - purpose:     nøkkel i PURPOSES eller "" for automatisk
   * - region:      "Norge" | "Europa" | "Global" | ""
   */
  function search(datasets, options) {
    options = options || {};
    var query = options.query || "";
    var purposeText = options.purposeText || "";
    var combined = query + " " + purposeText;

    var intent = detectIntent(combined);
    var tool = options.tool || intent.tools[0] || "";
    var purpose = options.purpose || intent.purposes[0] || "";
    var region = options.region || "";
    var detectedRegion = intent.regions[0] || "";

    // Fjern ord som bare beskriver verktøy/formål fra innholdssøket
    var metaWords = [];
    Object.keys(TOOLS).forEach(function (k) { metaWords = metaWords.concat(TOOLS[k].keywords); });
    Object.keys(PURPOSES).forEach(function (k) { metaWords = metaWords.concat(PURPOSES[k].keywords.filter(function (w) { return w !== "kart"; })); });

    var queryTokens = tokenize(query).filter(function (t) { return metaWords.indexOf(t) === -1; });
    var purposeTokens = tokenize(purposeText).filter(function (t) { return metaWords.indexOf(t) === -1; });

    var queryTerms = expandTokens(queryTokens);
    var purposeTerms = expandTokens(purposeTokens).map(function (t) {
      return { term: t.term, weight: t.weight * 0.6, prefix: t.prefix };
    });
    var hasText = queryTerms.length + purposeTerms.length > 0;

    var results = datasets.map(function (ds) {
      var q = textMatchScore(ds, queryTerms);
      var p = textMatchScore(ds, purposeTerms);
      var relevance = q.score + p.score;

      var fit = tool ? toolFit(ds, tool) : { fit: 1, formats: ds.formats };
      var quality = qualityScore(ds);
      var purposeMatch = purpose && ds.goodFor && ds.goodFor.indexOf(purpose) !== -1;

      var regionBoost = 1;
      if (region && ds.region !== region) regionBoost = 0; // eksplisitt filter
      else if (!region && detectedRegion) regionBoost = ds.region === detectedRegion ? 1.35 : 0.8;

      var score;
      if (hasText) {
        score = relevance;
        if (relevance > 0) {
          score *= 0.75 + quality / 10;              // kvalitet: 0.85–1.25
          score *= tool ? (fit.fit ? 0.6 + 0.5 * fit.fit : 0.25) : 1;
          score *= purposeMatch ? 1.25 : 1;
          score *= regionBoost;
          // Kataloger er nyttige som "fallback", men skal ikke dominere
          if (ds.categories.indexOf("katalog") !== -1) score *= 0.7;
        }
      } else {
        score = quality + (purposeMatch ? 2 : 0) + (tool && fit.fit ? 1.5 * fit.fit : 0);
        score *= regionBoost;
        if (tool && !fit.fit) score *= 0.3;
      }

      return {
        dataset: ds,
        score: score,
        quality: quality,
        toolFormats: fit.formats,
        toolFit: fit.fit,
        purposeMatch: !!purposeMatch,
        matched: q.matched.concat(p.matched)
      };
    }).filter(function (r) {
      if (r.score <= 0) return false;
      if (options.includeLogin === false && r.dataset.login) return false;
      return true;
    });

    results.sort(function (a, b) { return b.score - a.score || b.quality - a.quality; });

    if (hasText && results.length) {
      // Kutt svake treff (mindre enn 15 % av beste)
      var top = results[0].score;
      results = results.filter(function (r) { return r.score >= top * 0.15; });
    }
    if (options.maxResults) results = results.slice(0, options.maxResults);

    return {
      results: results,
      intent: { tool: tool, purpose: purpose, region: region || detectedRegion, detected: intent },
      terms: queryTokens.concat(purposeTokens)
    };
  }

  var api = {
    TOOLS: TOOLS,
    PURPOSES: PURPOSES,
    REGIONS: REGIONS,
    SYNONYMS: SYNONYMS,
    normalize: normalize,
    tokenize: tokenize,
    detectIntent: detectIntent,
    qualityScore: qualityScore,
    qualityReasons: qualityReasons,
    toolFit: toolFit,
    search: search
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.DatasetSearch = api;
})(this);
