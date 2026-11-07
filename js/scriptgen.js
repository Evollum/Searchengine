/*
 * Lager et skreddersydd Python-skript som laster ned dataene i en plan.
 * Skriptet bruker bare Pythons standardbibliotek, slik at det kan kjøres med
 * Python fra ArcGIS Pro, QGIS (OSGeo4W) eller en vanlig Python-installasjon
 * uten «pip install».
 *
 * API-ene og feltnavnene er hentet fra åpen kildekode som bruker dem i dag:
 *  - Geonorge nedlasting: GET /api/codelists/area/{uuid}, POST /api/order,
 *    GET /api/order/{referenceNumber}
 *  - Kartverket kommuneinfo: /sok?knavn=, /kommuner/{nr}/omrade?utkoordsys=
 *  - SSB PxWebApi v2: /tables?query=, /tables/{id}/metadata, /tables/{id}/data
 *  - NVDB API Les v4: /vegobjekter/api/v4/vegobjekter/{type}?kartutsnitt=
 *  - Trafikkdata GraphQL, Entur Mobility GraphQL, Overpass API, Geonorge WCS
 */
(function (root) {
  "use strict";

  var DATA = root.DATASETS || require("../data/datasets.js");
  var K = root.Knowledge || require("../data/recipes.js");

  var UUID = {
    n50: "ea192681-d039-42ec-b1bc-f3ce04c189ac",       // N50 Kartdata
    kommuner: "041f1e6e-bdbc-4091-b48f-8a5990f3cc5b"   // Administrative enheter – kommuner
  };

  var FORMATS = {
    arcgis: ["FGDB", "GeoJSON", "GML", "SOSI"],
    online: ["GeoJSON", "FGDB", "GML", "SOSI"],
    qgis: ["GeoPackage", "GeoJSON", "FGDB", "SpatiaLite", "GML", "SOSI"],
    vscode: ["GeoPackage", "GeoJSON", "FGDB", "SpatiaLite", "GML", "SOSI"]
  };

  var OSM = {
    bygninger: { filter: "way[\"building\"]", mode: "geom", label: "Bygninger fra OpenStreetMap" },
    veger: { filter: "way[\"highway\"]", mode: "geom", label: "Veger fra OpenStreetMap" },
    sykkel: { filter: "way[\"highway\"~\"cycleway|footway|path|pedestrian\"]", mode: "geom", label: "Gang- og sykkelveger fra OpenStreetMap" },
    jernbane: { filter: "way[\"railway\"=\"rail\"]", mode: "geom", label: "Jernbane fra OpenStreetMap" }
  };

  function byId(id) {
    for (var i = 0; i < DATA.length; i++) if (DATA[i].id === id) return DATA[i];
    return null;
  }

  function py(s) { return JSON.stringify(String(s)); }
  function pyList(arr) { return "[" + arr.map(py).join(", ") + "]"; }

  function slug(s) {
    return String(s).toLowerCase()
      .replace(/æ/g, "ae").replace(/ø/g, "o").replace(/å/g, "a")
      .replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40);
  }

  function statQuery(plan) {
    var t = plan.text.toLowerCase();
    if (/befolkning|innbygger|folketall|folkemengde/.test(t)) return { table: "07459", label: "Befolkning per kommune (SSB tabell 07459)" };
    var kws = ["inntekt", "alder", "bolig", "arbeidsledighet", "utdanning", "eldre", "barn", "sysselsetting", "kostra"];
    for (var i = 0; i < kws.length; i++) if (t.indexOf(kws[i]) !== -1) return { query: kws[i], label: "SSB-tabell om «" + kws[i] + "»" };
    return { table: "07459", label: "Befolkning per kommune (SSB tabell 07459)" };
  }

  /**
   * Hvordan hentes et datasett i en gitt rolle? Returnerer en liste med jobber:
   *  { label, call, needsArea, fallback, auto: true }   – lastes ned av skriptet
   *  { label, manual: true, url, reason }               – må lastes ned manuelt
   */
  function jobsFor(ds, role, plan) {
    var id = ds.id;
    var fmt = "None";
    var jobs = [];
    function geo(label, args, needsArea, fallback) {
      jobs.push({ label: label, call: "geonorge(m, " + args + ")", needsArea: !!needsArea, fallback: fallback, auto: true });
    }
    function osm(label, filter, mode, fname) {
      jobs.push({ label: label, call: "overpass(m, " + py(filter) + ", " + py(mode) + ", " + py(fname) + ")", needsArea: true, auto: true });
    }
    function manual(reason) {
      jobs.push({ label: ds.name, manual: true, url: ds.url, reason: reason || "Har ikke et åpent nedlastings-API som skriptet kan bruke." });
    }

    switch (id) {
      case "n50-kartdata":
        geo("N50 Kartdata (Kartverket)", "uuid=" + py(UUID.n50) + ", navn=\"N50 Kartdata\"");
        break;
      case "admin-enheter":
        if (["statistikk-kommune", "pendling"].indexOf(plan.recipe.id) !== -1 || !plan.place || plan.place.type !== "kommune") {
          geo("Kommunegrenser for " + (plan.place && plan.place.type === "fylke" ? plan.place.name : "hele landet"), "uuid=" + py(UUID.kommuner) + ", navn=\"Kommuner\", nivaa=" + py(plan.place && plan.place.type === "fylke" ? "fylke" : "land"));
        } else {
          jobs.push({ label: "Kommunegrense for " + plan.place.name, builtin: true, auto: true });
        }
        break;
      case "fkb":
        geo("Bygninger (FKB-Bygning, Kartverket)", "sok=[\"FKB-Bygning\"], ma_inneholde=\"bygning\"", false,
          "overpass(m, " + py(OSM.bygninger.filter) + ", \"geom\", \"bygninger_osm.geojson\")");
        break;
      case "osm-geofabrik":
        if (role.targets) {
          var targets = plan.targets.length ? plan.targets : [];
          if (!targets.length) {
            jobs.push({ label: "Målpunkter", manual: true, url: "https://overpass-turbo.eu", reason: "Ingen målpunkter ble gjenkjent i oppgaven. Skriv f.eks. «sykehus», «skole» eller «brannstasjon»." });
          }
          targets.forEach(function (k) {
            var t = K.TARGETS[k];
            osm(t.label + " fra OpenStreetMap", t.osm, "punkt", slug(t.label) + ".geojson");
          });
        } else if (role.key === "vegnett") {
          osm(OSM.veger.label, OSM.veger.filter, "geom", "veger_osm.geojson");
        } else if (role.key === "sykkelnett" || role.key === "gangnett") {
          osm(OSM.sykkel.label, OSM.sykkel.filter, "geom", "gang_sykkel_osm.geojson");
        } else if (role.key === "lading") {
          osm("Ladestasjoner fra OpenStreetMap", K.TARGETS.lader.osm, "punkt", "ladestasjoner_osm.geojson");
        } else if (role.key === "parkering") {
          osm("Parkering fra OpenStreetMap", K.TARGETS.parkering.osm, "punkt", "parkering_osm.geojson");
        } else {
          osm(OSM.bygninger.label, OSM.bygninger.filter, "geom", "bygninger_osm.geojson");
        }
        break;
      case "adresser":
        geo("Adresser (Matrikkelen)", "sok=[\"Matrikkelen - Adresse\"], ma_inneholde=\"adresse\"");
        break;
      case "ssb-rutenett":
        geo("Befolkning på rutenett 250 m (SSB)", "sok=[\"Befolkning på rutenett 250 m\", \"Befolkning på rutenett\"], ma_inneholde=\"rutenett\"");
        break;
      case "ssb-tettsteder":
        geo("Tettsteder (SSB)", "sok=[\"Tettsteder\"], ma_inneholde=\"tettsted\"");
        break;
      case "nve-nedlasting":
        (plan.hazards.length ? plan.hazards : ["flom"]).forEach(function (h) {
          var hz = K.HAZARDS[h];
          geo(hz.label + " (NVE)", "sok=" + pyList(hz.queries) + ", ma_inneholde=" + py(hz.must));
        });
        break;
      case "ngu":
        geo("Løsmasser (NGU)", "sok=[\"Løsmasser\"], ma_inneholde=\"løsmasse\"");
        break;
      case "hoydedata":
        jobs.push({ label: "Høydemodell DTM 10 m (Kartverket, WCS)", call: "dtm(m, opplosning=10)", needsArea: true, auto: true });
        break;
      case "ar5":
        geo("AR5 arealressurskart (NIBIO)", "sok=[\"AR5\", \"Arealressurskart\"], ma_inneholde=\"ar5\"");
        break;
      case "naturbase":
        geo("Naturvernområder (Miljødirektoratet)", "sok=[\"Naturvernområder\"], ma_inneholde=\"vern\"");
        break;
      case "turrutebasen":
        geo("Turrutebasen (Kartverket)", "sok=[\"Turrutebasen\", \"Tur- og friluftsruter\"], ma_inneholde=\"rute\"");
        break;
      case "tilgjengelighet-uu":
        geo("Tilgjengelighet tettsted (Kartverket)", "sok=[\"Tilgjengelighet tettsted\", \"Tilgjengelighet\"], ma_inneholde=\"tilgjengelighet\"");
        break;
      case "stoy-veg":
        geo("Støysoner (veg)", "sok=[\"Støysoner veg\", \"Støykartlegging\", \"Støy\"], ma_inneholde=\"støy\"");
        break;
      case "nvdb-ruteplan":
        geo("NVDB Ruteplan nettverksdatasett (Statens vegvesen)", "sok=[\"NVDB ruteplan nettverksdatasett\"], ma_inneholde=\"ruteplan\", formater=" +
          pyList(plan.tool === "arcgis" || plan.tool === "online" ? ["FGDB", "SpatiaLite"] : ["SpatiaLite", "FGDB"]));
        break;
      case "nvdb":
        var types = role.key === "ulykker" ? [570] : (plan.recipe.nvdbTypes || [105]);
        var names = { 570: "Trafikkulykker", 540: "Trafikkmengde", 105: "Fartsgrenser" };
        if (role.key === "gangnett" || role.key === "sykkelnett") {
          osm(OSM.sykkel.label, OSM.sykkel.filter, "geom", "gang_sykkel_osm.geojson");
          break;
        }
        types.forEach(function (t) {
          jobs.push({ label: (names[t] || "Vegobjekttype " + t) + " (NVDB)", call: "nvdb(m, " + t + ", " + py(slug(names[t] || "type_" + t) + ".geojson") + ")", needsArea: true, auto: true });
        });
        break;
      case "trafikkdata":
        jobs.push({ label: "ÅDT fra trafikkregistreringspunkter (Trafikkdata.no)", call: "trafikkdata(m)", needsArea: true, auto: true });
        break;
      case "ssb-statbank":
        var sq = statQuery(plan);
        jobs.push({ label: sq.label, call: sq.table ? "ssb(m, tabell=" + py(sq.table) + ")" : "ssb(m, sok=" + py(sq.query) + ")", auto: true });
        break;
      case "ssb-ulykker":
        jobs.push({ label: "Vegtrafikkulykker (SSB)", call: "ssb(m, sok=\"vegtrafikkulykker\")", auto: true });
        break;
      case "ssb-bilparken":
        jobs.push({ label: "Registrerte kjøretøy (SSB)", call: "ssb(m, sok=\"registrerte kjøretøy\")", auto: true });
        break;
      case "ssb-kollektiv":
        jobs.push({ label: "Kollektivtransport (SSB)", call: "ssb(m, sok=\"kollektivtransport\")", auto: true });
        break;
      case "ssb-pendling":
        jobs.push({ label: "Pendling mellom kommuner (SSB tabell 03321)", call: "ssb(m, tabell=\"03321\")", auto: true });
        break;
      case "entur":
        jobs.push({ label: "Rutedata for hele Norge, GTFS (Entur)", call: "last_ned(\"https://storage.googleapis.com/marduk-production/outbound/gtfs/rb_norway-aggregated-gtfs.zip\", m, \"gtfs_norge.zip\", pakk_ut=False)", auto: true });
        break;
      case "entur-mobility":
        jobs.push({ label: "Delte kjøretøy akkurat nå (Entur Mobility)", call: "entur_mobilitet(m)", needsArea: true, auto: true });
        break;
      case "bysykkel":
        jobs.push({ label: "Bysykkelturer forrige måned", call: "bysykkel(m)", needsArea: true, auto: true });
        break;
      case "jernbanenett":
        osm(OSM.jernbane.label, OSM.jernbane.filter, "geom", "jernbane_osm.geojson");
        break;
      case "parkeringsregisteret":
        osm("Parkering fra OpenStreetMap", K.TARGETS.parkering.osm, "punkt", "parkering_osm.geojson");
        manual("Parkeringsregisteret har et eget API. Skriptet henter parkering fra OpenStreetMap i stedet.");
        break;
      case "natural-earth":
        jobs.push({ label: "Natural Earth – land (1:10m)", call: "last_ned(\"https://naciscdn.org/naturalearth/10m/cultural/ne_10m_admin_0_countries.zip\", m)", auto: true });
        break;
      default:
        manual(ds.login ? "Krever gratis bruker eller API-nøkkel." : null);
    }
    return jobs;
  }

  /** Kort beskrivelse til planvisningen: lastes datasettet ned automatisk? */
  function describe(ds, role, plan) {
    var jobs = jobsFor(ds, role, plan);
    var auto = jobs.filter(function (j) { return j.auto; });
    var manual = jobs.filter(function (j) { return j.manual; });
    return { auto: auto.length > 0, manualOnly: !auto.length, jobs: jobs, manual: manual };
  }

  // ------------------------------------------------------------ Python-mal
  var HELPERS = String.raw`
import json
import math
import re
import sys
import time
import zipfile
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, datetime, timedelta
from pathlib import Path

AGENT = "Datafinner-nedlasting/1.0"
KOMMUNE = {}


def info(tekst):
    print(tekst, flush=True)


def hent(url, data=None, headers=None, timeout=180):
    h = {"User-Agent": AGENT}
    if headers:
        h.update(headers)
    if data is not None and not isinstance(data, bytes):
        data = json.dumps(data).encode("utf-8")
        h.setdefault("Content-Type", "application/json")
    req = urllib.request.Request(url, data=data, headers=h)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read(), r.geturl()


def hent_json(url, data=None, headers=None, timeout=180):
    body, endelig = hent(url, data, headers, timeout)
    if "geoid.no" in endelig or "/login" in endelig.lower():
        raise PermissionError("datasettet krever innlogging")
    return json.loads(body.decode("utf-8"))


def last_ned(url, mappe, filnavn=None, headers=None, pakk_ut=True):
    mappe.mkdir(parents=True, exist_ok=True)
    h = {"User-Agent": AGENT}
    h.update(headers or {})
    req = urllib.request.Request(url, headers=h)
    with urllib.request.urlopen(req, timeout=900) as r:
        if not filnavn:
            cd = r.headers.get("Content-Disposition", "")
            m = re.search(r'filename="?([^";]+)', cd)
            filnavn = m.group(1) if m else (urllib.parse.urlparse(url).path.rsplit("/", 1)[-1] or "fil")
        sti = mappe / filnavn
        storrelse = 0
        with open(sti, "wb") as f:
            while True:
                bit = r.read(1 << 20)
                if not bit:
                    break
                f.write(bit)
                storrelse += len(bit)
    info("    lagret %s (%.1f MB)" % (sti.name, storrelse / 1e6))
    if pakk_ut and sti.suffix.lower() == ".zip":
        try:
            with zipfile.ZipFile(sti) as z:
                z.extractall(mappe)
            info("    pakket ut " + sti.name)
        except zipfile.BadZipFile:
            info("    ADVARSEL: %s er ikke en gyldig zip-fil" % sti.name)
    return sti


def skriv_geojson(sti, features, crs=None):
    fc = {"type": "FeatureCollection", "features": features}
    if crs:
        fc["crs"] = {"type": "name", "properties": {"name": "urn:ogc:def:crs:EPSG::%d" % crs}}
    sti.parent.mkdir(parents=True, exist_ok=True)
    sti.write_text(json.dumps(fc, ensure_ascii=False), encoding="utf-8")
    info("    lagret %s (%d objekter)" % (sti.name, len(features)))


def skriv_csv(sti, kolonner, rader):
    sti.parent.mkdir(parents=True, exist_ok=True)
    def celle(v):
        v = "" if v is None else str(v)
        return '"' + v.replace('"', '""') + '"' if any(c in v for c in ';"\n') else v
    with open(sti, "w", encoding="utf-8-sig", newline="") as f:
        f.write(";".join(kolonner) + "\n")
        for rad in rader:
            f.write(";".join(celle(v) for v in rad) + "\n")
    info("    lagret %s (%d rader)" % (sti.name, len(rader)))


def bbox(koordinater):
    xs, ys = [], []
    def gaa(k):
        if k and isinstance(k[0], (int, float)):
            xs.append(k[0])
            ys.append(k[1])
        else:
            for d in k:
                gaa(d)
    gaa(koordinater)
    return min(xs), min(ys), max(xs), max(ys)


# ------------------------------------------------------------------ Område
KOMMUNEINFO = ["https://api.kartverket.no/kommuneinfo/v1", "https://ws.geonorge.no/kommuneinfo/v1"]


def kommuneinfo(sti):
    feil = None
    for base in KOMMUNEINFO:
        try:
            return hent_json(base + sti)
        except Exception as e:
            feil = e
    raise feil


def finn_omrade(ut):
    if OMRADE_TYPE != "kommune" or not OMRADE:
        return
    svar = kommuneinfo("/sok?knavn=" + urllib.parse.quote(OMRADE))
    treff = svar.get("kommuner") or []
    if not treff:
        raise ValueError("fant ingen kommune som heter %s" % OMRADE)
    def navn(k):
        return k.get("kommunenavnNorsk") or k.get("kommunenavn") or ""
    valgt = next((k for k in treff if navn(k).lower() == OMRADE.lower()), treff[0])
    KOMMUNE["nummer"] = str(valgt["kommunenummer"]).zfill(4)
    KOMMUNE["navn"] = navn(valgt) or OMRADE
    KOMMUNE["fylke"] = KOMMUNE["nummer"][:2]
    info("Område: %s kommune (%s)" % (KOMMUNE["navn"], KOMMUNE["nummer"]))
    for crs, filnavn in ((4326, "kommunegrense.geojson"), (25833, "kommunegrense_utm33.geojson")):
        data = kommuneinfo("/kommuner/%s/omrade?utkoordsys=%d" % (KOMMUNE["nummer"], crs))
        geom = data.get("omrade") or data
        KOMMUNE["bbox_%d" % crs] = bbox(geom["coordinates"])
        feature = {"type": "Feature", "geometry": geom,
                   "properties": {"kommunenummer": KOMMUNE["nummer"], "kommunenavn": KOMMUNE["navn"]}}
        skriv_geojson(ut / "00_avgrensning" / filnavn, [feature], crs=None if crs == 4326 else crs)


# ------------------------------------------------------------------ Geonorge
GEONORGE_SOK = "https://kartkatalog.geonorge.no/api/search"
GEONORGE_API = "https://nedlasting.geonorge.no/api"


def geonorge_finn(sok, ma_inneholde=None):
    for tekst in sok:
        url = GEONORGE_SOK + "?" + urllib.parse.urlencode({"text": tekst, "limit": 20})
        resultater = hent_json(url).get("Results") or []
        resultater = [r for r in resultater if (r.get("Type") or "").lower() not in ("service", "servicelayer", "software")]
        def ok(r):
            return not ma_inneholde or ma_inneholde.lower() in (r.get("Title") or "").lower()
        kandidater = [r for r in resultater if (r.get("Title") or "").lower() == tekst.lower()]
        kandidater += [r for r in resultater if ok(r) and r not in kandidater]
        for r in kandidater:
            uuid = r.get("Uuid")
            if not uuid:
                continue
            try:
                omrader = hent_json(GEONORGE_API + "/codelists/area/" + uuid)
            except PermissionError:
                info("    %s krever innlogging, prøver neste treff" % r.get("Title"))
                continue
            except Exception:
                continue
            if omrader:
                return uuid, r.get("Title"), omrader
    raise LookupError("fant ikke noe nedlastbart datasett i Geonorge for: " + ", ".join(sok))


def velg_omrade(omrader, nivaa=None):
    def finn(typ, kode=None, navn=None):
        for o in omrader:
            if (o.get("type") or "").lower() != typ:
                continue
            if kode is None and navn is None:
                return o
            if kode and str(o.get("code")) == kode:
                return o
            if navn and navn.lower() in (o.get("name") or "").lower():
                return o
        return None
    if nivaa != "land":
        if KOMMUNE and nivaa != "fylke":
            o = finn("kommune", kode=KOMMUNE["nummer"]) or finn("fylke", kode=KOMMUNE["fylke"])
            if o:
                return o
        if KOMMUNE and nivaa == "fylke":
            o = finn("fylke", kode=KOMMUNE["fylke"])
            if o:
                return o
        if OMRADE_TYPE == "fylke" and OMRADE:
            o = finn("fylke", navn=OMRADE)
            if o:
                return o
    return finn("landsdekkende") or omrader[0]


def velg_projeksjon_og_format(omrade, formater):
    projeksjoner = omrade.get("projections") or []
    projeksjon = None
    for kode in PROJEKSJONER:
        projeksjon = next((p for p in projeksjoner if str(p.get("code")) == kode), None)
        if projeksjon:
            break
    projeksjon = projeksjon or (projeksjoner[0] if projeksjoner else {"code": "25833"})
    tilgjengelige = projeksjon.get("formats") or omrade.get("formats") or []
    navn = [f.get("name") for f in tilgjengelige if f.get("name")]
    for onsket in formater:
        for n in navn:
            if n.strip().lower().startswith(onsket.lower()):
                return projeksjon, n
    if not navn:
        raise LookupError("ingen formater tilgjengelig")
    return projeksjon, navn[0]


def geonorge(mappe, sok=None, uuid=None, navn=None, ma_inneholde=None, formater=None, nivaa=None):
    if uuid:
        omrader = hent_json(GEONORGE_API + "/codelists/area/" + uuid)
        tittel = navn or uuid
    else:
        uuid, tittel, omrader = geonorge_finn(sok, ma_inneholde)
    info("    Geonorge-datasett: %s" % tittel)
    if not omrader:
        raise PermissionError("ingen områder å laste ned (krever trolig innlogging)")
    omrade = velg_omrade(omrader, nivaa)
    projeksjon, fmt = velg_projeksjon_og_format(omrade, formater or FORMATER)
    info("    område: %s, projeksjon: %s, format: %s" % (omrade.get("name"), projeksjon.get("code"), fmt.strip()))
    bestilling = {
        "email": "",
        "softwareClient": "Datafinner",
        "softwareClientVersion": "1.0",
        "orderLines": [{
            "metadataUuid": uuid,
            "areas": [{"code": omrade.get("code"), "type": omrade.get("type"), "name": omrade.get("name")}],
            "projections": [{"code": projeksjon.get("code"), "name": projeksjon.get("name", ""), "codespace": projeksjon.get("codespace", "")}],
            "formats": [{"name": fmt}],
        }],
    }
    svar = hent_json(GEONORGE_API + "/order", data=bestilling)
    filer = svar.get("files") or []
    ref = svar.get("referenceNumber")
    for _ in range(60):
        if filer and all(f.get("status") == "ReadyForDownload" for f in filer):
            break
        if not ref:
            break
        info("    venter på at Geonorge skal klargjøre filene ...")
        time.sleep(10)
        filer = hent_json(GEONORGE_API + "/order/" + ref).get("files") or []
    if not filer:
        raise LookupError("bestillingen ga ingen filer")
    for f in filer:
        if f.get("status") != "ReadyForDownload":
            info("    ikke klar ennå: %s (status %s). Prøv igjen senere." % (f.get("name"), f.get("status")))
            continue
        last_ned(f["downloadUrl"], mappe, f.get("name"))


# ------------------------------------------------------------------ SSB
SSB = "https://data.ssb.no/api/pxwebapi/v2"


def ssb(mappe, tabell=None, sok=None):
    if not tabell:
        svar = hent_json(SSB + "/tables?" + urllib.parse.urlencode({"query": sok, "lang": "no", "pageSize": 5}))
        tabeller = svar.get("tables") or []
        if not tabeller:
            raise LookupError("fant ingen SSB-tabell for: " + sok)
        tabell = str(tabeller[0].get("id"))
        info("    SSB-tabell %s: %s" % (tabell, tabeller[0].get("label") or tabeller[0].get("title") or ""))
        for t in tabeller[1:]:
            info("      (andre treff: %s %s)" % (t.get("id"), t.get("label") or ""))
    try:
        meta = hent_json(SSB + "/tables/%s/metadata?lang=no&outputFormat=json-stat2" % tabell)
    except urllib.error.HTTPError:
        meta = hent_json(SSB + "/tables/%s/metadata?lang=no" % tabell)
    mappe.mkdir(parents=True, exist_ok=True)
    (mappe / ("ssb_%s_metadata.json" % tabell)).write_text(json.dumps(meta, ensure_ascii=False, indent=1), encoding="utf-8")
    variabler = meta.get("id") or [v.get("id") for v in meta.get("variables", [])]
    def parametre(avgrens):
        p = {"lang": "no", "outputFormat": "csv"}
        for v in variabler:
            p["valueCodes[%s]" % v] = "top(1)" if v.lower() == "tid" else "*"
        if avgrens and KOMMUNE:
            for v in variabler:
                koder = ((meta.get("dimension") or {}).get(v) or {}).get("category", {}).get("index", {})
                if KOMMUNE["nummer"] in koder:
                    p["valueCodes[%s]" % v] = KOMMUNE["nummer"]
                    break
        return urllib.parse.urlencode(p, safe="[]()*,")
    url = SSB + "/tables/%s/data?%s" % (tabell, parametre(False))
    try:
        last_ned(url, mappe, "ssb_%s.csv" % tabell)
    except urllib.error.HTTPError as e:
        if not KOMMUNE:
            raise
        info("    tabellen er for stor for hele landet (HTTP %s), avgrenser til %s" % (e.code, KOMMUNE["navn"]))
        last_ned(SSB + "/tables/%s/data?%s" % (tabell, parametre(True)), mappe, "ssb_%s_%s.csv" % (tabell, KOMMUNE["nummer"]))
    info("    Siste år er hentet. Endre valueCodes[Tid] i URL-en for flere år: https://www.ssb.no/statbank/table/%s" % tabell)


# ------------------------------------------------------------------ OpenStreetMap
OVERPASS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"]


def overpass(mappe, filter_, modus, filnavn):
    x0, y0, x1, y1 = KOMMUNE["bbox_4326"]
    utdata = "out center;" if modus == "punkt" else "out geom;"
    sporring = "[out:json][timeout:300];(%s(%.5f,%.5f,%.5f,%.5f););%s" % (filter_, y0, x0, y1, x1, utdata)
    feil = None
    for url in OVERPASS:
        try:
            data = hent_json(url, data=urllib.parse.urlencode({"data": sporring}).encode("utf-8"), timeout=400)
            break
        except Exception as e:
            feil = e
            info("    %s svarte ikke, prøver neste server" % url)
    else:
        raise feil
    features = []
    for el in data.get("elements", []):
        props = dict(el.get("tags") or {})
        props["osm_id"] = "%s/%s" % (el.get("type"), el.get("id"))
        if el.get("type") == "node":
            geom = {"type": "Point", "coordinates": [el["lon"], el["lat"]]}
        elif modus == "punkt" and el.get("center"):
            geom = {"type": "Point", "coordinates": [el["center"]["lon"], el["center"]["lat"]]}
        elif el.get("geometry"):
            pkt = [[p["lon"], p["lat"]] for p in el["geometry"]]
            lukket = len(pkt) > 3 and pkt[0] == pkt[-1]
            geom = {"type": "Polygon", "coordinates": [pkt]} if lukket and "highway" not in props else {"type": "LineString", "coordinates": pkt}
        else:
            continue
        features.append({"type": "Feature", "geometry": geom, "properties": props})
    skriv_geojson(mappe / filnavn, features)


# ------------------------------------------------------------------ NVDB
NVDB = "https://nvdbapiles.atlas.vegvesen.no/vegobjekter/api/v4/vegobjekter"


def wkt_til_geojson(wkt):
    if not wkt:
        return None
    m = re.match(r"\s*([A-Za-z]+)\s*(?:ZM|Z|M)?\s*\((.*)\)\s*$", wkt, re.S)
    if not m:
        return None
    typ, kropp = m.group(1).upper(), m.group(2)
    def punkter(s):
        return [[float(v) for v in p.split()[:2]] for p in s.strip().split(",") if p.strip()]
    if typ == "POINT":
        return {"type": "Point", "coordinates": punkter(kropp)[0]}
    if typ == "LINESTRING":
        return {"type": "LineString", "coordinates": punkter(kropp)}
    deler = re.findall(r"\(([^()]*)\)", kropp)
    if typ == "POLYGON":
        return {"type": "Polygon", "coordinates": [punkter(d) for d in deler]}
    if typ == "MULTILINESTRING":
        return {"type": "MultiLineString", "coordinates": [punkter(d) for d in deler]}
    if typ == "MULTIPOINT":
        return {"type": "MultiPoint", "coordinates": punkter(kropp.replace("(", "").replace(")", ""))}
    if typ == "MULTIPOLYGON":
        return {"type": "MultiPolygon", "coordinates": [[punkter(d)] for d in deler]}
    return None


def nvdb(mappe, typeid, filnavn):
    x0, y0, x1, y1 = KOMMUNE["bbox_25833"]
    parametre = {"kartutsnitt": "%.0f,%.0f,%.0f,%.0f" % (x0, y0, x1, y1),
                 "inkluder": "egenskaper,geometri,metadata", "srid": "5973", "antall": 1000}
    features, forrige = [], None
    for _ in range(1000):
        data = hent_json(NVDB + "/%d?%s" % (typeid, urllib.parse.urlencode(parametre)),
                         headers={"Accept": "application/json", "X-Client": "Datafinner"})
        objekter = data.get("objekter") or []
        for o in objekter:
            geom = wkt_til_geojson((o.get("geometri") or {}).get("wkt"))
            if not geom:
                continue
            props = {"nvdb_id": o.get("id")}
            for e in o.get("egenskaper") or []:
                if e.get("navn") and "verdi" in e and not isinstance(e["verdi"], (dict, list)):
                    props[e["navn"]] = e["verdi"]
            features.append({"type": "Feature", "geometry": geom, "properties": props})
        start = ((data.get("metadata") or {}).get("neste") or {}).get("start")
        if not objekter or not start or start == forrige:
            break
        forrige = start
        parametre["start"] = start
        info("    hentet %d objekter ..." % len(features))
        time.sleep(0.2)
    skriv_geojson(mappe / filnavn, features, crs=25833)
    punkter = [f for f in features if f["geometry"]["type"] == "Point"]
    if punkter:
        kolonner = sorted({k for f in punkter for k in f["properties"]})
        rader = [[f["geometry"]["coordinates"][0], f["geometry"]["coordinates"][1]] + [f["properties"].get(k) for k in kolonner] for f in punkter]
        skriv_csv(mappe / filnavn.replace(".geojson", ".csv"), ["x_utm33", "y_utm33"] + kolonner, rader)


# ------------------------------------------------------------------ Høydedata (WCS)
def dtm(mappe, opplosning=10):
    x0, y0, x1, y1 = KOMMUNE["bbox_25833"]
    maks = 2000 * opplosning
    nx, ny = int(math.ceil((x1 - x0) / maks)), int(math.ceil((y1 - y0) / maks))
    info("    henter %d fliser à maks 2000 x 2000 piksler (%d m oppløsning)" % (nx * ny, opplosning))
    for i in range(nx):
        for j in range(ny):
            bx0, by0 = x0 + i * maks, y0 + j * maks
            bx1, by1 = min(bx0 + maks, x1), min(by0 + maks, y1)
            parametre = {"service": "WCS", "version": "1.0.0", "request": "GetCoverage",
                         "coverage": "nhm_dtm_topo_25833", "CRS": "EPSG:25833",
                         "BBOX": "%.0f,%.0f,%.0f,%.0f" % (bx0, by0, bx1, by1),
                         "WIDTH": max(1, int(round((bx1 - bx0) / opplosning))),
                         "HEIGHT": max(1, int(round((by1 - by0) / opplosning))),
                         "FORMAT": "GeoTIFF"}
            url = "https://wcs.geonorge.no/skwms1/wcs.hoyde-dtm-nhm-25833?" + urllib.parse.urlencode(parametre)
            sti = last_ned(url, mappe, "dtm_%dm_%d_%d.tif" % (opplosning, i, j))
            with open(sti, "rb") as f:
                start = f.read(4)
            if start[:2] not in (b"II", b"MM"):
                sti.rename(sti.with_suffix(".feil.xml"))
                raise RuntimeError("WCS-tjenesten svarte med en feilmelding (se %s)" % sti.with_suffix(".feil.xml").name)
    info("    Slå sammen flisene: ArcGIS «Mosaic To New Raster» eller QGIS «Build Virtual Raster».")


# ------------------------------------------------------------------ Trafikkdata
TRAFIKKDATA = "https://trafikkdata-api.atlas.vegvesen.no/"


def trafikkdata(mappe):
    q = ("{ trafficRegistrationPoints(searchQuery: {countyNumbers: [%d]}) { id name "
         "location { municipality { number name } coordinates { latLon { lat lon } } } } }" % int(KOMMUNE["fylke"]))
    punkter = hent_json(TRAFIKKDATA, data={"query": q})["data"]["trafficRegistrationPoints"]
    punkter = [p for p in punkter
               if str(((p.get("location") or {}).get("municipality") or {}).get("number", "")).zfill(4) == KOMMUNE["nummer"]]
    info("    %d tellepunkter i kommunen, henter ÅDT ..." % len(punkter))
    rader, features = [], []
    for p in punkter:
        q2 = ('{ trafficData(trafficRegistrationPointId: "%s") { volume { average { daily { byYear { '
              'year total { volume { average } coverage { percentage } } } } } } } }' % p["id"])
        try:
            aar = hent_json(TRAFIKKDATA, data={"query": q2})["data"]["trafficData"]["volume"]["average"]["daily"]["byYear"] or []
        except Exception:
            aar = []
        siste = max(aar, key=lambda a: a["year"]) if aar else None
        ll = p["location"]["coordinates"]["latLon"]
        adt = ((siste or {}).get("total") or {}).get("volume", {}).get("average") if siste else None
        dekning = ((siste or {}).get("total") or {}).get("coverage", {}).get("percentage") if siste else None
        rad = [p["id"], p["name"], ll["lat"], ll["lon"], siste and siste["year"], adt, dekning]
        rader.append(rad)
        features.append({"type": "Feature", "geometry": {"type": "Point", "coordinates": [ll["lon"], ll["lat"]]},
                         "properties": dict(zip(["id", "navn", "lat", "lon", "aar", "adt", "dekning_prosent"], rad))})
        time.sleep(0.1)
    skriv_csv(mappe / "trafikk_adt.csv", ["id", "navn", "lat", "lon", "aar", "adt", "dekning_prosent"], rader)
    skriv_geojson(mappe / "trafikk_adt.geojson", features)


# ------------------------------------------------------------------ Entur Mobility
def entur_mobilitet(mappe):
    x0, y0, x1, y1 = KOMMUNE["bbox_4326"]
    lat, lon = (y0 + y1) / 2, (x0 + x1) / 2
    radius = int(min(20000, max(1000, (y1 - y0) * 111000 / 2)))
    q = ("{ vehicles(lat: %.5f, lon: %.5f, range: %d, count: 10000) { id lat lon currentRangeMeters "
         "vehicleType { formFactor } system { operator { id } } } }" % (lat, lon, radius))
    data = hent_json("https://api.entur.io/mobility/v2/graphql", data={"query": q},
                     headers={"ET-Client-Name": "datafinner-nedlasting"})
    kjoretoy = (data.get("data") or {}).get("vehicles") or []
    tid = datetime.now().strftime("%Y-%m-%d %H:%M")
    rader = [[v["id"], v["lat"], v["lon"], (v.get("vehicleType") or {}).get("formFactor"),
              ((v.get("system") or {}).get("operator") or {}).get("id"), v.get("currentRangeMeters"), tid] for v in kjoretoy]
    stempel = datetime.now().strftime("%Y%m%d_%H%M")
    skriv_csv(mappe / ("kjoretoy_%s.csv" % stempel), ["id", "lat", "lon", "type", "operator", "rekkevidde_m", "tidspunkt"], rader)
    info("    Kjør skriptet flere ganger i løpet av dagen for å se mønstre over tid.")


# ------------------------------------------------------------------ Bysykkel
BYSYKKEL = {"oslo": "oslobysykkel.no", "bergen": "bergenbysykkel.no", "trondheim": "trondheimbysykkel.no"}


def bysykkel(mappe):
    system = BYSYKKEL.get(KOMMUNE.get("navn", "").lower())
    if not system:
        raise LookupError("bysykkeldata finnes for Oslo, Bergen og Trondheim")
    forrige = date.today().replace(day=1) - timedelta(days=1)
    url = "https://data.urbansharing.com/%s/trips/v1/%d/%02d.csv" % (system, forrige.year, forrige.month)
    last_ned(url, mappe, "turer_%d_%02d.csv" % (forrige.year, forrige.month))
`;

  var MAIN = String.raw`

def main():
    UT.mkdir(parents=True, exist_ok=True)
    info("Datafinner – nedlasting til %s\n" % UT)
    try:
        finn_omrade(UT)
    except Exception as e:
        info("ADVARSEL: fant ikke kommunen «%s» (%s). Datasett som trenger kommunegrense, hoppes over.\n" % (OMRADE, e))
    resultat = []
    for mappenavn, navn, jobb, trenger_omrade, reserve in JOBBER:
        info("\n%s" % navn)
        mappe = UT / mappenavn
        if trenger_omrade and not KOMMUNE:
            info("    hoppet over: trenger en kommune (sett OMRADE øverst i skriptet)")
            resultat.append((navn, "hoppet over (mangler kommune)"))
            continue
        try:
            jobb(mappe)
            resultat.append((navn, "OK"))
        except Exception as e:
            info("    FEIL: %s" % e)
            if reserve and KOMMUNE:
                info("    prøver erstatning fra OpenStreetMap ...")
                try:
                    reserve(mappe)
                    resultat.append((navn, "OK (erstatning fra OpenStreetMap: %s)" % e))
                    continue
                except Exception as e2:
                    info("    FEIL: %s" % e2)
            resultat.append((navn, "feilet: %s" % e))

    linjer = ["Datafinner – nedlasting %s" % datetime.now().strftime("%Y-%m-%d %H:%M"), "",
              "Oppgave: " + OPPGAVE, "Område: " + (KOMMUNE.get("navn") or OMRADE or "hele landet"), "",
              "Resultat:"]
    linjer += ["  [%s] %s" % (status, navn) for navn, status in resultat]
    if MANUELLE:
        linjer += ["", "Må lastes ned manuelt:"]
        linjer += ["  %s: %s (%s)" % m for m in MANUELLE]
    linjer += ["", KILDETEKST, "", "Husk kildeteksten på kartet."]
    (UT / "LES_MEG.txt").write_text("\n".join(linjer) + "\n", encoding="utf-8")

    info("\n" + "\n".join(linjer[5:]))
    info("\nFerdig. Dataene ligger i: %s" % UT)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit("Avbrutt.")
`;

  function runLine(tool, file) {
    return {
      arcgis: "Start → ArcGIS → «Python Command Prompt», gå til mappen med cd, og skriv: python " + file,
      online: "Kjør med Python på PC-en (f.eks. «Python Command Prompt» fra ArcGIS Pro): python " + file,
      qgis: "Åpne «OSGeo4W Shell» (følger med QGIS), gå til mappen med cd, og skriv: python " + file,
      vscode: "Åpne mappen i VS Code → Terminal → New Terminal → python " + file
    }[tool];
  }

  /** Lager hele skriptet for en plan. */
  function generate(plan) {
    var jobLines = [];
    var manual = [];
    var seen = {};
    var n = 0;
    plan.roles.forEach(function (role) {
      jobsFor(role.dataset, role, plan).forEach(function (j) {
        var key = j.call || (j.manual ? "m:" + j.url : "b:" + j.label);
        if (seen[key]) return;
        seen[key] = true;
        if (j.manual) { manual.push(j); return; }
        if (j.builtin) return;
        n++;
        var folder = (n < 10 ? "0" : "") + n + "_" + slug(j.label);
        jobLines.push("    (" + py(folder) + ", " + py(j.label) + ", lambda m: " + j.call + ", " +
          (j.needsArea ? "True" : "False") + ", " + (j.fallback ? "lambda m: " + j.fallback : "None") + "),");
      });
    });

    var place = plan.place;
    var omrade = place && place.type !== "land" ? place.name : "";
    var omradeType = place && place.type !== "land" ? place.type : "";
    var outDir = "data_" + slug((omrade ? omrade + "_" : "") + plan.recipe.id);
    var today = new Date().toISOString().slice(0, 10);

    var header = [
      "#!/usr/bin/env python3",
      "# -*- coding: utf-8 -*-",
      "\"\"\"",
      "Nedlastingsskript laget av Datafinner " + today + ".",
      "",
      "Oppgave: " + plan.text.replace(/\"\"\"/g, "'''").replace(/\\/g, "/"),
      "Område:  " + (omrade || "hele landet") + "   Verktøy: " + plan.toolLabel,
      "",
      "Slik kjører du skriptet:",
      "  " + runLine(plan.tool, plan.scriptName),
      "",
      "Skriptet bruker bare Pythons standardbibliotek (ingen pip install).",
      "Dataene lagres i mappen «" + outDir + "» ved siden av skriptet, med en",
      "LES_MEG.txt som viser hva som ble hentet, kilder og lisenser.",
      "Du kan endre OMRADE, FORMATER og PROJEKSJONER under.",
      "\"\"\""
    ].join("\n");

    var config = [
      "",
      "OPPGAVE = " + py(plan.text),
      "OMRADE = " + py(omrade) + "          # kommunenavn, f.eks. \"Bergen\". Tom = hele landet",
      "OMRADE_TYPE = " + py(omradeType) + "   # \"kommune\" eller \"fylke\"",
      "FORMATER = " + pyList(FORMATS[plan.tool] || FORMATS.arcgis) + "   # ønsket format fra Geonorge, i prioritert rekkefølge",
      "PROJEKSJONER = [\"25833\", \"25832\", \"25835\"]   # EUREF89 UTM33 først",
      "UT = Path(__file__).resolve().parent / " + py(outDir),
      "KILDETEKST = " + py(plan.sourceText)
    ].join("\n");

    var jobs = [
      "",
      "",
      "# ------------------------------------------------------------------ Datasett for denne oppgaven",
      "# (mappe, navn, funksjon, trenger kommune, erstatning hvis det feiler)",
      "JOBBER = ["
    ].concat(jobLines).concat(["]", "", "MANUELLE = ["])
      .concat(manual.map(function (m) { return "    (" + py(m.label) + ", " + py(m.url) + ", " + py(m.reason) + "),"; }))
      .concat(["]"]).join("\n");

    var code = header + "\n" + HELPERS.replace(/^\n/, "") + config + jobs + "\n" + MAIN;
    return { filename: plan.scriptName, code: code, outDir: outDir, autoCount: jobLines.length, manual: manual };
  }

  var api = { generate: generate, describe: describe, jobsFor: jobsFor };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.ScriptGen = api;
})(this);
