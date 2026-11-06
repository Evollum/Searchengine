// Kjør: node tests/search.test.js
"use strict";
var assert = require("assert");
var S = require("../js/search.js");
var DATA = require("../data/datasets.js");
var HowTo = require("../js/howto.js");

var passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log("  ✓ " + name); }
  catch (e) { console.error("  ✗ " + name + "\n    " + e.message); process.exitCode = 1; }
}
function ids(res, n) { return res.results.slice(0, n || 3).map(function (r) { return r.dataset.id; }); }

console.log("Datasett-katalog");
test("alle datasett har påkrevde felter og unike id-er", function () {
  var seen = {};
  DATA.forEach(function (d) {
    ["id", "name", "provider", "region", "url", "description", "license", "updated"].forEach(function (f) {
      assert.ok(d[f], d.id + " mangler " + f);
    });
    assert.ok(/^https:\/\//.test(d.url), d.id + " url må være https");
    assert.ok(Array.isArray(d.formats) && d.formats.length, d.id + " mangler formats");
    assert.ok(Array.isArray(d.tags) && Array.isArray(d.categories), d.id + " mangler tags/categories");
    assert.ok(["Norge", "Europa", "Global"].indexOf(d.region) !== -1, d.id + " ugyldig region");
    (d.goodFor || []).forEach(function (p) { assert.ok(S.PURPOSES[p], d.id + " ukjent formål " + p); });
    assert.ok(!seen[d.id], "duplikat id " + d.id);
    seen[d.id] = true;
  });
});
test("alle formater er kjent av minst ett verktøy eller veiledning", function () {
  var known = {};
  Object.keys(S.TOOLS).forEach(function (k) { S.TOOLS[k].formats.forEach(function (f) { known[f] = true; }); });
  DATA.forEach(function (d) { d.formats.forEach(function (f) {
    if (f === "Varierer" || f === "SAFE" || f === "Darwin Core" || f === "NeTEx" || f === "XML") return;
    assert.ok(known[f], d.id + ": ukjent format " + f);
  }); });
});

console.log("Søk");
test("«flom» gir NVE øverst", function () {
  assert.strictEqual(ids(S.search(DATA, { query: "flom" }), 1)[0], "nve-nedlasting");
});
test("engelsk «flood» finner også NVE", function () {
  assert.ok(ids(S.search(DATA, { query: "flood" }), 3).indexOf("nve-nedlasting") !== -1);
});
test("«høydedata» gir hoydedata.no øverst", function () {
  assert.strictEqual(ids(S.search(DATA, { query: "høydedata" }), 1)[0], "hoydedata");
});
test("«befolkning per kommune» gir SSB blant topp 3", function () {
  var top = ids(S.search(DATA, { query: "befolkning per kommune" }), 3);
  assert.ok(top.indexOf("ssb-statbank") !== -1 || top.indexOf("ssb-rutenett") !== -1, top.join(","));
});
test("formålstekst om ArcGIS oppdager verktøy", function () {
  var res = S.search(DATA, { query: "flomsoner", purposeText: "analyse i ArcGIS Pro" });
  assert.strictEqual(res.intent.tool, "arcgis");
  assert.strictEqual(res.intent.purpose, "analyse");
});
test("formålstekst om maskinlæring oppdager formål", function () {
  var res = S.search(DATA, { query: "satellittbilder", purposeText: "trene en maskinlæringsmodell i Python" });
  assert.strictEqual(res.intent.purpose, "maskinlaering");
  assert.strictEqual(res.intent.tool, "vscode");
  var top = ids(res, 3);
  assert.ok(top.indexOf("copernicus-dataspace") !== -1 || top.indexOf("usgs-earthexplorer") !== -1, top.join(","));
});
test("«ml» treffer ikke html (ordgrense)", function () {
  assert.deepStrictEqual(S.detectIntent("html-side").purposes, []);
});
test("regionfilter Norge viser bare norske datasett", function () {
  var res = S.search(DATA, { query: "befolkning", region: "Norge" });
  assert.ok(res.results.length > 0);
  res.results.forEach(function (r) { assert.strictEqual(r.dataset.region, "Norge"); });
});
test("«i Bergen» prioriterer norske datasett", function () {
  var res = S.search(DATA, { query: "bygninger i Bergen" });
  assert.strictEqual(res.intent.region, "Norge");
  assert.strictEqual(res.results[0].dataset.region, "Norge");
});
test("Excel-verktøy straffer datasett uten tabellformat", function () {
  var res = S.search(DATA, { query: "befolkning", tool: "excel" });
  assert.ok(res.results[0].toolFit > 0, res.results[0].dataset.id);
});
test("skjul innlogging fjerner datasett med login", function () {
  var res = S.search(DATA, { query: "vær temperatur", includeLogin: false });
  res.results.forEach(function (r) { assert.ok(!r.dataset.login, r.dataset.id); });
});
test("tomt søk returnerer alle sortert på kvalitet", function () {
  var res = S.search(DATA, {});
  assert.strictEqual(res.results.length, DATA.length);
  assert.ok(res.results[0].quality >= res.results[res.results.length - 1].quality);
});
test("nonsens gir ingen treff", function () {
  assert.strictEqual(S.search(DATA, { query: "qwxzzy" }).results.length, 0);
});

console.log("Trafikk");
function topIds(q, why, tool, n) { return ids(S.search(DATA, { query: q, purposeText: why || "", tool: tool || "" }), n || 3); }
test("«trafikkmengde» gir trafikkdata.no øverst", function () {
  assert.strictEqual(topIds("trafikkmengde")[0], "trafikkdata");
});
test("«ÅDT» finner trafikkdata og NVDB", function () {
  var t = topIds("ådt", "", "", 3);
  assert.ok(t.indexOf("trafikkdata") !== -1 && t.indexOf("nvdb") !== -1, t.join(","));
});
test("«kjøretid» + ArcGIS gir rutbart vegnett øverst", function () {
  assert.strictEqual(topIds("kjøretid til sykehus", "nettverksanalyse i ArcGIS Pro")[0], "nvdb-ruteplan");
});
test("«trafikkulykker» finner SSB og NVDB", function () {
  var t = topIds("trafikkulykker", "", "", 4);
  assert.ok(t.indexOf("ssb-ulykker") !== -1 && t.indexOf("nvdb") !== -1, t.join(","));
});
test("«bysykkel» gir bysykkeldata øverst", function () {
  assert.strictEqual(topIds("bysykkel")[0], "bysykkel");
});
test("«elbil lading» gir NOBIL øverst", function () {
  assert.strictEqual(topIds("elbil lading")[0], "nobil");
});
test("«skipstrafikk» gir AIS øverst", function () {
  assert.strictEqual(topIds("skipstrafikk")[0], "kystverket-ais");
});
test("trafikkprognose med maskinlæring finner PeMS", function () {
  assert.ok(topIds("trafikkprognose", "maskinlæring", "", 3).indexOf("pems") !== -1);
});
test("«kø» finner sanntids-/trafikkdata", function () {
  var t = topIds("kø", "", "", 3);
  assert.ok(t.indexOf("vegvesen-datex") !== -1 || t.indexOf("trafikkdata") !== -1, t.join(","));
});

console.log("Mobilitet");
test("«mobilitet» gir norske mobilitetsdata øverst", function () {
  var t = topIds("mobilitet", "", "", 3);
  assert.strictEqual(t[0], "entur-mobility");
  t.forEach(function (id) { assert.strictEqual(DATA.filter(function (d) { return d.id === id; })[0].region, "Norge"); });
});
test("«elsparkesykler» gir Entur Mobility øverst", function () {
  assert.strictEqual(topIds("elsparkesykler")[0], "entur-mobility");
});
test("«pendling» gir SSB pendling øverst", function () {
  assert.strictEqual(topIds("pendling mellom kommuner", "flytkart i ArcGIS Pro")[0], "ssb-pendling");
});
test("«reisevaner» gir RVU øverst", function () { assert.strictEqual(topIds("reisevaner")[0], "rvu"); });
test("«universell utforming» gir tilgjengelighetsdata", function () { assert.strictEqual(topIds("universell utforming")[0], "tilgjengelighet-uu"); });
test("«parkering» gir parkeringsregisteret", function () { assert.strictEqual(topIds("parkering")[0], "parkeringsregisteret"); });
test("«ferje» gir ferjedatabanken", function () { assert.strictEqual(topIds("ferje")[0], "ferjedatabanken"); });
test("«kollektiv reisetid» finner reiseplanleggeren", function () { assert.ok(topIds("kollektiv reisetid", "", "", 3).indexOf("entur-reiseplan") !== -1); });
test("«gående» treffer ikke flydata (delord midt i ord)", function () { assert.ok(topIds("gående", "", "", 5).indexOf("avinor-flydata") === -1); });
test("uten område får norske datasett et forsprang", function () {
  assert.strictEqual(S.search(DATA, { query: "befolkning" }).results[0].dataset.region, "Norge");
});

console.log("Veiledninger");
test("hvert datasett har veiledning for alle verktøy", function () {
  DATA.forEach(function (d) {
    Object.keys(S.TOOLS).forEach(function (t) {
      var h = HowTo.forTool(d, t);
      assert.ok(h && h.steps.length, d.id + " / " + t);
    });
  });
});
test("VS Code gir Python-kode for filbaserte datasett", function () {
  var d = DATA.filter(function (x) { return x.id === "hoydedata"; })[0];
  var h = HowTo.forTool(d, "vscode");
  assert.ok(h.code && /rasterio/.test(h.code.code));
});
test("ArcGIS Pro velger FGDB når tilgjengelig", function () {
  var d = DATA.filter(function (x) { return x.id === "n50-kartdata"; })[0];
  assert.strictEqual(HowTo.forTool(d, "arcgis").format, "FGDB");
});

test("trafikkdata har GraphQL-kode for Python", function () {
  var d = DATA.filter(function (x) { return x.id === "trafikkdata"; })[0];
  assert.ok(/trafficRegistrationPoints/.test(HowTo.forTool(d, "vscode").code.code));
});
test("NVDB ruteplan gir Network Analyst-steg i ArcGIS", function () {
  var d = DATA.filter(function (x) { return x.id === "nvdb-ruteplan"; })[0];
  assert.ok(HowTo.forTool(d, "arcgis").steps.join(" ").indexOf("Network Analys") !== -1);
});

console.log("\n" + passed + " tester bestått" + (process.exitCode ? " – NOEN FEILET" : ""));
