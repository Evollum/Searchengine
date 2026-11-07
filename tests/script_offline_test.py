"""
Kjører et generert nedlastingsskript uten nett: API-kallene erstattes med svar i
samme format som de ekte API-ene (Geonorge, kommuneinfo, SSB, Overpass, NVDB,
Trafikkdata, Entur). Sjekker at alle jobber fullføres og at forespørslene ser riktige ut.

Bruk: python3 tests/script_offline_test.py <generert_skript.py>
"""
import importlib.util
import json
import sys
import tempfile
import urllib.parse
from pathlib import Path

sti = sys.argv[1]
spec = importlib.util.spec_from_file_location("skript", sti)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

tmp = Path(tempfile.mkdtemp())
mod.UT = tmp / "ut"
kall = []

AREAS = [
    {"code": "4601", "type": "kommune", "name": "Bergen",
     "projections": [{"code": "25832", "name": "EUREF89 UTM sone 32, 2d", "codespace": "x",
                      "formats": [{"name": "GML"}]},
                     {"code": "25833", "name": "EUREF89 UTM sone 33, 2d", "codespace": "x",
                      "formats": [{"name": "GML"}, {"name": "FGDB "}, {"name": "GeoJSON "}]}]},
    {"code": "46", "type": "fylke", "name": "Vestland",
     "projections": [{"code": "25833", "name": "EUREF89 UTM sone 33, 2d", "codespace": "x", "formats": [{"name": "SOSI"}]}]},
    {"code": "0000", "type": "landsdekkende", "name": "Hele landet",
     "projections": [{"code": "25833", "name": "EUREF89 UTM sone 33, 2d", "codespace": "x", "formats": [{"name": "FGDB"}, {"name": "GML"}]}]},
]


def fake_hent_json(url, data=None, headers=None, timeout=180):
    kall.append((url, data, headers))
    if "kommuneinfo" in url and "/sok" in url:
        return {"antallTreff": 1, "kommuner": [{"kommunenavn": "Bergen", "kommunenavnNorsk": "Bergen", "kommunenummer": "4601"}]}
    if "kommuneinfo" in url and "/omrade" in url:
        if "utkoordsys=25833" in url:
            ring = [[-30000, 6700000], [10000, 6700000], [10000, 6745000], [-30000, 6700000]]
        else:
            ring = [[5.1, 60.2], [5.6, 60.2], [5.6, 60.6], [5.1, 60.2]]
        return {"omrade": {"type": "MultiPolygon", "coordinates": [[ring]]}}
    if "kartkatalog.geonorge.no/api/search" in url:
        tekst = urllib.parse.parse_qs(urllib.parse.urlparse(url).query)["text"][0]
        return {"Results": [
            {"Uuid": "tjeneste", "Title": tekst + " WMS", "Type": "service"},
            {"Uuid": "uuid-" + tekst, "Title": tekst, "Type": "dataset"},
        ]}
    if "nedlasting.geonorge.no/api/codelists/area/" in url:
        if "FKB" in url:
            raise PermissionError("datasettet krever innlogging")   # FKB krever Norge digitalt-tilgang
        return AREAS
    if url.endswith("nedlasting.geonorge.no/api/order"):
        assert data["email"] == ""
        line = data["orderLines"][0]
        assert line["metadataUuid"] and line["areas"][0]["code"] and line["projections"][0]["code"] and line["formats"][0]["name"]
        return {"referenceNumber": "ref1", "files": [{"downloadUrl": "https://nedlasting.geonorge.no/api/download/order/ref1/f1",
                                                     "name": "fil.zip", "status": "WaitingForProcessing"}]}
    if "nedlasting.geonorge.no/api/order/ref1" in url:
        return {"referenceNumber": "ref1", "files": [{"downloadUrl": "https://nedlasting.geonorge.no/api/download/order/ref1/f1",
                                                     "name": "fil.zip", "status": "ReadyForDownload"}]}
    if "pxwebapi/v2/tables?" in url:
        return {"tables": [{"id": "12345", "label": "Testtabell"}]}
    if "pxwebapi/v2/tables/" in url and "/metadata" in url:
        return {"id": ["Region", "ContentsCode", "Tid"],
                "dimension": {"Region": {"category": {"index": {"0301": 0, "4601": 1}}}}}
    if "interpreter" in url:
        q = urllib.parse.parse_qs(data.decode())["data"][0]
        assert "(60.20000,5.10000,60.60000,5.60000)" in q, q
        return {"elements": [
            {"type": "way", "id": 1, "tags": {"building": "yes"},
             "geometry": [{"lat": 60.3, "lon": 5.3}, {"lat": 60.3, "lon": 5.31}, {"lat": 60.31, "lon": 5.31}, {"lat": 60.3, "lon": 5.3}]},
            {"type": "way", "id": 3, "tags": {"amenity": "hospital"}, "center": {"lat": 60.35, "lon": 5.35}},
            {"type": "node", "id": 2, "lat": 60.4, "lon": 5.4, "tags": {"amenity": "hospital"}},
        ]}
    if "nvdbapiles" in url:
        assert headers.get("X-Client")
        if "start=" in url:
            return {"objekter": [], "metadata": {"neste": {"start": "abc"}}}
        return {"objekter": [
            {"id": 1, "geometri": {"wkt": "POINT Z(297000.5 6700000.25 10)"}, "egenskaper": [{"navn": "Alvorlighetsgrad", "verdi": "Lettere skadd"}]},
            {"id": 2, "geometri": {"wkt": "LINESTRING Z(1 2 3, 4 5 6)"}, "egenskaper": [{"navn": "Fartsgrense", "verdi": 60}]},
        ], "metadata": {"neste": {"start": "abc"}}}
    if "trafikkdata-api" in url:
        q = data["query"]
        if "trafficRegistrationPoints" in q:
            assert "countyNumbers: [46]" in q, q
            return {"data": {"trafficRegistrationPoints": [
                {"id": "A1", "name": "Bergen sentrum", "location": {"municipality": {"number": 4601, "name": "Bergen"}, "coordinates": {"latLon": {"lat": 60.39, "lon": 5.32}}}},
                {"id": "B2", "name": "Annen kommune", "location": {"municipality": {"number": 4602, "name": "Kinn"}, "coordinates": {"latLon": {"lat": 61.6, "lon": 5.0}}}},
            ]}}
        return {"data": {"trafficData": {"volume": {"average": {"daily": {"byYear": [
            {"year": 2024, "total": {"volume": {"average": 15000}, "coverage": {"percentage": 98.5}}},
            {"year": 2025, "total": {"volume": {"average": 15500}, "coverage": {"percentage": 99.1}}}]}}}}}}
    if "mobility/v2/graphql" in url:
        assert headers.get("ET-Client-Name")
        return {"data": {"vehicles": [{"id": "v1", "lat": 59.91, "lon": 10.75, "currentRangeMeters": 12000,
                                       "vehicleType": {"formFactor": "SCOOTER_STANDING"}, "system": {"operator": {"id": "YVO:Operator:voi"}}}]}}
    raise AssertionError("uventet URL: " + url)


