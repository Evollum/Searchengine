/*
 * Verktøyspesifikke veiledninger: hvordan laste et datasett inn i
 * ArcGIS Pro, QGIS, VS Code/Python eller Excel, basert på format.
 */
(function (root) {
  "use strict";

  function fileName(ds, ext) {
    return ds.id.replace(/-/g, "_") + ext;
  }

  var ARCGIS = {
    "FGDB": function () { return ["Last ned og pakk ut .gdb-mappen.", "Catalog-panelet → høyreklikk «Databases» → «Add Database» → velg .gdb.", "Dra lagene inn i kartet."]; },
    "GeoPackage": function () { return ["Last ned .gpkg-filen.", "Map-fanen → «Add Data» → velg .gpkg → velg lag.", "Tips: Bruk «Feature Class To Geodatabase» for raskere analyse."]; },
    "Shapefile": function () { return ["Last ned og pakk ut zip-filen (behold .shp, .shx, .dbf, .prj samlet).", "Map → «Add Data» → velg .shp."]; },
    "GeoTIFF": function () { return ["Last ned .tif-filen(e).", "Map → «Add Data» → velg rasteren.", "Mange fliser? Bruk «Create Mosaic Dataset» eller «Mosaic To New Raster».", "Høydedata: Spatial Analyst → «Slope», «Hillshade», «Viewshed»."]; },
    "WMS": function (ds) { return ["Insert → «Connections» → «Server» → «New WMS Server».", "Lim inn WMS-URL fra " + (ds.api || ds.url) + ".", "Dra laget fra Catalog → Servers inn i kartet (kun visning, ikke analyse)."]; },
    "WFS": function (ds) { return ["Insert → «Connections» → «Server» → «New WFS Server».", "Lim inn WFS-URL fra " + (ds.api || ds.url) + ".", "Eksporter til geodatabase for analyse."]; },
    "WCS": function () { return ["Insert → «Connections» → «Server» → «New WCS Server».", "Lim inn WCS-URL og legg til dekningen som raster."]; },
    "Feature Service": function (ds) { return ["Map → «Add Data» → «Data From Path» → lim inn tjeneste-URL fra " + ds.url + ".", "Eller: Catalog → Portal → Living Atlas / ArcGIS Online og søk etter laget.", "Eksporter med «Export Features» hvis du vil ha en lokal kopi."]; },
    "Image Service": function () { return ["Catalog → Portal → Living Atlas, søk etter bildetjenesten og dra inn i kartet."]; },
    "Vector Tiles": function () { return ["Map → «Basemap» eller Catalog → Portal → Living Atlas.", "Brukes som bakgrunnskart."]; },
    "NetCDF": function () { return ["Multidimension-fanen → «Add Multidimensional Raster Layer» → velg .nc-fil.", "Eller verktøyet «Make NetCDF Raster Layer».", "Bruk tids-slideren for å bla gjennom tidssteg."]; },
    "CSV": function () { return ["Map → «Add Data» → velg .csv.", "Har tabellen koordinater: «XY Table To Point».", "Har den kommunenummer: «Add Join» mot kommunegrenser."]; },
    "XLSX": function () { return ["Map → «Add Data» → velg arket i .xlsx (krever Microsoft Access Database Engine).", "Koble til kartdata med «Add Join»."]; },
    "GeoJSON": function () { return ["Bruk verktøyet «JSON To Features» for å konvertere til feature class."]; },
    "LAZ": function () { return ["Bruk «Convert LAS» eller «Create LAS Dataset» for LAZ-filer.", "Lag terrengmodell med «LAS Dataset To Raster»."]; },
    "HDF": function () { return ["Map → «Add Data» → velg .hdf/.h5 og velg sub-datasett.", "Eller «Extract Subdataset»."]; },
    "GRIB": function () { return ["Multidimension → «Add Multidimensional Raster Layer» støtter GRIB."]; },
    "JP2": function () { return ["Map → «Add Data» → velg .jp2 (Sentinel-2-bånd ligger i IMG_DATA).", "Lag fargebilde med «Composite Bands»."]; },
    "ESRI ASCII": function () { return ["Bruk «ASCII To Raster»."]; },
    "SpatiaLite": function () { return ["Map → «Add Data» → velg .sqlite-filen (ArcGIS Pro leser SpatiaLite skrivebeskyttet).", "Eksporter til filgeodatabase for analyse."]; }
  };

  var ARCGIS_SPECIAL = {
    "nvdb-ruteplan": ["Last ned FGDB-versjonen fra Geonorge (handlekurv → velg «ESRI filgeodatabase»).", "Legg til .gdb i Catalog og åpne feature-datasettet – nettverksdatasettet ligger klart.", "Analysis → «Network Analysis» → velg nettverksdatasettet som kilde.", "Velg analysetype: «Route» (kjøretid A→B), «Service Area» (hvor langt når man på 10 min), «Closest Facility» (nærmeste sykehus/brannstasjon) eller «OD Cost Matrix».", "Krever Network Analyst-lisens (inngår i de fleste studentlisenser)."],
    "trafikkdata": ["Søk opp tellepunktet på trafikkdata.atlas.vegvesen.no og last ned CSV (time-/døgnverdier).", "Map → «Add Data» → velg CSV.", "Tellepunkter som kartlag: hent koordinater via API-et (se VS Code-fanen) og bruk «XY Table To Point».", "Visualiser ÅDT med «Graduated Symbols» eller koble til vegnett med «Spatial Join»."],
    "ssb-pendling": ["Last ned tabell 03321 som CSV fra ssb.no/statbank (avgrens på kommuner og år).", "Map → «Add Data» → CSV. Kommunenummer må være tekst med 4 siffer (f.eks. 0301).", "Lag pendlingslinjer med «XY To Line» (fra bosteds- til arbeidskommunens senterpunkt – lag punktene med «Feature To Point» på kommunegrensene).", "Symboliser linjene med «Graduated Symbols» på antall pendlere = flytkart."],
    "entur-reiseplan": ["Reisetidsberegning skjer via API – kjør Python-koden (VS Code-fanen) og lagre resultatet som CSV.", "Map → «Add Data» → CSV, og «XY Table To Point» for start-/målpunkter.", "Alternativ helt i ArcGIS: last ned GTFS fra Entur og bruk «GTFS To Network Dataset Transit Sources» for kollektiv nettverksanalyse (Network Analyst)."],
    "nvdb": ["Gå til vegkart.atlas.vegvesen.no, velg vegobjekttype (f.eks. Fartsgrense, Trafikkmengde, Trafikkulykke) og område.", "Eksporter som Excel/CSV med koordinater, eller som GeoJSON.", "GeoJSON → «JSON To Features». CSV → «XY Table To Point» (EUREF89 UTM33, EPSG:25833)."]
  };

  var QGIS = {
    "GeoPackage": function () { return ["Dra .gpkg-filen rett inn i kartvinduet, eller Layer → Add Layer → Add Vector Layer."]; },
    "GeoTIFF": function () { return ["Dra .tif-filen inn i QGIS.", "Mange fliser: Raster → Miscellaneous → Build Virtual Raster (VRT)."]; },
    "Shapefile": function () { return ["Dra .shp-filen (eller zip-filen) inn i QGIS."]; },
    "GeoJSON": function () { return ["Dra .geojson-filen inn i QGIS."]; },
    "FGDB": function () { return ["Layer → Add Layer → Add Vector Layer → «Directory» → type «OpenFileGDB» → velg .gdb-mappen."]; },
    "WMS": function (ds) { return ["Browser-panelet → høyreklikk «WMS/WMTS» → New Connection.", "Lim inn WMS-URL fra " + (ds.api || ds.url) + "."]; },
    "WFS": function (ds) { return ["Browser → høyreklikk «WFS / OGC API Features» → New Connection.", "Lim inn WFS-URL fra " + (ds.api || ds.url) + "."]; },
    "WCS": function () { return ["Browser → høyreklikk «WCS» → New Connection og lim inn URL."]; },
    "CSV": function () { return ["Layer → Add Layer → Add Delimited Text Layer.", "Velg X/Y-kolonner for punkter, eller «No geometry» og koble med Joins i Layer Properties."]; },
    "NetCDF": function () { return ["Dra .nc-filen inn i QGIS og velg variabel. Bruk Temporal Controller for tid."]; },
    "GeoParquet": function () { return ["QGIS 3.32+ kan dra .parquet-filer rett inn (GDAL ≥ 3.8)."]; },
    "LAZ": function () { return ["Dra .laz-filen inn i QGIS (3.18+) for 3D-punktsky.", "Processing → Point cloud → Export to raster for terrengmodell."]; },
    "PBF": function () { return ["Dra .osm.pbf inn i QGIS og velg lag (points, lines, multipolygons).", "Tips: Shapefile-uttrekket fra Geofabrik er enklere å jobbe med."]; },
    "SOSI": function () { return ["Velg heller GeoPackage eller FGDB ved nedlasting – SOSI krever ekstra plugin."]; },
    "XLSX": function () { return ["Dra .xlsx-filen inn i QGIS – hvert ark blir en tabell."]; },
    "Feature Service": function (ds) { return ["Browser → høyreklikk «ArcGIS REST Servers» → New Connection → lim inn URL fra " + ds.url + "."]; },
    "GML": function () { return ["Dra .gml-filen inn i QGIS."]; },
    "TopoJSON": function () { return ["Dra .topojson-filen inn i QGIS."]; },
    "JP2": function () { return ["Dra .jp2-båndene inn i QGIS; lag fargebilde med Raster → Miscellaneous → Merge/Build Virtual Raster (separate bands)."]; },
    "ESRI ASCII": function () { return ["Dra .asc-filen inn i QGIS."]; },
    "SpatiaLite": function () { return ["Browser → høyreklikk «SpatiaLite» → New Connection → velg .sqlite-filen.", "Nettverksanalyse: Processing Toolbox → «Network analysis» → «Shortest path» / «Service area»."]; }
  };

  var PY = {
    "CSV": function (ds) { return { lang: "python", install: "pip install pandas", code: "import pandas as pd\n\ndf = pd.read_csv(\"" + fileName(ds, ".csv") + "\")\nprint(df.head())\nprint(df.describe())" }; },
    "TSV": function (ds) { return { lang: "python", install: "pip install pandas", code: "import pandas as pd\n\ndf = pd.read_csv(\"" + fileName(ds, ".tsv") + "\", sep=\"\\t\")\nprint(df.head())" }; },
    "XLSX": function (ds) { return { lang: "python", install: "pip install pandas openpyxl", code: "import pandas as pd\n\ndf = pd.read_excel(\"" + fileName(ds, ".xlsx") + "\")\nprint(df.head())" }; },
    "Parquet": function (ds) { return { lang: "python", install: "pip install pandas pyarrow", code: "import pandas as pd\n\ndf = pd.read_parquet(\"" + fileName(ds, ".parquet") + "\")\nprint(df.shape)\nprint(df.head())" }; },
    "GeoParquet": function (ds) { return { lang: "python", install: "pip install geopandas pyarrow", code: "import geopandas as gpd\n\ngdf = gpd.read_parquet(\"" + fileName(ds, ".parquet") + "\")\nprint(gdf.crs, len(gdf))\ngdf.plot()" }; },
    "GeoJSON": function (ds) { return { lang: "python", install: "pip install geopandas", code: "import geopandas as gpd\n\ngdf = gpd.read_file(\"" + fileName(ds, ".geojson") + "\")\nprint(gdf.crs)\ngdf.explore()  # interaktivt kart i Jupyter" }; },
    "GeoPackage": function (ds) { return { lang: "python", install: "pip install geopandas", code: "import geopandas as gpd\nimport pyogrio\n\nprint(pyogrio.list_layers(\"" + fileName(ds, ".gpkg") + "\"))\ngdf = gpd.read_file(\"" + fileName(ds, ".gpkg") + "\", layer=0)\ngdf.plot()" }; },
    "Shapefile": function (ds) { return { lang: "python", install: "pip install geopandas", code: "import geopandas as gpd\n\ngdf = gpd.read_file(\"" + fileName(ds, ".shp") + "\")\ngdf = gdf.to_crs(25833)  # EUREF89 UTM33 for Norge\ngdf.plot()" }; },
    "FGDB": function (ds) { return { lang: "python", install: "pip install geopandas", code: "import geopandas as gpd\nimport pyogrio\n\npath = \"" + fileName(ds, ".gdb") + "\"\nprint(pyogrio.list_layers(path))\ngdf = gpd.read_file(path, layer=0)" }; },
    "GeoTIFF": function (ds) { return { lang: "python", install: "pip install rasterio matplotlib", code: "import rasterio\nfrom rasterio.plot import show\n\nwith rasterio.open(\"" + fileName(ds, ".tif") + "\") as src:\n    print(src.crs, src.res, src.bounds)\n    arr = src.read(1)\n    show(src)" }; },
    "NetCDF": function (ds) { return { lang: "python", install: "pip install xarray netCDF4 matplotlib", code: "import xarray as xr\n\nds = xr.open_dataset(\"" + fileName(ds, ".nc") + "\")\nprint(ds)\n# Eksempel: plott første tidssteg av første variabel\nvar = list(ds.data_vars)[0]\nds[var].isel(time=0).plot()" }; },
    "OPeNDAP": function (ds) { return { lang: "python", install: "pip install xarray netCDF4", code: "import xarray as xr\n\n# Finn OPeNDAP-URL i katalogen: " + ds.url + "\nurl = \"https://thredds.met.no/thredds/dodsC/...\"\nds = xr.open_dataset(url)  # leser bare det du trenger\nprint(ds)" }; },
    "GRIB": function (ds) { return { lang: "python", install: "pip install xarray cfgrib", code: "import xarray as xr\n\nds = xr.open_dataset(\"" + fileName(ds, ".grib") + "\", engine=\"cfgrib\")\nprint(ds)" }; },
    "HDF": function (ds) { return { lang: "python", install: "pip install xarray h5netcdf", code: "import xarray as xr\n\nds = xr.open_dataset(\"" + fileName(ds, ".h5") + "\", engine=\"h5netcdf\")\nprint(ds)" }; },
    "LAZ": function (ds) { return { lang: "python", install: "pip install \"laspy[lazrs]\"", code: "import laspy\n\nlas = laspy.read(\"" + fileName(ds, ".laz") + "\")\nprint(las.header.point_count)\nprint(list(las.point_format.dimension_names))" }; },
    "PBF": function (ds) { return { lang: "python", install: "pip install pyrosm", code: "from pyrosm import OSM\n\nosm = OSM(\"norway-latest.osm.pbf\")\nroads = osm.get_network(network_type=\"driving\")\nbuildings = osm.get_buildings()" }; },
    "GTFS": function () { return { lang: "python", install: "pip install pandas", code: "import zipfile, pandas as pd\n\nz = zipfile.ZipFile(\"gtfs.zip\")\nstops = pd.read_csv(z.open(\"stops.txt\"))\nprint(stops.head())" }; },
    "JSON-stat": function () { return { lang: "python", install: "pip install requests pandas pyjstat", code: "import requests\nfrom pyjstat import pyjstat\n\n# Eksempel: SSB tabell 07459 (befolkning). Bygg spørring på ssb.no/statbank\nurl = \"https://data.ssb.no/api/v0/no/table/07459\"\nquery = {\"query\": [], \"response\": {\"format\": \"json-stat2\"}}\nr = requests.post(url, json=query)\ndf = pyjstat.from_json_stat(r.json(), naming=\"label\")[0]\nprint(df.head())" }; },
    "STAC API": function () { return { lang: "python", install: "pip install pystac-client", code: "from pystac_client import Client\n\ncat = Client.open(\"https://stac.dataspace.copernicus.eu/v1\")\nitems = cat.search(collections=[\"sentinel-2-l2a\"],\n                   bbox=[10.6, 59.85, 10.9, 60.0],  # Oslo\n                   datetime=\"2024-06-01/2024-08-31\",\n                   max_items=5).item_collection()\nfor it in items:\n    print(it.id, it.properties.get(\"eo:cloud_cover\"))" }; },
    "REST API": function (ds) { return { lang: "python", install: "pip install requests pandas", code: "import requests\nimport pandas as pd\n\n# Dokumentasjon: " + (ds.api || ds.url) + "\nr = requests.get(\"" + (ds.api || ds.url) + "\", timeout=30)\nr.raise_for_status()\ndata = r.json()\n# df = pd.json_normalize(data)" }; },
    "JSON": function (ds) { return { lang: "python", install: "pip install pandas", code: "import json, pandas as pd\n\nwith open(\"" + fileName(ds, ".json") + "\") as f:\n    data = json.load(f)\ndf = pd.json_normalize(data)\nprint(df.head())" }; },
    "SpatiaLite": function (ds) { return { lang: "python", install: "pip install geopandas networkx", code: "import geopandas as gpd\nimport pyogrio\n\npath = \"" + fileName(ds, ".sqlite") + "\"\nprint(pyogrio.list_layers(path))\nveg = gpd.read_file(path, layer=0)\nprint(veg.columns)" }; },
    "XML": function (ds) { return { lang: "python", install: "pip install requests lxml pandas", code: "import requests\nimport pandas as pd\n\n# Dokumentasjon: " + (ds.api || ds.url) + "\nr = requests.get(\"" + ds.url + "\", timeout=30)\ndf = pd.read_xml(r.content)\nprint(df.head())" }; },
    "ARFF": function (ds) { return { lang: "python", install: "pip install scipy pandas", code: "from scipy.io import arff\nimport pandas as pd\n\ndata, meta = arff.loadarff(\"" + fileName(ds, ".arff") + "\")\ndf = pd.DataFrame(data)" }; }
  };

  // Spesialtilpassede Python-snippets for kjente datasett
  var PY_SPECIAL = {
    "entur-mobility": { lang: "python", install: "pip install requests pandas", code: "import requests, pandas as pd\n\n# Delte kjøretøy innen 1 km fra Oslo S\nq = \"\"\"{ vehicles(lat: 59.911, lon: 10.753, range: 1000, count: 500) {\n  id lat lon currentRangeMeters\n  system { id }\n  vehicleType { formFactor propulsionType } } }\"\"\"\nr = requests.post(\"https://api.entur.io/mobility/v2/graphql\", json={\"query\": q},\n                  headers={\"ET-Client-Name\": \"mitt-navn-prosjekt\"})\ndf = pd.json_normalize(r.json()[\"data\"][\"vehicles\"])\nprint(df.groupby([\"system.id\", \"vehicleType.formFactor\"]).size())\n# Tips: kjør hvert 5. minutt og lagre til Parquet for å bygge historikk" },
    "entur-reiseplan": { lang: "python", install: "pip install requests", code: "import requests\n\n# Reisetid med kollektiv fra Oslo S til Blindern\nq = \"\"\"{ trip(from: {coordinates: {latitude: 59.911, longitude: 10.753}},\n           to:   {coordinates: {latitude: 59.940, longitude: 10.722}},\n           numTripPatterns: 3) {\n  tripPatterns { duration walkDistance\n    legs { mode line { publicCode } fromPlace { name } toPlace { name } } } } }\"\"\"\nr = requests.post(\"https://api.entur.io/journey-planner/v3/graphql\", json={\"query\": q},\n                  headers={\"ET-Client-Name\": \"mitt-navn-prosjekt\"})\nfor p in r.json()[\"data\"][\"trip\"][\"tripPatterns\"]:\n    print(round(p[\"duration\"] / 60), \"min:\", [(l[\"mode\"], (l[\"line\"] or {}).get(\"publicCode\")) for l in p[\"legs\"]])\n# Løkke over mange start/mål-par gir en reisetidsmatrise (OD-matrise)" },
    "ssb-pendling": { lang: "python", install: "pip install requests pandas pyjstat", code: "import requests\nfrom pyjstat import pyjstat\n\n# Tabell 03321: sysselsatte etter bosted og arbeidssted.\n# Lag spørringen på ssb.no/statbank/table/03321 → «API-spørring for denne tabellen»\n# og lim inn query-delen her (tabellen er stor – avgrens på kommuner og år).\nquery = {\"query\": [\n    # {\"code\": \"Bokommuen\", \"selection\": {\"filter\": \"item\", \"values\": [\"4601\"]}},\n], \"response\": {\"format\": \"json-stat2\"}}\nr = requests.post(\"https://data.ssb.no/api/v0/no/table/03321\", json=query)\ndf = pyjstat.from_json_stat(r.json(), naming=\"label\")[0]\nprint(df.sort_values(\"value\", ascending=False).head(20))" },
    trafikkdata: { lang: "python", install: "pip install requests pandas", code: "import requests, pandas as pd\n\nAPI = \"https://trafikkdata-api.atlas.vegvesen.no/\"\n\n# 1) Finn tellepunkter (her: Oslo, fylke 3)\nq_points = \"\"\"{ trafficRegistrationPoints(searchQuery: {countyNumbers: [3]}) {\n  id name location { coordinates { latLon { lat lon } } } } }\"\"\"\npoints = requests.post(API, json={\"query\": q_points}).json()[\"data\"][\"trafficRegistrationPoints\"]\nprint(len(points), points[0])\n\n# 2) Timetrafikk for ett punkt (bytt ID – finn den på trafikkdata.no)\nq_vol = \"\"\"{ trafficData(trafficRegistrationPointId: \"%s\") { volume { byHour(\n  from: \"2024-09-02T00:00:00+02:00\", to: \"2024-09-09T00:00:00+02:00\") {\n  edges { node { from total { volumeNumbers { volume } } } } } } } }\"\"\" % points[0][\"id\"]\nedges = requests.post(API, json={\"query\": q_vol}).json()[\"data\"][\"trafficData\"][\"volume\"][\"byHour\"][\"edges\"]\ndf = pd.DataFrame([{\"tid\": e[\"node\"][\"from\"],\n                    \"antall\": (e[\"node\"][\"total\"][\"volumeNumbers\"] or {}).get(\"volume\")} for e in edges])\ndf[\"tid\"] = pd.to_datetime(df[\"tid\"], utc=True)\ndf.set_index(\"tid\")[\"antall\"].plot(title=\"Kjøretøy per time\")" },
    bysykkel: { lang: "python", install: "pip install pandas requests", code: "import pandas as pd, requests\n\n# Historiske turer – én fil per måned\ntrips = pd.read_csv(\"https://data.urbansharing.com/oslobysykkel.no/trips/v1/2024/06.csv\")\nprint(trips[[\"start_station_name\", \"end_station_name\", \"duration\"]].head())\nprint(trips.start_station_name.value_counts().head(10))\n\n# Sanntid (GBFS) – oppgi et Client-Identifier\nh = {\"Client-Identifier\": \"mitt-navn-prosjekt\"}\nstatus = requests.get(\"https://gbfs.urbansharing.com/oslobysykkel.no/station_status.json\", headers=h).json()" },
    "avinor-flydata": { lang: "python", install: "pip install requests pandas lxml", code: "import requests, pandas as pd\n\n# Avganger fra Oslo lufthavn neste 7 timer\nr = requests.get(\"https://flydata.avinor.no/XmlFeed.asp\",\n                 params={\"airport\": \"OSL\", \"direction\": \"D\", \"TimeFrom\": 1, \"TimeTo\": 7})\ndf = pd.read_xml(r.content, xpath=\".//flight\")\nprint(df.head())" },
    "nvdb-ruteplan": { lang: "python", install: "pip install geopandas networkx momepy", code: "import geopandas as gpd, pyogrio, momepy, networkx as nx\n\npath = \"nvdb_ruteplan.sqlite\"  # eller .gdb\nprint(pyogrio.list_layers(path))\nveg = gpd.read_file(path, layer=\"<lenkelag>\")  # velg lenkelaget fra listen over\n\n# Bygg graf og regn korteste vei (lengde i meter)\nG = momepy.gdf_to_nx(veg.explode(index_parts=False), approach=\"primal\")\nnoder = list(G.nodes)\nlengde = nx.shortest_path_length(G, noder[0], noder[100], weight=\"mm_len\")\nprint(round(lengde), \"m\")" },
    huggingface: { lang: "python", install: "pip install datasets", code: "from datasets import load_dataset\n\n# Bytt ut med datasett-ID fra huggingface.co/datasets\nds = load_dataset(\"NbAiLab/NCC\", split=\"train\", streaming=True)\nfor row in ds.take(3):\n    print(row)" },
    kaggle: { lang: "bash", install: "pip install kaggle  # legg API-nøkkel i ~/.kaggle/kaggle.json", code: "kaggle datasets download -d <eier>/<datasett> --unzip -p data/" },
    overture: { lang: "python", install: "pip install duckdb", code: "import duckdb\n\ncon = duckdb.connect()\ncon.sql(\"INSTALL spatial; LOAD spatial; INSTALL httpfs; LOAD httpfs;\")\n# Bygninger i Oslo-området. Sjekk docs.overturemaps.org for siste release-dato.\ndf = con.sql(\"\"\"\n  SELECT id, names.primary AS name, height, ST_AsText(geometry) AS wkt\n  FROM read_parquet('s3://overturemaps-us-west-2/release/<RELEASE>/theme=buildings/type=building/*', hive_partitioning=1)\n  WHERE bbox.xmin > 10.6 AND bbox.xmax < 10.9 AND bbox.ymin > 59.85 AND bbox.ymax < 60.0\n  LIMIT 1000\n\"\"\").df()" },
    "ssb-statbank": PY["JSON-stat"](),
    "copernicus-dataspace": PY["STAC API"](),
    "frost-met": { lang: "python", install: "pip install requests pandas", code: "import requests, pandas as pd\n\nCLIENT_ID = \"din-klient-id\"  # registrer på frost.met.no\nr = requests.get(\"https://frost.met.no/observations/v0.jsonld\",\n    params={\"sources\": \"SN18700\",  # Oslo - Blindern\n            \"elements\": \"mean(air_temperature P1D)\",\n            \"referencetime\": \"2024-01-01/2024-12-31\"},\n    auth=(CLIENT_ID, \"\"))\nrows = [{\"tid\": d[\"referenceTime\"], \"temp\": o[\"value\"]}\n        for d in r.json()[\"data\"] for o in d[\"observations\"]]\ndf = pd.DataFrame(rows)" },
    adresser: { lang: "python", install: "pip install requests", code: "import requests\n\nr = requests.get(\"https://ws.geonorge.no/adresser/v1/sok\",\n                 params={\"sok\": \"Karl Johans gate 1, Oslo\", \"treffPerSide\": 1})\nadr = r.json()[\"adresser\"][0]\nprint(adr[\"adressetekst\"], adr[\"representasjonspunkt\"])" },
    era5: { lang: "python", install: "pip install cdsapi xarray netCDF4  # API-nøkkel i ~/.cdsapirc", code: "import cdsapi\n\nc = cdsapi.Client()\nc.retrieve(\"reanalysis-era5-single-levels\", {\n    \"product_type\": [\"reanalysis\"],\n    \"variable\": [\"2m_temperature\"],\n    \"year\": [\"2024\"], \"month\": [\"07\"], \"day\": [\"01\"],\n    \"time\": [\"12:00\"],\n    \"area\": [72, 4, 57, 32],  # N, W, S, E (Norge)\n    \"data_format\": \"netcdf\",\n}, \"era5_norge.nc\")" },
    gbif: { lang: "python", install: "pip install pygbif pandas", code: "from pygbif import occurrences\nimport pandas as pd\n\nres = occurrences.search(scientificName=\"Lynx lynx\", country=\"NO\", limit=300)\ndf = pd.DataFrame(res[\"results\"])[[\"scientificName\", \"decimalLatitude\", \"decimalLongitude\", \"eventDate\"]]" },
    worldbank: { lang: "python", install: "pip install wbgapi", code: "import wbgapi as wb\n\n# BNP per innbygger for de nordiske landene\ndf = wb.data.DataFrame(\"NY.GDP.PCAP.CD\", [\"NOR\", \"SWE\", \"DNK\", \"FIN\", \"ISL\"], time=range(2000, 2024))\nprint(df.T.tail())" },
    owid: { lang: "python", install: "pip install pandas", code: "import pandas as pd\n\ndf = pd.read_csv(\"https://owid-public.owid.io/data/co2/owid-co2-data.csv\")\nprint(df[df.country == \"Norway\"][[\"year\", \"co2\", \"co2_per_capita\"]].tail())" },
    "osm-geofabrik": PY["PBF"](),
    nvdb: { lang: "python", install: "pip install requests pandas", code: "import requests, pandas as pd\n\n# Fartsgrenser (vegobjekttype 105) i Oslo kommune (0301)\nr = requests.get(\"https://nvdbapiles.atlas.vegvesen.no/vegobjekter/api/v4/vegobjekter/105\",\n                 params={\"kommune\": 301, \"inkluder\": \"egenskaper,geometri\", \"antall\": 100},\n                 headers={\"X-Client\": \"min-app\", \"Accept\": \"application/json\"})\nobjekter = r.json()[\"objekter\"]\nprint(len(objekter))" }
  };

  var EXCEL = {
    "XLSX": function () { return ["Last ned .xlsx og åpne direkte i Excel."]; },
    "CSV": function () { return ["Excel: Data → «Fra tekst/CSV» (velg riktig skilletegn og UTF-8 for æøå).", "Power BI: Hent data → Tekst/CSV."]; },
    "TSV": function () { return ["Data → «Fra tekst/CSV» og velg tabulator som skilletegn."]; },
    "JSON": function () { return ["Data → Hent data → Fra fil → Fra JSON (Power Query)."]; },
    "REST API": function (ds) { return ["Data → Hent data → «Fra nett» → lim inn API-URL fra " + (ds.api || ds.url) + ".", "Bruk Power Query til å pakke ut JSON til tabell."]; }
  };

  function forTool(ds, toolKey) {
    var formats = ds.formats;
    var steps = [];
    var code = null;
    var usedFormat = null;

    if (toolKey === "vscode") {
      if (PY_SPECIAL[ds.id]) {
        code = PY_SPECIAL[ds.id];
      } else {
        for (var i = 0; i < formats.length && !code; i++) {
          if (PY[formats[i]]) { code = PY[formats[i]](ds); usedFormat = formats[i]; }
        }
      }
      steps.push("Opprett et prosjekt i VS Code og et virtuelt miljø: python -m venv .venv");
      steps.push("Installer utvidelsene «Python» og «Jupyter» for å kjøre koden som notebook (.ipynb).");
      if (ds.login) steps.push("Krever gratis bruker/API-nøkkel – lagre nøkkelen i en .env-fil, ikke i koden.");
      return { steps: steps, code: code, format: usedFormat };
    }

    if (toolKey === "arcgis" && ARCGIS_SPECIAL[ds.id]) {
      return { steps: ARCGIS_SPECIAL[ds.id].slice(), code: null, format: ds.formats.indexOf("FGDB") !== -1 ? "FGDB" : ds.formats[0] };
    }

    var table = toolKey === "arcgis" ? ARCGIS : toolKey === "qgis" ? QGIS : toolKey === "excel" ? EXCEL : null;
    if (!table) return null;

    // Velg beste format etter verktøyets preferanse
    var prefs = (root.DatasetSearch || (typeof require !== "undefined" ? require("./search.js") : {})).TOOLS[toolKey].formats;
    var available = prefs.filter(function (f) { return formats.indexOf(f) !== -1 && table[f]; });
    if (!available.length) {
      return { steps: ["Dette datasettet har ingen format som passer direkte i dette verktøyet. Prøv å konvertere med QGIS eller GDAL (ogr2ogr / gdal_translate)."], code: null, format: null };
    }
    usedFormat = available[0];
    steps = table[usedFormat](ds);
    if (available.length > 1) steps.push("Andre formater som fungerer: " + available.slice(1).join(", ") + ".");
    if (ds.login) steps.push("Krever gratis brukerkonto for nedlasting.");
    return { steps: steps, code: null, format: usedFormat };
  }

  var api = { forTool: forTool };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.HowTo = api;
})(this);
