/*
 * Live-søk i åpne datakataloger direkte fra nettleseren.
 * Hver kilde er "best effort": feiler en (nettverk/CORS), vises de andre likevel.
 */
(function (root) {
  "use strict";

  function withTimeout(promise, ms) {
    return Promise.race([
      promise,
      new Promise(function (_, reject) { setTimeout(function () { reject(new Error("Tidsavbrudd")); }, ms); })
    ]);
  }

  function getJSON(url) {
    return withTimeout(fetch(url, { headers: { Accept: "application/json" } }), 12000).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    });
  }

  function pickLang(obj) {
    if (!obj) return "";
    if (typeof obj === "string") return obj;
    return obj.nb || obj.no || obj.nn || obj.en || obj[Object.keys(obj)[0]] || "";
  }

  function strip(html) {
    return String(html || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  }

  var SOURCES = [
    {
      id: "geonorge",
      label: "Geonorge",
      region: "Norge",
      search: function (q) {
        var url = "https://kartkatalog.geonorge.no/api/search?limit=8&text=" + encodeURIComponent(q) +
          "&facets[0]name=type&facets[0]value=dataset";
        return getJSON(url).then(function (data) {
          return (data.Results || []).map(function (r) {
            return {
              title: r.Title,
              provider: r.Organization || "",
              description: strip(r.Abstract).slice(0, 220),
              url: r.ShowDetailsUrl || ("https://kartkatalog.geonorge.no/metadata/" + r.Uuid),
              formats: (r.DistributionFormats || []).map(function (f) { return f.Name; }).filter(Boolean).slice(0, 5),
              open: r.AccessIsOpendata === true || r.IsOpenData === true
            };
          });
        });
      }
    },
    {
      id: "europa",
      label: "data.europa.eu",
      region: "Europa",
      search: function (q) {
        var url = "https://data.europa.eu/api/hub/search/search?filter=dataset&limit=8&q=" + encodeURIComponent(q);
        return getJSON(url).then(function (data) {
          var list = (data.result && data.result.results) || [];
          return list.map(function (r) {
            return {
              title: pickLang(r.title),
              provider: (r.catalog && pickLang(r.catalog.title)) || (r.publisher && r.publisher.name) || "",
              description: strip(pickLang(r.description)).slice(0, 220),
              url: "https://data.europa.eu/data/datasets/" + r.id,
              formats: (r.distributions || []).map(function (d) { return d.format && (d.format.label || d.format.id); }).filter(Boolean).filter(function (v, i, a) { return a.indexOf(v) === i; }).slice(0, 5),
              open: true
            };
          });
        });
      }
    },
    {
      id: "zenodo",
      label: "Zenodo",
      region: "Global",
      search: function (q) {
        var url = "https://zenodo.org/api/records?size=8&sort=bestmatch&type=dataset&q=" + encodeURIComponent(q);
        return getJSON(url).then(function (data) {
          var hits = (data.hits && data.hits.hits) || [];
          return hits.map(function (r) {
            var md = r.metadata || {};
            return {
              title: md.title,
              provider: (md.creators && md.creators[0] && md.creators[0].name) || "",
              description: strip(md.description).slice(0, 220),
              url: (r.links && r.links.self_html) || ("https://zenodo.org/records/" + r.id),
              formats: (r.files || []).map(function (f) { var m = /\.([a-z0-9]+)$/i.exec(f.key || ""); return m ? m[1].toUpperCase() : null; }).filter(Boolean).filter(function (v, i, a) { return a.indexOf(v) === i; }).slice(0, 5),
              license: md.license && (md.license.id || md.license),
              open: true
            };
          });
        });
      }
    },
    {
      id: "huggingface",
      label: "Hugging Face",
      region: "Global",
      search: function (q) {
        var url = "https://huggingface.co/api/datasets?limit=8&sort=downloads&direction=-1&search=" + encodeURIComponent(q);
        return getJSON(url).then(function (list) {
          return (list || []).map(function (r) {
            return {
              title: r.id,
              provider: r.author || "",
              description: (r.downloads != null ? r.downloads.toLocaleString("nb-NO") + " nedlastinger" : "") + (r.likes ? " · " + r.likes + " likes" : ""),
              url: "https://huggingface.co/datasets/" + r.id,
              formats: (r.tags || []).filter(function (t) { return t.indexOf("format:") === 0; }).map(function (t) { return t.slice(7); }),
              open: true
            };
          });
        });
      }
    }
  ];

  /**
   * Søk i valgte kilder. onSource(sourceId, {items} | {error}) kalles per kilde.
   */
  function searchAll(query, sourceIds, onSource) {
    var chosen = SOURCES.filter(function (s) { return !sourceIds || sourceIds.indexOf(s.id) !== -1; });
    return Promise.all(chosen.map(function (s) {
      return s.search(query).then(function (items) {
        onSource(s, { items: items.filter(function (i) { return i.title; }) });
      }).catch(function (err) {
        onSource(s, { error: err.message || String(err) });
      });
    }));
  }

  root.LiveSearch = { SOURCES: SOURCES, searchAll: searchAll };
})(this);