nedlastet = []


def fake_last_ned(url, mappe, filnavn=None, headers=None, pakk_ut=True):
    nedlastet.append(url)
    mappe.mkdir(parents=True, exist_ok=True)
    p = mappe / (filnavn or "fil")
    if p.suffix == ".tif":
        p.write_bytes(b"II*\x00data")
    else:
        p.write_text("x", encoding="utf-8")
    return p


mod.hent_json = fake_hent_json
mod.last_ned = fake_last_ned
mod.time.sleep = lambda s: None
mod.OMRADE, mod.OMRADE_TYPE = "Bergen", "kommune"   # testdataene gjelder Bergen

mod.main()

les_meg = (mod.UT / "LES_MEG.txt").read_text(encoding="utf-8")
assert "feilet" not in les_meg, les_meg
assert "hoppet over" not in les_meg, les_meg
assert (mod.UT / "00_avgrensning" / "kommunegrense.geojson").exists()
utm = json.loads((mod.UT / "00_avgrensning" / "kommunegrense_utm33.geojson").read_text(encoding="utf-8"))
assert utm["crs"]["properties"]["name"].endswith("25833")

# Geonorge: bestilling skal velge kommune, UTM33 og ønsket format
bestillinger = [d for u, d, h in kall if u.endswith("/api/order")]
for b in bestillinger:
    line = b["orderLines"][0]
    assert line["areas"][0]["code"] in ("4601", "46", "0000"), line
    assert line["projections"][0]["code"] == "25833", line
    if line["areas"][0]["code"] == "4601":
        assert line["formats"][0]["name"].strip() == mod.FORMATER[0] or line["formats"][0]["name"].strip() in mod.FORMATER, line

# Reserveløsning: FKB krever innlogging → bygninger fra OpenStreetMap
if "FKB-Bygning" in open(sti, encoding="utf-8").read():
    assert "erstatning fra OpenStreetMap" in les_meg, les_meg
    assert list(mod.UT.glob("*bygning*/bygninger_osm.geojson")), "mangler OSM-bygninger"

# WKT-parser
assert mod.wkt_til_geojson("POINT Z(1.5 2.5 3)") == {"type": "Point", "coordinates": [1.5, 2.5]}
assert mod.wkt_til_geojson("LINESTRING (1 2, 3 4)")["coordinates"] == [[1.0, 2.0], [3.0, 4.0]]
assert mod.wkt_til_geojson("POLYGON Z((0 0 0, 1 0 0, 1 1 0, 0 0 0))")["type"] == "Polygon"
assert mod.wkt_til_geojson("MULTILINESTRING ((0 0, 1 1), (2 2, 3 3))")["coordinates"][1] == [[2.0, 2.0], [3.0, 3.0]]

# Områdevalg
mod.KOMMUNE.clear()
assert mod.velg_omrade(AREAS)["type"] == "landsdekkende"
mod.KOMMUNE.update({"nummer": "4601", "fylke": "46"})
assert mod.velg_omrade(AREAS)["code"] == "4601"
assert mod.velg_omrade(AREAS, "land")["code"] == "0000"
assert mod.velg_omrade(AREAS, "fylke")["code"] == "46"
p, f = mod.velg_projeksjon_og_format(AREAS[0], ["FGDB", "GML"])
assert p["code"] == "25833" and f == "FGDB ", (p, f)

print("OK %s: %d API-kall, %d nedlastinger, %d bestillinger" % (Path(sti).name, len(kall), len(nedlastet), len(bestillinger)))
