// Kjør: node tests/planner.test.js
"use strict";
var assert = require("assert");
var fs = require("fs");
var os = require("os");
var path = require("path");
var child = require("child_process");
var P = require("../js/planner.js");
var G = require("../js/scriptgen.js");
var K = require("../data/recipes.js");
var DATA = require("../data/datasets.js");

var passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log("  ✓ " + name); }
  catch (e) { console.error("  ✗ " + name + "\n    " + e.message); process.exitCode = 1; }
}
var ids = DATA.map(function (d) { return d.id; });

console.log("Kunnskapsbase");
test("alle oppskrifter peker på eksisterende datasett og karttyper", function () {
  K.RECIPES.forEach(function (r) {
    assert.ok(K.MAPTYPES[r.mapType], r.id + ": ukjent karttype " + r.mapType);
    r.roles.forEach(function (role) {
      role.candidates.forEach(function (c) { assert.ok(ids.indexOf(c) !== -1, r.id + "/" + role.key + ": ukjent datasett " + c); });
    });
    ["arcgis", "qgis", "vscode", "online"].forEach(function (t) { assert.ok(r.analysis[t] && r.analysis[t].length, r.id + " mangler analyse for " + t); });
  });
});
test("alle karttyper har symbolisering for alle verktøy og minst ett eksempel", function () {
  Object.keys(K.MAPTYPES).forEach(function (k) {
    var m = K.MAPTYPES[k];
    ["arcgis", "qgis", "vscode", "online"].forEach(function (t) { assert.ok(m.symbology[t], k + " mangler " + t); });
    assert.ok(m.examples.length && m.examples.every(function (e) { return /^https:\/\//.test(e.url); }), k);
  });
});

console.log("Tolkning av oppgaver");
var CASES = [
  ["Lag et kart over hvilke bygninger i Bergen som ligger i flomsone", "naturfare", "Bergen", "overlay"],
  ["Vis befolkningsvekst per kommune i Vestland", "statistikk-kommune", "Vestland", "koroplet"],
  ["Kjøretid til nærmeste sykehus i Tromsø", "tilgjengelighet-bil", "Tromsø", "tilgjengelighet"],
  ["Varmekart over trafikkulykker i Oslo", "trafikkulykker", "Oslo", "hotspot"],
  ["Pendling mellom kommunene i Trøndelag", "pendling", "Trøndelag", "flyt"],
  ["Hvor står elsparkesyklene i Oslo?", "delt-mobilitet", "Oslo", null],
  ["ÅDT-kart for vegene i Stavanger", "trafikkmengde", "Stavanger", "linjer"],
  ["Helningskart for Voss", "terreng", "Voss", "raster"],
  ["Ladestasjoner for elbil i Drammen", "elbil-lading", "Drammen", "punkt"],
  ["Hvor mange bor i rød støysone i Bærum?", "stoy", "Bærum", "overlay"],
  ["Kollektivdekning i Kristiansand, innbyggere innen 500 m fra holdeplass", "kollektiv", "Kristiansand", null],
  ["Arealbruk og nedbygging av dyrka mark i Ringsaker", "arealbruk", "Ringsaker", "kategori"]
];
CASES.forEach(function (c) {
  test("«" + c[0] + "» → " + c[1], function () {
    var p = P.buildPlan(c[0]);
    assert.strictEqual(p.recipe.id, c[1]);
    assert.strictEqual(p.place && p.place.name, c[2]);
    if (c[3]) assert.strictEqual(p.mapTypeKey, c[3]);
  });
});
test("ukjent oppgave gir generell plan med relevante datasett", function () {
  var p = P.buildPlan("lage et fint kart over turstier");
  assert.strictEqual(p.recipe.id, "generell");
  assert.ok(p.roles.length > 0);
});
test("«Time» som kommune krever stor forbokstav", function () {
  assert.strictEqual(P.detectPlace("det tar en time å kjøre"), null);
  assert.strictEqual(P.detectPlace("bygninger i Time kommune").name, "Time");
});
test("«Troms» forveksles ikke med «Tromsø»", function () {
  assert.strictEqual(P.detectPlace("trafikk i Tromsø").name, "Tromsø");
});
test("målpunkter og naturfare gjenkjennes", function () {
  assert.deepStrictEqual(P.detectTargets("avstand til sykehus og skole"), ["sykehus", "skole"]);
  assert.deepStrictEqual(P.detectHazards("flom og kvikkleire"), ["flom", "kvikkleire"]);
});
test("leveranse og verktøy gjenkjennes", function () {
  assert.strictEqual(P.detectDeliverable("kartet skal inn i en rapport som pdf"), "rapport");
  assert.strictEqual(P.detectDeliverable("lage et dashboard for oppfølging"), "dashboard");
  assert.strictEqual(P.detectTool("deles i ArcGIS Online"), "online");
  assert.strictEqual(P.detectTool("analysere i Python"), "vscode");
});
test("fylke i stedsfeltet behandles som fylke", function () {
  assert.strictEqual(P.buildPlan("befolkning per kommune", { place: "Vestland" }).place.type, "fylke");
});

console.log("Plattformvalg");
test("rapport → ArcGIS Pro eller QGIS øverst", function () {
  var top = P.buildPlan("bygninger i flomsone i Bergen til rapport").platforms[0].key;
  assert.ok(["arcgis", "qgis"].indexOf(top) !== -1, top);
});
test("dashboard → ArcGIS Online eller Power BI øverst", function () {
  var top = P.buildPlan("befolkning per kommune på et dashboard").platforms[0].key;
  assert.ok(["online", "powerbi"].indexOf(top) !== -1, top);
});
test("flytkart på nett → kepler.gl blant de to beste", function () {
  var p = P.buildPlan("flytkart over pendling som skal deles på nett");
  assert.ok(p.platforms.slice(0, 2).some(function (x) { return x.key === "kepler"; }), p.platforms.map(function (x) { return x.key; }).join(","));
});
test("verktøy du ikke har, flyttes ned", function () {
  var p = P.buildPlan("bygninger i flomsone til rapport", { available: ["qgis", "vscode"] });
  assert.strictEqual(p.platforms[0].key, "qgis");
  assert.ok(!p.platforms.filter(function (x) { return x.key === "arcgis"; })[0].available);
});

console.log("Nedlastingsskript");
var python = (function () {
  try { child.execFileSync("python3", ["--version"], { stdio: "ignore" }); return "python3"; } catch (e) { return null; }
})();
var tmp = fs.mkdtempSync(path.join(os.tmpdir(), "datafinner-"));
CASES.concat([["statistikk over inntekt for hele landet"], ["lage et fint kart"]]).forEach(function (c, i) {
  test("skript for «" + c[0].slice(0, 45) + "» er gyldig og kjører uten nett", function () {
    var plan = P.buildPlan(c[0]);
    var s = G.generate(plan);
    assert.ok(/^#!\/usr\/bin\/env python3/.test(s.code));
    assert.ok(s.autoCount + s.manual.length > 0, "ingen datasett");
    if (!python) return;
    var f = path.join(tmp, "skript_" + i + ".py");
    fs.writeFileSync(f, s.code);
    child.execFileSync(python, ["-m", "py_compile", f]);
    child.execFileSync(python, ["-I", path.join(__dirname, "script_offline_test.py"), f], { stdio: "pipe" });
  });
});
test("hvert datasett i en oppskrift har en nedlastingsmetode eller manuell lenke", function () {
  var plan = P.buildPlan("test i Bergen");
  K.RECIPES.forEach(function (r) {
    r.roles.forEach(function (role) {
      role.candidates.forEach(function (id) {
        var ds = DATA.filter(function (d) { return d.id === id; })[0];
        var jobs = G.jobsFor(ds, role, Object.assign({}, plan, { recipe: r }));
        assert.ok(jobs.length > 0, id);
        jobs.forEach(function (j) { assert.ok(j.call || j.manual || j.builtin, id + ": tom jobb"); });
      });
    });
  });
});
if (!python) console.log("  (python3 ikke funnet – hoppet over kjøring av skriptene)");

console.log("\n" + passed + " tester bestått" + (process.exitCode ? " – NOEN FEILET" : ""));
