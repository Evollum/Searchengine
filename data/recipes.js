/*
 * Kunnskapsbase for oppgaveplanleggeren.
 *
 *  RECIPES    oppgavetyper («oppskrifter»): hvilke data som trengs (roller),
 *             karttype og analysesteg per verktøy.
 *  MAPTYPES   karttyper: når de brukes, kartografiske råd, symbolisering per
 *             verktøy og lenker til gode eksempler.
 *  PLATFORMS  hvor kartet kan lages (ArcGIS Pro, ArcGIS Online, QGIS ...).
 *  DELIVERABLES  hva sluttproduktet er (rapport, nett, dashboard ...).
 *  TARGETS    målpunkter for tilgjengelighetsanalyser (hentes fra OpenStreetMap).
 *  HAZARDS    typer naturfare (styrer hvilke NVE-data som lastes ned).
 *  PLACES     kommune- og fylkesnavn som gjenkjennes i oppgaveteksten.
 *
 * Verktøynøkler i steg: arcgis, online, qgis, vscode.
 */
(function (root) {
  "use strict";

  // ------------------------------------------------------------ Oppskrifter
  var RECIPES = [
    {
      id: "naturfare",
      name: "Eksponering for naturfare",
      description: "Finne bygninger, veier eller innbyggere som ligger i flomsone, skredfareområde, kvikkleiresone eller områder utsatt for stormflo.",
      keywords: ["flom", "flomsone", "flomfare", "skred", "skredfare", "ras", "kvikkleire", "stormflo", "havnivå", "naturfare", "klimatilpasning", "beredskap", "risiko", "sårbarhet", "ros-analyse", "utsatt", "fareområde", "aktsomhet", "oversvømmelse"],
      mapType: "overlay",
      roles: [
        { key: "fare", label: "Fareområder", candidates: ["nve-nedlasting", "ngu"] },
        { key: "objekter", label: "Bygninger / objekter som kan bli berørt", candidates: ["fkb", "osm-geofabrik", "overture", "adresser"] },
        { key: "befolkning", label: "Befolkning (valgfritt)", candidates: ["ssb-rutenett"], optional: true },
        { key: "avgrensning", label: "Avgrensning (kommunegrense)", candidates: ["admin-enheter"] },
        { key: "bakgrunn", label: "Bakgrunnskart", candidates: ["n50-kartdata"] }
      ],
      analysis: {
        arcgis: [
          "Select By Location: velg bygninger som «Intersect» fareområdet.",
          "Export Features på utvalget → «bygninger_i_faresone».",
          "Summary Statistics (eller Summarize Within) for antall bygninger per fareklasse / gjentaksintervall.",
          "Valgfritt: Summarize Within med befolkningsrutenettet for å anslå antall berørte innbyggere."
        ],
        qgis: [
          "Vector → Research Tools → Select by Location (intersect) mot fareområdet.",
          "Høyreklikk laget → Export → Save Selected Features As (GeoPackage).",
          "Processing → «Count points in polygon» / «Join attributes by location (summary)» for antall per sone."
        ],
        vscode: [
          "berort = gpd.sjoin(bygg, fare, predicate=\"intersects\")",
          "berort.groupby(\"<fareklasse-kolonne>\").size() gir antall per klasse.",
          "Lagre: berort.to_file(\"resultat.gpkg\", layer=\"berorte_bygg\")."
        ],
        online: [
          "Map Viewer → Analysis → «Find locations» → «Find by location»: bygninger som skjærer fareområdet.",
          "Analysis → «Summarize data» → «Summarize within» for antall per sone (bruker kreditter)."
        ]
      },
      tips: [
        "Si tydelig hvilket gjentaksintervall (f.eks. 200-årsflom) og hvilket klimapåslag kartet viser.",
        "Aktsomhetskart er grovere enn faresonekart. Skill dem i tegnforklaringen."
      ]
    },
    {
      id: "statistikk-kommune",
      name: "Statistikk per kommune eller fylke",
      description: "Vise befolkning, inntekt, alder, bolig eller annen SSB-statistikk på kart per kommune eller fylke.",
      keywords: ["statistikk", "befolkning", "innbyggere", "befolkningsvekst", "inntekt", "alder", "eldre", "barn", "bolig", "arbeidsledighet", "utdanning", "folketall", "per kommune", "per fylke", "kommunevis", "fylkesvis", "andel", "kostra", "ssb"],
      mapType: "koroplet",
      roles: [
        { key: "statistikk", label: "Statistikk", candidates: ["ssb-statbank", "ssb-kollektiv", "ssb-bilparken"] },
        { key: "grenser", label: "Kommune-/fylkesgrenser", candidates: ["admin-enheter"] }
      ],
      analysis: {
        arcgis: [
          "Sørg for at kommunenummer er tekst med fire siffer i begge tabeller (0301, ikke 301).",
          "Høyreklikk grenselaget → Joins and Relates → Add Join på kommunenummer.",
          "Calculate Field: lag en normalisert verdi (andel, per 1000 innbyggere eller endring i prosent)."
        ],
        qgis: [
          "Layer Properties → Joins → koble CSV-tabellen på kommunenummer.",
          "Field Calculator: lag en normalisert verdi (andel eller per 1000 innbyggere)."
        ],
        vscode: [
          "stat[\"kommunenummer\"] = stat[\"region\"].str[:4]  # tilpass kolonnenavn",
          "kart = kommuner.merge(stat, on=\"kommunenummer\")",
          "kart[\"per_1000\"] = kart[\"verdi\"] / kart[\"innbyggere\"] * 1000"
        ],
        online: [
          "Last opp CSV-en og kartlaget, og bruk Analysis → «Join features» på kommunenummer.",
          "Alternativ uten opplasting: søk i Living Atlas etter ferdige lag med norsk statistikk."
        ]
      },
      tips: [
        "Bruk andeler eller tetthet, ikke råtall: store kommuner blir ellers alltid «mest».",
        "Kommunesammenslåinger endrer kommunenummer. Bruk tall og grenser fra samme år."
      ]
    },
    {
      id: "befolkningstetthet",
      name: "Befolkningstetthet og bosetting",
      description: "Vise hvor folk bor med befolkning på rutenett, eller finne hvor mange som bor innenfor et område.",
      keywords: ["befolkningstetthet", "tetthet", "hvor folk bor", "bosetting", "rutenett", "bosatte", "tettsted", "spredt", "innbyggere innenfor", "befolkningsgrunnlag", "nedslagsfelt"],
      mapType: "rutenett",
      roles: [
        { key: "befolkning", label: "Befolkning på rutenett", candidates: ["ssb-rutenett", "worldpop"] },
        { key: "tettsteder", label: "Tettsteder (valgfritt)", candidates: ["ssb-tettsteder"], optional: true },
        { key: "avgrensning", label: "Avgrensning", candidates: ["admin-enheter"] },
        { key: "bakgrunn", label: "Bakgrunnskart", candidates: ["n50-kartdata"] }
      ],
      analysis: {
        arcgis: ["Pairwise Clip rutenettet til kommunegrensen.", "Summary Statistics på befolkningskolonnen gir totalen. Summarize Within gir antall per delområde."],
        qgis: ["Vector → Geoprocessing → Clip til kommunegrensen.", "Processing → «Join attributes by location (summary)» for sum per område."],
        vscode: ["ruter = gpd.clip(ruter, kommune)", "ruter[\"<befolkningskolonne>\"].sum()"],
        online: ["Analysis → «Summarize within» med kommune- eller sonelaget."]
      },
      tips: ["Vis tomme ruter som gjennomsiktige, ellers drukner bebyggelsen.", "250 m-ruter passer for kommuner, 1 km-ruter for fylke eller land."]
    },
    {
      id: "trafikkmengde",
      name: "Trafikkmengde på vegnettet",
      description: "Kart over ÅDT, timetrafikk, rushtid eller utvikling i trafikk på veger og tellepunkter.",
      keywords: ["trafikkmengde", "ådt", "årsdøgntrafikk", "trafikkvolum", "tellepunkt", "trafikkteller", "rushtid", "kø", "timetrafikk", "tungtrafikk", "trafikkutvikling", "trafikkbelastning", "trafikk"],
      mapType: "linjer",
      roles: [
        { key: "tellepunkter", label: "Trafikk fra tellepunkter", candidates: ["trafikkdata"] },
        { key: "vegnett", label: "Vegnett med trafikkmengde", candidates: ["nvdb"] },
        { key: "avgrensning", label: "Avgrensning", candidates: ["admin-enheter"] },
        { key: "bakgrunn", label: "Bakgrunnskart", candidates: ["n50-kartdata"] }
      ],
      nvdbTypes: [540],
      analysis: {
        arcgis: [
          "Tellepunkter: XY Table To Point på lat/lon (WGS84) fra CSV-en.",
          "Vegnett: Symbology → Graduated Symbols på ÅDT-feltet i trafikkmengde-laget.",
          "Valgfritt: vis endring siden et tidligere år med Calculate Field."
        ],
        qgis: ["Add Delimited Text Layer for tellepunktene (lat/lon, EPSG:4326).", "Graduated-symbolisering på linjebredde for trafikkmengde-laget."],
        vscode: ["punkter = gpd.GeoDataFrame(df, geometry=gpd.points_from_xy(df.lon, df.lat), crs=4326)", "punkter.explore(column=\"adt\") gir et interaktivt kart."],
        online: ["Last opp CSV med lat/lon. Map Viewer lager punktene automatisk.", "Styles → «Counts and Amounts (Size)» på ÅDT."]
      },
      tips: ["Linjebredde passer bedre enn farge for trafikkmengde.", "Oppgi år og om tallene er ÅDT eller ÅDT for tunge kjøretøy."]
    },
    {
      id: "trafikkulykker",
      name: "Trafikkulykker og trafikksikkerhet",
      description: "Finne ulykkesutsatte steder, lage varmekart over ulykker eller analysere skadegrad.",
      keywords: ["trafikkulykker", "ulykker", "ulykke", "trafikksikkerhet", "ulykkespunkt", "drepte", "hardt skadde", "skadde", "nullvisjonen", "hotspot", "ulykkesbelastet", "kryss"],
      mapType: "hotspot",
      roles: [
        { key: "ulykker", label: "Ulykkespunkter", candidates: ["nvdb"] },
        { key: "statistikk", label: "Ulykkesstatistikk (valgfritt)", candidates: ["ssb-ulykker"], optional: true },
        { key: "avgrensning", label: "Avgrensning", candidates: ["admin-enheter"] },
        { key: "bakgrunn", label: "Bakgrunnskart", candidates: ["n50-kartdata"] }
      ],
      nvdbTypes: [570],
      analysis: {
        arcgis: [
          "Filtrer på år og alvorlighetsgrad med Definition Query.",
          "Generate Tessellation (heksagoner, f.eks. 500 m) → Summarize Within for antall ulykker per celle.",
          "Optimized Hot Spot Analysis gir statistisk signifikante klynger."
        ],
        qgis: ["Processing → «Create grid» (heksagon) → «Count points in polygon».", "Eller Symbology → Heatmap for et raskt varmekart."],
        vscode: ["import h3 eller bruk gpd.sjoin mot et heksagonrutenett.", "ulykker.explore() for et raskt interaktivt kart."],
        online: ["Styles → «Heat map» for et raskt varmekart.", "Analysis → «Find hot spots» for signifikante klynger."]
      },
      tips: ["Varmekart viser tetthet, ikke risiko. Del på trafikkmengde for å vise risiko.", "Bruk minst 3–5 år med data, ellers blir mønsteret tilfeldig."]
    },
    {
      id: "tilgjengelighet-bil",
      name: "Tilgjengelighet og kjøretid",
      description: "Beregne kjøretid til sykehus, skole, brannstasjon eller andre tjenester, eller lage serviceområder (isokroner).",
      keywords: ["kjøretid", "reisetid", "tilgjengelighet", "serviceområde", "isokron", "nærmeste", "avstand til", "innen 10 minutter", "responstid", "utrykning", "nettverksanalyse", "dekning", "sykehus", "skole", "brannstasjon", "legevakt"],
      mapType: "tilgjengelighet",
      roles: [
        { key: "vegnett", label: "Rutbart vegnett", candidates: ["nvdb-ruteplan", "osm-geofabrik"] },
        { key: "mal", label: "Målpunkter (tjenesten du måler avstand til)", candidates: ["osm-geofabrik", "adresser"], targets: true },
        { key: "befolkning", label: "Befolkning (hvem som dekkes)", candidates: ["ssb-rutenett"] },
        { key: "avgrensning", label: "Avgrensning", candidates: ["admin-enheter"] }
      ],
      analysis: {
        arcgis: [
          "Network Analyst: Analysis → Network Analysis → Service Area med NVDB-nettverket som kilde.",
          "Legg målpunktene inn som «Facilities». Sett «Cutoffs» til f.eks. 5, 10, 15 minutter og «Travel Mode» til kjøretid.",
          "Solve. Summarize Within med befolkningsrutenettet gir antall innbyggere per tidssone."
        ],
        qgis: [
          "Processing → Network analysis → «Service area (from layer)» på vegnettet (avstand eller tid via fartsgrense).",
          "Alternativ: pluginen «ORS Tools» (OpenRouteService) gir isokroner raskt."
        ],
        vscode: [
          "pip install osmnx: G = ox.graph_from_place(\"<kommune>, Norway\", network_type=\"drive\")",
          "G = ox.add_edge_speeds(G); G = ox.add_edge_travel_times(G)",
          "nx.single_source_dijkstra_path_length(G, node, cutoff=600, weight=\"travel_time\") gir alle noder innen 10 min."
        ],
        online: ["Map Viewer → Analysis → «Use proximity» → «Create drive-time areas» (bruker kreditter).", "Velg 5/10/15 minutter og «Dissolve» eller «Overlap»."]
      },
      tips: ["Velg bevisst mellom kjøretid og avstand, og si hvilken fartsforutsetning du bruker.", "Vis 3–4 tidsbånd med en sekvensiell fargeskala."]
    },
    {
      id: "kollektiv",
      name: "Kollektivdekning og reisetid med kollektiv",
      description: "Analysere holdeplassdekning, avgangsfrekvens eller reisetid med kollektivtransport.",
      keywords: ["kollektiv", "kollektivdekning", "holdeplass", "holdeplasser", "buss", "bane", "tog", "avganger", "frekvens", "rutetilbud", "kollektivtilbud", "reisetid med kollektiv", "gtfs", "pendlere med buss"],
      mapType: "tilgjengelighet",
      roles: [
        { key: "rutedata", label: "Holdeplasser og rutetider", candidates: ["entur"] },
        { key: "reisetid", label: "Reisetid (API)", candidates: ["entur-reiseplan"], optional: true },
        { key: "befolkning", label: "Befolkning", candidates: ["ssb-rutenett"] },
        { key: "avgrensning", label: "Avgrensning", candidates: ["admin-enheter"] }
      ],
      analysis: {
        arcgis: [
          "Pakk ut GTFS-zipen. stops.txt → XY Table To Point (stop_lat/stop_lon).",
          "Pairwise Buffer 300–500 m rundt holdeplassene (gangavstand).",
          "Summarize Within: befolkning innenfor bufferne = andel med kollektivdekning.",
          "For reisetid: «GTFS To Network Dataset Transit Sources» + Network Analyst."
        ],
        qgis: ["stops.txt → Add Delimited Text Layer.", "Vector → Geoprocessing → Buffer 500 m. Sum befolkning med «Join attributes by location (summary)»."],
        vscode: ["stops = pd.read_csv(z.open(\"stops.txt\"))", "Avganger per holdeplass: stop_times.groupby(\"stop_id\").size()", "Reisetidsmatriser: pip install r5py (bruker GTFS + OSM)."],
        online: ["Last opp stops.txt som CSV. Analysis → «Create buffers», deretter «Summarize within»."]
      },
      tips: ["Dekning bør ta hensyn til frekvens: en holdeplass med én avgang i timen er ikke god dekning.", "Rutedata gjelder en bestemt periode. Skriv datoen i kartet."]
    },
    {
      id: "pendling",
      name: "Pendling og reisestrømmer",
      description: "Flytkart over pendling mellom kommuner, eller analyse av arbeidsreiser og bo- og arbeidsmarkedsregioner.",
      keywords: ["pendling", "pendlere", "arbeidsreiser", "flytkart", "reisestrømmer", "bosted", "arbeidssted", "od-matrise", "strømmer", "flyt"],
      mapType: "flyt",
      roles: [
        { key: "pendling", label: "Pendlingstall", candidates: ["ssb-pendling"] },
        { key: "grenser", label: "Kommunegrenser", candidates: ["admin-enheter"] },
        { key: "reisevaner", label: "Reisevaner (valgfritt)", candidates: ["rvu"], optional: true }
      ],
      analysis: {
        arcgis: [
          "Feature To Point på kommunene gir senterpunkter med x/y.",
          "Koble x/y for bosteds- og arbeidskommune inn i pendlingstabellen (to joins).",
          "XY To Line lager én linje per strøm. Filtrer bort små strømmer (f.eks. under 100 pendlere)."
        ],
        qgis: ["Pluginen «FlowMapper» lager flytlinjer direkte fra en OD-tabell.", "Alternativ: Processing → «Geometry by expression» med make_line()."],
        vscode: ["Lag linjer med shapely.LineString([fra_punkt, til_punkt]).", "Interaktivt: eksporter OD-tabellen til flowmap.blue eller kepler.gl."],
        online: ["Last opp en CSV med fra/til-koordinater og bruk Analysis → «Connect origins to destinations»."]
      },
      tips: ["Vis bare de største strømmene, ellers blir kartet uleselig.", "Buede linjer og linjebredde etter antall gjør retningen tydelig."]
    },
    {
      id: "delt-mobilitet",
      name: "Delt mobilitet, sykkel og mikromobilitet",
      description: "Kartlegge elsparkesykler, bysykler og sykkeltrafikk, eller analysere sykkelruter og sykkelvegnett.",
      keywords: ["elsparkesykkel", "elsparkesykler", "elsparkesyklene", "sparkesykkel", "sparkesyklene", "bysyklene", "bysykkel", "bysykler", "delt mobilitet", "mikromobilitet", "bildeling", "sykkel", "sykkelvei", "sykkelveg", "sykkeltrafikk", "sykkelruter", "syklister", "mobilitet"],
      mapType: "hotspot",
      roles: [
        { key: "delt", label: "Delte kjøretøy (sanntid)", candidates: ["entur-mobility"] },
        { key: "bysykkel", label: "Bysykkelturer", candidates: ["bysykkel"], optional: true },
        { key: "sykkelnett", label: "Sykkelruter og -veger", candidates: ["turrutebasen", "nvdb", "osm-geofabrik"], optional: true },
        { key: "avgrensning", label: "Avgrensning", candidates: ["admin-enheter"] }
      ],
      analysis: {
        arcgis: ["XY Table To Point på lat/lon.", "Generate Tessellation (heksagon 250 m) + Summarize Within for tetthet.", "Bysykkel: XY To Line fra start- til sluttstasjon gir turstrømmer."],
        qgis: ["Add Delimited Text Layer (lat/lon).", "Processing → «Create grid» + «Count points in polygon», eller Heatmap-symbolisering."],
        vscode: ["Kjør nedlastingen jevnlig (f.eks. hvert 15. min i en dag) for å se mønstre over døgnet.", "trips.groupby([\"start_station_name\", \"end_station_name\"]).size() gir de vanligste turene."],
        online: ["Last opp CSV. Styles → «Heat map» eller «Clustering»."]
      },
      tips: ["Sanntidsdata er et øyeblikksbilde. Skriv klokkeslett og dato i kartet.", "Normaliser mot befolkning eller areal når du sammenligner bydeler."]
    },
    {
      id: "terreng",
      name: "Terreng, helning og høyde",
      description: "Høydemodell, helningskart, terrengskygge, siktanalyse eller volumberegning.",
      keywords: ["terreng", "høyde", "høydedata", "helning", "bratthet", "slope", "terrengskygge", "hillshade", "siktanalyse", "sikt", "viewshed", "høydeprofil", "dtm", "dem", "volum", "skjæring", "fylling", "laser", "lidar"],
      mapType: "raster",
      roles: [
        { key: "hoyde", label: "Høydemodell (DTM)", candidates: ["hoydedata", "copernicus-dataspace"] },
        { key: "avgrensning", label: "Avgrensning", candidates: ["admin-enheter"] },
        { key: "bakgrunn", label: "Bakgrunnskart (valgfritt)", candidates: ["n50-kartdata"], optional: true }
      ],
      analysis: {
        arcgis: ["Mosaic To New Raster hvis du har flere fliser.", "Spatial Analyst: Slope (helning), Hillshade (Multidirectional), Viewshed (sikt), Cut Fill (volum)."],
        qgis: ["Raster → Miscellaneous → Build Virtual Raster for flisene.", "Raster → Analysis → Slope / Hillshade. Processing → «Viewshed» for sikt."],
        vscode: ["import rasterio, numpy as np", "Helning: np.gradient på høydematrisen, eller pip install xarray-spatial (slope, hillshade)."],
        online: ["Living Atlas har «Terrain» og «Elevation» som bildetjenester. Raster-analyse krever ArcGIS Image."]
      },
      tips: ["Legg terrengskygge under andre lag med 40–60 % gjennomsiktighet.", "Helning i grader: bruk klasser som 0–5, 5–15, 15–30 og over 30 grader."]
    },
    {
      id: "arealbruk",
      name: "Arealbruk, natur og verneområder",
      description: "Kart over arealbruk, skog, jordbruk, naturtyper, verneområder eller endring i arealdekke.",
      keywords: ["arealbruk", "arealdekke", "skog", "jordbruk", "dyrka mark", "myr", "natur", "naturtyper", "verneområde", "verneområder", "nasjonalpark", "friluftsliv", "inngrepsfri", "nedbygging", "arealendring", "grønnstruktur"],
      mapType: "kategori",
      roles: [
        { key: "areal", label: "Arealressurser", candidates: ["ar5", "corine", "esa-worldcover"] },
        { key: "natur", label: "Natur og vern", candidates: ["naturbase"], optional: true },
        { key: "avgrensning", label: "Avgrensning", candidates: ["admin-enheter"] }
      ],
      analysis: {
        arcgis: ["Pairwise Clip til området.", "Summary Statistics: SUM av Shape_Area per arealtype gir fordelingen.", "Endring: Pairwise Intersect mellom to årganger."],
        qgis: ["Clip til området.", "Field Calculator $area, deretter «Statistics by categories»."],
        vscode: ["areal = gpd.clip(areal, kommune)", "areal.assign(m2=areal.area).groupby(\"<arealtype>\")[\"m2\"].sum()"],
        online: ["Analysis → «Summarize within» per arealtype."]
      },
      tips: ["Bruk Geonorges standard tegneregler for AR5. Leserne kjenner fargene igjen.", "Areal beregnes i UTM (meter), ikke i grader."]
    },
    {
      id: "klima-vaer",
      name: "Vær og klima",
      description: "Temperatur, nedbør, snø eller vind fra målestasjoner eller rutenett, også klimaframskrivninger.",
      keywords: ["vær", "klima", "temperatur", "nedbør", "snø", "vind", "klimaendringer", "klimaframskrivning", "værstasjon", "ekstremvær", "tørke", "hetebølge"],
      mapType: "tidsserie",
      roles: [
        { key: "observasjoner", label: "Værobservasjoner", candidates: ["frost-met"] },
        { key: "grid", label: "Klimadata på rutenett", candidates: ["met-thredds", "era5"], optional: true },
        { key: "avgrensning", label: "Avgrensning", candidates: ["admin-enheter"] }
      ],
      analysis: {
        arcgis: ["Stasjoner: XY Table To Point. Rutenett: Multidimension → Add Multidimensional Raster Layer.", "Aggregate Multidimensional Raster for årsmiddel."],
        qgis: ["NetCDF: dra inn filen og bruk Temporal Controller.", "Stasjoner: Add Delimited Text Layer."],
        vscode: ["xarray: ds[\"tas\"].resample(time=\"YS\").mean()", "Plott tidsserie med matplotlib og kart med ds.isel(time=0).plot()."],
        online: ["Living Atlas har klimalag (temperatur, nedbør) som kan brukes direkte."]
      },
      tips: ["Vær tydelig på normalperiode (1991–2020) når du viser avvik.", "Kombiner gjerne kart og graf: kartet viser hvor, grafen viser når."]
    },
    {
      id: "stoy",
      name: "Støy",
      description: "Kartlegge støysoner langs veg og bane, og hvor mange bygninger eller innbyggere som ligger i rød eller gul sone.",
      keywords: ["støy", "støysone", "trafikkstøy", "vegstøy", "rød sone", "gul sone", "støyutsatt"],
      mapType: "overlay",
      roles: [
        { key: "stoy", label: "Støysoner", candidates: ["stoy-veg"] },
        { key: "objekter", label: "Bygninger", candidates: ["fkb", "osm-geofabrik"] },
        { key: "befolkning", label: "Befolkning", candidates: ["ssb-rutenett"], optional: true },
        { key: "avgrensning", label: "Avgrensning", candidates: ["admin-enheter"] }
      ],
      analysis: {
        arcgis: ["Select By Location: bygninger i rød og gul sone.", "Summarize Within: befolkning per støysone."],
        qgis: ["Select by Location + Export.", "«Join attributes by location (summary)» for befolkning per sone."],
        vscode: ["gpd.sjoin(bygg, stoy, predicate=\"intersects\").groupby(\"<sone>\").size()"],
        online: ["Analysis → «Summarize within» per støysone."]
      },
      tips: ["Bruk de etablerte fargene: rød sone rød, gul sone gul.", "Oppgi beregningsår. Støykart oppdateres sjelden."]
    },
    {
      id: "elbil-lading",
      name: "Elbil og ladeinfrastruktur",
      description: "Kartlegge ladestasjoner, elbilandel per kommune eller avstand til nærmeste lader.",
      keywords: ["elbil", "lading", "ladestasjon", "ladestasjoner", "hurtiglader", "ladeinfrastruktur", "elbilandel", "bilpark", "nullutslipp"],
      mapType: "punkt",
      roles: [
        { key: "lading", label: "Ladestasjoner", candidates: ["nobil", "osm-geofabrik"] },
        { key: "bilpark", label: "Elbilandel per kommune", candidates: ["ssb-bilparken"], optional: true },
        { key: "avgrensning", label: "Avgrensning", candidates: ["admin-enheter"] }
      ],
      targetsDefault: ["lader"],
      analysis: {
        arcgis: ["XY Table To Point for ladestasjonene.", "Near eller Generate Near Table for avstand fra boliger/vegnett til nærmeste lader."],
        qgis: ["Processing → «Distance to nearest hub» mellom adresser og ladestasjoner."],
        vscode: ["gpd.sjoin_nearest(adresser, lading, distance_col=\"avstand_m\")"],
        online: ["Analysis → «Find nearest»."]
      },
      tips: ["Skill mellom normallading og hurtiglading med ulike symboler.", "Proporsjonale symboler kan vise antall ladepunkter per stasjon."]
    },
    {
      id: "parkering",
      name: "Parkering og innfartsparkering",
      description: "Kart over parkeringsplasser, innfartsparkering ved kollektivknutepunkt eller HC-parkering.",
      keywords: ["parkering", "parkeringsplass", "innfartsparkering", "p-plass", "hc-parkering", "parkeringsdekning"],
      mapType: "punkt",
      roles: [
        { key: "parkering", label: "Parkeringsområder", candidates: ["parkeringsregisteret", "osm-geofabrik"] },
        { key: "kollektiv", label: "Holdeplasser (valgfritt)", candidates: ["entur"], optional: true },
        { key: "avgrensning", label: "Avgrensning", candidates: ["admin-enheter"] }
      ],
      targetsDefault: ["parkering"],
      analysis: {
        arcgis: ["XY Table To Point eller JSON To Features.", "Near mot holdeplasser for avstand til kollektiv."],
        qgis: ["Add Delimited Text Layer / dra inn GeoJSON.", "«Distance to nearest hub» mot holdeplassene."],
        vscode: ["gpd.sjoin_nearest(parkering, holdeplasser, distance_col=\"avstand_m\")"],
        online: ["Analysis → «Find nearest»."]
      },
      tips: ["Proporsjonale symboler etter antall plasser gir et raskt overblikk."]
    },
    {
      id: "universell-utforming",
      name: "Universell utforming og gangtilgjengelighet",
      description: "Tilgjengelighet for rullestol og svaksynte, gangnett, fortau og trinnfri adkomst.",
      keywords: ["universell utforming", "uu", "rullestol", "svaksynt", "gangvei", "gangveg", "fortau", "gående", "gange", "trinnfri", "tilgjengelig for alle"],
      mapType: "kategori",
      roles: [
        { key: "uu", label: "Tilgjengelighetsdata", candidates: ["tilgjengelighet-uu"] },
        { key: "gangnett", label: "Gang- og sykkelveg", candidates: ["nvdb", "turrutebasen", "osm-geofabrik"], optional: true },
        { key: "avgrensning", label: "Avgrensning", candidates: ["admin-enheter"] }
      ],
      analysis: {
        arcgis: ["Symboliser på tilgjengelighetsklasse (Unique Values).", "Summary Statistics: lengde per klasse."],
        qgis: ["Categorized-symbolisering på tilgjengelighetsklasse.", "Field Calculator $length og «Statistics by categories»."],
        vscode: ["uu.assign(m=uu.length).groupby(\"<klasse>\")[\"m\"].sum()"],
        online: ["Styles → «Types (unique symbols)» på tilgjengelighetsklassen."]
      },
      tips: ["Bruk Kartverkets tegneregler for tilgjengelighet slik at kartet er gjenkjennelig."]
    }
  ];

  // Generisk oppskrift når ingen andre passer
  var GENERIC_RECIPE = {
    id: "generell",
    name: "Generelt kartprosjekt",
    description: "Ingen bestemt oppgavetype ble gjenkjent. Planen bygger på de mest relevante datasettene fra søket.",
    keywords: [],
    mapType: "punkt",
    roles: [],
    analysis: {
      arcgis: ["Bruk Geoprocessing-panelet (Analysis → Tools) og søk etter verktøyet du trenger, f.eks. «Clip», «Buffer» eller «Summarize Within»."],
      qgis: ["Processing Toolbox (Ctrl+Alt+T): søk etter verktøyet du trenger."],
      vscode: ["geopandas: gpd.clip, gpd.sjoin, .buffer() og .dissolve() dekker de fleste analyser."],
      online: ["Map Viewer → Analysis viser alle tilgjengelige analyser."]
    },
    tips: []
  };

  // ------------------------------------------------------------ Karttyper
  var MAPTYPES = {
    overlay: {
      name: "Analysekart (overlay)",
      when: "Viser hvilke objekter som ligger innenfor et område, f.eks. bygninger i flomsone.",
      tips: [
        "Fareområdet som halvgjennomsiktig flate (40–60 %), berørte objekter i en sterk farge, resten nøytralt grått.",
        "Bruk et dempet bakgrunnskart (gråtone) slik at temaet står fram.",
        "Skriv antall berørte objekter direkte i kartet eller i en tekstboks."
      ],
      symbology: {
        arcgis: "Fareområde: Single Symbol, fyll med 50 % transparens. Berørte bygg: Single Symbol i rød/oransje. Andre bygg: lys grå. Bakgrunn: «Light Gray Canvas» fra Living Atlas.",
        qgis: "Fareområde: fyll med opacity 50 %. Berørte objekter: rød. Rule-based-symbolisering skiller berørt og ikke berørt i ett lag.",
        vscode: "ax = fare.plot(alpha=.4); berort.plot(ax=ax, color=\"crimson\"); bygg.plot(ax=ax, color=\"lightgrey\"). Eller fare.explore() for interaktivt kart.",
        online: "Styles → «Location (single symbol)» for hvert lag. Juster transparens i lagets egenskaper."
      },
      examples: [
        { title: "NVE Atlas – flom og skred", url: "https://atlas.nve.no" },
        { title: "Kartverket Norgeskart", url: "https://norgeskart.no" }
      ]
    },
    koroplet: {
      name: "Temakart per område (koroplet)",
      when: "Viser en verdi per kommune, fylke eller annet område med fargetone.",
      tips: [
        "Vis andeler, tettheter eller endring, aldri råtall.",
        "5 klasser med Natural Breaks eller kvantiler. Avrund klassegrensene.",
        "Sekvensiell fargeskala (lys → mørk) for verdier. Divergerende skala (blå–hvit–rød) for endring rundt null.",
        "Skriv enheten i tegnforklaringen («innbyggere per km²»)."
      ],
      symbology: {
        arcgis: "Symbology → Graduated Colors på den normaliserte kolonnen, Method: Natural Breaks, 5 klasser. Velg en fargeskala fra ColorBrewer (Blues, YlOrRd).",
        qgis: "Layer Properties → Symbology → Graduated, Mode: Natural Breaks (Jenks), 5 klasser, fargerampe f.eks. Blues.",
        vscode: "kart.plot(column=\"per_1000\", scheme=\"NaturalBreaks\", k=5, cmap=\"Blues\", legend=True)  # pip install mapclassify",
        online: "Styles → velg kolonnen → «Counts and Amounts (Color)». Juster klassene under «Classify data»."
      },
      examples: [
        { title: "SSB – statistikk i kart", url: "https://kart.ssb.no" },
        { title: "ColorBrewer – fargeskalaer for kart", url: "https://colorbrewer2.org" },
        { title: "Our World in Data – gode temakart", url: "https://ourworldindata.org" }
      ]
    },
    rutenett: {
      name: "Rutenettkart",
      when: "Viser tetthet i like store ruter, f.eks. befolkning per 250 m-rute.",
      tips: [
        "Like store ruter gjør tall sammenlignbare uten normalisering.",
        "Gjør ruter uten verdi gjennomsiktige.",
        "Bruk kvantiler eller manuelle klasser. Befolkningstall er svært skjevfordelt."
      ],
      symbology: {
        arcgis: "Graduated Colors på befolkningskolonnen, Method: Quantile eller manuelle klasser (1–10, 11–50, 51–200, over 200).",
        qgis: "Graduated, Mode: Quantile. Sett «Outline» til ingen strek.",
        vscode: "ruter.plot(column=\"<befolkning>\", scheme=\"Quantiles\", k=5, cmap=\"magma_r\", linewidth=0)",
        online: "Styles → «Counts and Amounts (Color)», fjern omriss."
      },
      examples: [
        { title: "SSB – kart med befolkning på rutenett", url: "https://kart.ssb.no" }
      ]
    },
    linjer: {
      name: "Linjekart med bredde etter verdi",
      when: "Viser mengde langs linjer, f.eks. trafikk på vegnettet.",
      tips: [
        "Linjebredde etter verdi er lettere å lese enn farge.",
        "Begrens til 4–5 bredder og vis dem i tegnforklaringen.",
        "Tegn de tykkeste linjene øverst."
      ],
      symbology: {
        arcgis: "Symbology → Graduated Symbols på ÅDT-feltet. Sett minste og største bredde (f.eks. 0,5–6 pt).",
        qgis: "Graduated → Method: Size, linjebredde 0,3–3 mm.",
        vscode: "veg.plot(linewidth=veg[\"adt\"] / veg[\"adt\"].max() * 6)",
        online: "Styles → «Counts and Amounts (Size)»."
      },
      examples: [
        { title: "Trafikkdata.no – kart over tellepunkter", url: "https://trafikkdata.atlas.vegvesen.no" },
        { title: "Vegkart – NVDB i kart", url: "https://vegkart.atlas.vegvesen.no" }
      ]
    },
    hotspot: {
      name: "Tetthetskart (heksagoner eller varmekart)",
      when: "Viser hvor mange hendelser det er i et område, f.eks. ulykker eller elsparkesykler.",
      tips: [
        "Heksagoner er bedre enn varmekart i rapporter, fordi de har tydelige verdier og klasser.",
        "Varmekart egner seg best som interaktivt kart og i presentasjoner.",
        "Si hva tettheten er målt per (per celle, per km²)."
      ],
      symbology: {
        arcgis: "Hexagons: Graduated Colors på antall per celle. Raskt varmekart: Symbology → Heat Map (bare visning).",
        qgis: "Symbology → Heatmap (radius 500 m), eller Graduated på heksagonlaget.",
        vscode: "punkter.explore(), eller kepler.gl / lonboard for store datamengder.",
        online: "Styles → «Heat map», eller Analysis → «Aggregate points» til heksagoner."
      },
      examples: [
        { title: "kepler.gl – eksempler på tetthetskart", url: "https://kepler.gl/demo" },
        { title: "ArcGIS Living Atlas", url: "https://livingatlas.arcgis.com" }
      ]
    },
    tilgjengelighet: {
      name: "Tilgjengelighetskart (isokroner)",
      when: "Viser hvor langt man kommer på en gitt tid, eller reisetid til nærmeste tjeneste.",
      tips: [
        "3–4 tidsbånd (5, 10, 15 min) med sekvensiell farge, mørkest nærmest.",
        "Vis målpunktene tydelig med eget symbol.",
        "Skriv antall innbyggere per tidsbånd i en liten tabell ved kartet."
      ],
      symbology: {
        arcgis: "Service Area-polygonene: Unique Values på «ToBreak», sekvensiell fargeskala, 30 % transparens.",
        qgis: "Categorized på tidsbåndet. Legg målpunktene øverst med stort symbol.",
        vscode: "soner.plot(column=\"minutter\", cmap=\"YlGnBu_r\", alpha=.6, legend=True)",
        online: "Styles → «Types (unique symbols)» på tidsbåndet."
      },
      examples: [
        { title: "Mapnificent – reisetid med kollektiv", url: "https://www.mapnificent.net" },
        { title: "ArcGIS StoryMaps – eksempler", url: "https://storymaps.arcgis.com" }
      ]
    },
    flyt: {
      name: "Flytkart",
      when: "Viser strømmer mellom steder, f.eks. pendling mellom kommuner.",
      tips: [
        "Vis bare de største strømmene (topp 20–50).",
        "Linjebredde etter antall. Buede linjer eller piler viser retning.",
        "Et lyst og rolig bakgrunnskart gjør linjene lesbare."
      ],
      symbology: {
        arcgis: "Graduated Symbols på antall pendlere. Sett symbolet til en pil (Line symbol → Arrow).",
        qgis: "FlowMapper-pluginen, eller Graduated Size med en pil-markør på linjeslutt.",
        vscode: "Eksporter en CSV med origin/destination/count til flowmap.blue, eller bruk kepler.gl Arc-lag.",
        online: "Styles → «Counts and Amounts (Size)». For animerte strømmer: kepler.gl."
      },
      examples: [
        { title: "Flowmap.blue – interaktive flytkart", url: "https://www.flowmap.blue" },
        { title: "kepler.gl – Arc-lag", url: "https://kepler.gl/demo" }
      ]
    },
    punkt: {
      name: "Punktkart med proporsjonale symboler",
      when: "Viser enkeltlokaliteter, f.eks. ladestasjoner, med størrelse etter verdi.",
      tips: [
        "Symbolstørrelse etter verdi (areal, ikke diameter).",
        "Klynger (clustering) gjør tette punktsamlinger lesbare på nett.",
        "Bruk maks to farger: én for kategori, størrelse for mengde."
      ],
      symbology: {
        arcgis: "Graduated Symbols eller Proportional Symbols på verdikolonnen.",
        qgis: "Graduated → Method: Size, eller «Point cluster»-renderer.",
        vscode: "punkter.explore(column=\"verdi\", marker_kwds={\"radius\": 6})",
        online: "Styles → «Counts and Amounts (Size)». Slå på «Clustering» for mange punkter."
      },
      examples: [
        { title: "ArcGIS Living Atlas", url: "https://livingatlas.arcgis.com" }
      ]
    },
    raster: {
      name: "Terrengkart (raster)",
      when: "Viser kontinuerlige flater som høyde, helning eller sikt.",
      tips: [
        "Terrengskygge (multidirectional) under en fargelagt høyde- eller helningsmodell gir dybde.",
        "Helningsklasser i farge fra grønn (slakt) til rød (bratt).",
        "Skriv oppløsningen (1 m, 10 m) i kildeteksten."
      ],
      symbology: {
        arcgis: "Hillshade-laget i grått under, helningslaget over med 40 % transparens og «Classify» i 4–5 klasser.",
        qgis: "Hillshade-renderer (Multidirectional) + «Singleband pseudocolor» for helning med Blending mode «Multiply».",
        vscode: "from rasterio.plot import show; show(hillshade, cmap=\"gray\"); show(slope, cmap=\"RdYlGn_r\", alpha=.5)",
        online: "Bruk Living Atlas-lagene «Terrain» og «Hillshade» med «Multiply»-blending."
      },
      examples: [
        { title: "Høydedata.no", url: "https://hoydedata.no" },
        { title: "Kartverket Norgeskart", url: "https://norgeskart.no" }
      ]
    },
    kategori: {
      name: "Kategorikart",
      when: "Viser typer, f.eks. arealbruk eller verneform.",
      tips: [
        "Bruk standardfarger (Geonorges tegneregler) når de finnes.",
        "Maks 7–8 kategorier. Slå sammen små kategorier til «Annet».",
        "Bruk naturlige farger: grønt for skog, gult for jordbruk, blått for vann."
      ],
      symbology: {
        arcgis: "Unique Values på typekolonnen. Hent tegneregler fra Geonorges kartografiregister (lyrx).",
        qgis: "Categorized på typekolonnen. Geonorge har ferdige tegneregler (qml/sld).",
        vscode: "areal.plot(column=\"<type>\", categorical=True, legend=True, cmap=\"tab10\")",
        online: "Styles → «Types (unique symbols)»."
      },
      examples: [
        { title: "Kilden (NIBIO) – arealressurskart", url: "https://kilden.nibio.no" },
        { title: "Geonorge kartografiregister – tegneregler", url: "https://register.geonorge.no/kartografi" }
      ]
    },
    tidsserie: {
      name: "Kart og graf (tidsserie)",
      when: "Viser endring over tid, f.eks. temperatur eller trafikk per måned.",
      tips: [
        "Kombiner et kart (hvor) med en graf (når).",
        "Små multipler (samme kart for flere år side om side) er bedre enn animasjon i rapporter.",
        "Hold fargeskalaen lik på alle kartene."
      ],
      symbology: {
        arcgis: "Slå på Time på laget og bruk tidslinjen. Lag grafer med Create Chart → Line Chart.",
        qgis: "Temporal Controller for animasjon. DataPlotly-pluginen for grafer.",
        vscode: "matplotlib: fig, axes = plt.subplots(1, 4) for små multipler. Plotly for interaktive grafer.",
        online: "Slå på «Time» i lagets egenskaper. Dashboards kombinerer kart og graf."
      },
      examples: [
        { title: "Our World in Data – kart med tidslinje", url: "https://ourworldindata.org" },
        { title: "Seklima (MET) – klimadata og grafer", url: "https://seklima.met.no" }
      ]
    }
  };

  // ------------------------------------------------------------ Leveranser
  var DELIVERABLES = {
    rapport: { label: "Rapport, PDF eller plakat", keywords: ["rapport", "pdf", "plakat", "a3", "a4", "trykk", "utskrift", "vedlegg", "notat", "oppgave", "masteroppgave", "bacheloroppgave", "figur"] },
    nett: { label: "Nettkart / dele med andre", keywords: ["nettkart", "på nett", "interaktiv", "interaktivt", "dele", "deles", "deling", "delt med", "kolleger", "publisere", "nettside", "web", "lenke", "storymap", "storymaps", "innbyggere skal se"] },
    dashboard: { label: "Dashboard / oppfølging", keywords: ["dashboard", "oppfølging", "følge med", "overvåke", "ukentlig", "månedlig", "sanntid", "status", "kpi", "power bi"] },
    presentasjon: { label: "Presentasjon", keywords: ["presentasjon", "powerpoint", "lysbilde", "møte", "formannskap", "kommunestyre", "politikere", "foredrag"] },
    analyse: { label: "Bare analyse og tall", keywords: ["beregne", "tall", "tabell", "hvor mange", "antall", "statistikk ut", "regne ut", "excel-ark"] }
  };

  // ------------------------------------------------------------ Plattformer
  var PLATFORMS = {
    arcgis: { label: "ArcGIS Pro", url: "https://pro.arcgis.com", strength: "Best til ferdige kart for trykk (layout), tunge analyser og Network Analyst." },
    online: { label: "ArcGIS Online", url: "https://www.arcgis.com", strength: "Best til å dele interaktive kart, dashboards og StoryMaps i organisasjonen." },
    qgis: { label: "QGIS", url: "https://qgis.org", strength: "Gratis og fullverdig. Gode kart for trykk og mange åpne formater." },
    vscode: { label: "VS Code / Python", url: "https://code.visualstudio.com", strength: "Best til store datamengder, tidsserier, automatisering og analyser du skal gjenta." },
    kepler: { label: "kepler.gl", url: "https://kepler.gl/demo", strength: "Gratis i nettleseren. Rask visualisering av mange punkter, flytkart og animasjon over tid. Dataene forlater ikke maskinen." },
    powerbi: { label: "Power BI", url: "https://app.powerbi.com", strength: "Best når kartet skal inn i et dashboard med tall og grafer, særlig per kommune." }
  };

  // ------------------------------------------------------------ Målpunkter (OSM)
  var TARGETS = {
    sykehus: { label: "Sykehus", words: ["sykehus", "akuttmottak"], osm: "nwr[\"amenity\"=\"hospital\"]" },
    legevakt: { label: "Legevakt og legekontor", words: ["legevakt", "legekontor", "fastlege", "lege"], osm: "nwr[\"amenity\"~\"clinic|doctors\"]" },
    skole: { label: "Skoler", words: ["skole", "skoler", "grunnskole", "barneskole", "ungdomsskole", "videregående"], osm: "nwr[\"amenity\"=\"school\"]" },
    barnehage: { label: "Barnehager", words: ["barnehage", "barnehager"], osm: "nwr[\"amenity\"=\"kindergarten\"]" },
    brann: { label: "Brannstasjoner", words: ["brannstasjon", "brannstasjoner", "brannvesen", "utrykning"], osm: "nwr[\"amenity\"=\"fire_station\"]" },
    butikk: { label: "Dagligvarebutikker", words: ["butikk", "butikker", "dagligvare", "matbutikk"], osm: "nwr[\"shop\"=\"supermarket\"]" },
    holdeplass: { label: "Holdeplasser", words: ["holdeplass", "holdeplasser", "bussholdeplass", "stoppested"], osm: "node[\"highway\"=\"bus_stop\"]" },
    lader: { label: "Ladestasjoner", words: ["ladestasjon", "ladestasjoner", "lader", "hurtiglader"], osm: "nwr[\"amenity\"=\"charging_station\"]" },
    parkering: { label: "Parkering", words: ["parkering", "parkeringsplass", "p-plass"], osm: "nwr[\"amenity\"=\"parking\"]" },
    idrett: { label: "Idrettsanlegg", words: ["idrettsanlegg", "idrettshall", "svømmehall"], osm: "nwr[\"leisure\"~\"sports_centre|sports_hall\"]" },
    bibliotek: { label: "Bibliotek", words: ["bibliotek"], osm: "nwr[\"amenity\"=\"library\"]" },
    sykehjem: { label: "Sykehjem", words: ["sykehjem", "omsorgsbolig"], osm: "nwr[\"amenity\"=\"nursing_home\"]" }
  };

  // ------------------------------------------------------------ Naturfare (NVE m.fl.)
  // queries: søkeord i Geonorges kartkatalog. must: ord som må stå i tittelen.
  var HAZARDS = {
    flom: { label: "Flom", words: ["flom", "flomsone", "flomfare", "oversvømmelse", "elveflom"], queries: ["Flomsoner", "Flom aktsomhetsområder"], must: "flom" },
    skred: { label: "Skred", words: ["skred", "skredfare", "ras", "snøskred", "steinsprang", "jordskred", "fjellskred"], queries: ["Skredfaresoner", "Aktsomhetsområder snøskred", "Aktsomhetsområder steinsprang"], must: "skred" },
    kvikkleire: { label: "Kvikkleire", words: ["kvikkleire", "kvikkleireskred", "leirskred"], queries: ["Kvikkleire faresoner", "Kvikkleire"], must: "kvikkleire" },
    stormflo: { label: "Stormflo og havnivå", words: ["stormflo", "havnivå", "havnivåstigning", "springflo"], queries: ["Havnivåstigning og stormflo", "Stormflo"], must: "stormflo" }
  };

  // ------------------------------------------------------------ Steder
  // Fylker og større kommuner som gjenkjennes i teksten. Kommunenummer slås opp
  // av nedlastingsskriptet (Kartverkets kommuneinfo-API), slik at de alltid er oppdaterte.
  var PLACES = {
    fylker: ["Østfold", "Akershus", "Buskerud", "Vestfold", "Telemark", "Agder", "Rogaland", "Vestland", "Møre og Romsdal", "Trøndelag", "Nordland", "Troms", "Finnmark", "Innlandet"],
    kommuner: ["Oslo", "Bergen", "Trondheim", "Stavanger", "Bærum", "Kristiansand", "Drammen", "Asker", "Lillestrøm", "Fredrikstad", "Sandnes", "Tromsø", "Sarpsborg", "Skien", "Ålesund", "Bodø", "Larvik", "Tønsberg", "Sandefjord", "Arendal", "Karmøy", "Porsgrunn", "Haugesund", "Moss", "Ringsaker", "Ullensaker", "Hamar", "Lørenskog", "Nordre Follo", "Kongsberg", "Lillehammer", "Molde", "Harstad", "Gjøvik", "Ringerike", "Halden", "Horten", "Steinkjer", "Alta", "Narvik", "Kristiansund", "Elverum", "Askøy", "Øygarden", "Bjørnafjorden", "Alver", "Stord", "Sola", "Time", "Eigersund", "Grimstad", "Kongsvinger", "Lier", "Holmestrand", "Indre Østfold", "Ås", "Frogn", "Nesodden", "Eidsvoll", "Nittedal", "Rana", "Vefsn", "Levanger", "Stjørdal", "Malvik", "Melhus", "Orkland", "Namsos", "Vestby", "Hammerfest", "Vadsø", "Sør-Varanger", "Senja", "Voss", "Sogndal", "Sunnfjord", "Kinn", "Volda", "Ørsta", "Hustadvika", "Lindesnes", "Farsund", "Flekkefjord", "Notodden", "Bamble", "Kragerø", "Hole", "Modum", "Øvre Eiker", "Nedre Eiker", "Gran", "Lunner", "Østre Toten", "Vestre Toten", "Stange", "Løten", "Trysil", "Tynset", "Røros", "Oppdal", "Hitra", "Frøya", "Vågan", "Vestvågøy", "Sortland", "Hadsel", "Fauske"],
    // Navn som også er vanlige ord, og som derfor krever stor forbokstav i teksten
    capitalOnly: ["Time", "Hole", "Gran", "Moss", "Alver", "Sola", "Rana", "Kinn", "Senja", "Lier", "Frogn", "Ås"]
  };

  var api = { RECIPES: RECIPES, GENERIC_RECIPE: GENERIC_RECIPE, MAPTYPES: MAPTYPES, DELIVERABLES: DELIVERABLES, PLATFORMS: PLATFORMS, TARGETS: TARGETS, HAZARDS: HAZARDS, PLACES: PLACES };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Knowledge = api;
})(this);
