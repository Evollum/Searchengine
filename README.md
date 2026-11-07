# Datafinner – søkemotor for åpne datasett

**Åpne siden:** https://evollum.github.io/Searchengine/

Datafinner har to deler:

### 1. Planlegg oppgave (oppgaveplanlegger)

Beskriv oppgaven med egne ord, for eksempel *«Lag et kart over hvilke bygninger i
Bergen som ligger i flomsone, til en ROS-analyse i ArcGIS Pro»*. Da får du:

1. **Data du trenger.** Datasettene velges per rolle (fareområde, bygninger, avgrensning,
   bakgrunnskart …), med alternativer.
2. **Et skreddersydd nedlastingsprogram** (Python, kun standardbiblioteket). Det henter
   dataene for kommunen din i riktig format for verktøyet ditt og skriver en LES_MEG.txt
   med kilder og lisenser. Det kjøres med Python fra ArcGIS Pro, QGIS eller VS Code.
3. **Fremgangsmåte** steg for steg i ditt verktøy, med tidsestimat: hent data → last inn
   og avgrens → analyse → symboliser → ferdigstill.
4. **Karttype og gode eksempler**: hvilken karttype som passer, kartografiske råd,
   symbolisering i verktøyet og lenker til gode eksempelkart og ferdige tegneregler.
5. **Sidenotat: hvor bør kartet lages?** ArcGIS Pro, ArcGIS Online, QGIS,
   VS Code/Python, kepler.gl eller Power BI, vurdert ut fra leveranse, karttype og data.
   Du kan krysse av for hvilke verktøy du har tilgang til.
6. **Sjekkliste** før levering (tittel, tegnforklaring, målestokk, kildetekst …).

Planen kan kopieres eller lastes ned som Markdown, og lenken kan deles
(`?oppgave=...#planlegg`).

Planleggeren kjenner igjen disse oppgavetypene (`data/recipes.js`): naturfare (flom,
skred, kvikkleire, stormflo), statistikk per kommune, befolkningstetthet,
trafikkmengde, trafikkulykker, kjøretid og tilgjengelighet, kollektivdekning, pendling,
delt mobilitet og sykkel, terreng, arealbruk og natur, vær og klima, støy, elbil og
lading, parkering og universell utforming.

#### Nedlastingsprogrammet

| Kilde | Hva skriptet gjør |
|---|---|
| Kartverket kommuneinfo | Finner kommunenummer og lagrer kommunegrensen (WGS84 og UTM33) |
| Geonorge nedlasting | Finner datasettet, velger kommune → fylke → hele landet, UTM33 og ditt format, bestiller og laster ned |
| SSB PxWebApi v2 | Henter siste år av tabellen som CSV (avgrenser til kommunen hvis tabellen er for stor) |
| NVDB API Les v4 | Vegobjekter (ulykker, trafikkmengde, fartsgrenser) som GeoJSON og CSV |
| Trafikkdata (GraphQL) | Tellepunkter i kommunen med siste ÅDT |
| Geonorge WCS | Høydemodell (DTM) i fliser |
| Entur | Rutedata (GTFS) og delte kjøretøy i sanntid |
| OpenStreetMap (Overpass) | Målpunkter (sykehus, skoler …), veger og reserve for bygninger hvis FKB krever innlogging |

Feiler én kilde, fortsetter skriptet med de andre og skriver hva som feilet.

### 2. Søk i datasett

Søk på hva du leter etter og hvorfor, og velg verktøy. Da får du:

## Kom i gang

Ingen installasjon eller byggesteg – det er en statisk nettside.

```bash
# Alternativ 1: åpne index.html direkte i nettleseren
# Alternativ 2: lokal server (anbefalt for live-søk)
python3 -m http.server 8000   # → http://localhost:8000
```

Publiseres med **GitHub Pages** (Settings → Pages → Deploy from a branch → `main` / `(root)`).
Hver gang `main` oppdateres, publiseres siden på nytt automatisk.

## Slik fungerer søket

| Del | Hva den gjør |
|---|---|
| Fritekst | Søk på norsk eller engelsk. Synonymer utvides automatisk (f.eks. *flom → flood, flomsone, vannføring*), og norske sammensetninger forstås (*flomsoner*, *veier*, *nedbørsdata*). |
| «Hvorfor»-feltet | Teksten brukes til å oppdage **verktøy** («i ArcGIS Pro», «med Python»), **formål** («masteroppgave», «maskinlæring», «lage kart») og **område** («i Bergen» → Norge). |
| Verktøy | Datasett med formater som verktøyet leser direkte rangeres høyere. |
| Kvalitet | Score ut fra offisiell kilde, tydelig lisens, dokumentasjon og vedlikehold. |

Søk kan deles via URL, f.eks. `index.html?q=flomsoner&tool=arcgis`.

## Katalogen

Rundt 75 håndplukkede kilder – norske (Kartverket/Geonorge, SSB, NVE, NGU,
Miljødirektoratet, MET, NIBIO, Statens vegvesen, Entur, Artsdatabanken m.fl.),
europeiske (Copernicus, Eurostat, EMODnet) og globale (OpenStreetMap, Overture,
Natural Earth, NASA, USGS, World Bank, Our World in Data, Hugging Face, Kaggle …).

### Trafikk

Trafikk er et eget fagområde med datasett for:

| Behov | Datasett |
|---|---|
| Trafikkmengde / ÅDT / rushtid | Trafikkdata.no (Statens vegvesen, GraphQL-API), NVDB, UK Road Traffic Statistics |
| Nettverksanalyse (kjøretid, serviceområder, nærmeste anlegg) | NVDB Ruteplan nettverksdatasett (klar for ArcGIS Network Analyst) |
| Sanntid: hendelser, vegarbeid, reisetider | DATEX II (Statens vegvesen) |
| Trafikkulykker og trafikksikkerhet | SSB vegtrafikkulykker, NVDB, NHTSA FARS |
| Kollektiv, sykkel og mikromobilitet | Entur (GTFS/NeTEx), Bysykkel (Oslo/Bergen/Trondheim), Mobility Database |
| Bil og elbil | SSB bilparken, NOBIL ladestasjoner |
| Fly og skip | Avinor flydata, OpenSky Network, AIS (Kystverket/BarentsWatch) |
| Støy | Støykart for vegtrafikk |
| Maskinlæring / trafikkprognoser | Caltrans PeMS, NYC Taxi |

Flere av disse har egne kodeeksempler (f.eks. GraphQL-spørring mot Trafikkdata,
bysykkelturer med pandas, rutegraf med networkx) og egne ArcGIS-steg for Network Analyst.

### Mobilitet (Norge)

| Behov | Datasett |
|---|---|
| Delt mobilitet (elsparkesykler, bysykler, bildeling) | Entur Mobility API (GBFS/GraphQL, alle operatører), Bysykkel |
| Reisetid med kollektiv / tilgjengelighet | Entur reiseplanlegger (Journey Planner), Entur GTFS, NVDB Ruteplan |
| Pendling og flytkart | SSB pendling mellom kommuner (tabell 03321) |
| Reisevaner og transportmiddelfordeling | Den nasjonale reisevaneundersøkelsen (RVU) |
| Kollektivbruk | SSB kollektivtransport |
| Gange, sykkel og universell utforming | Turrutebasen, Tilgjengelighet (UU), NVDB gang- og sykkelveg |
| Parkering, ferje og elbil | Parkeringsregisteret, Ferjedatabanken, NOBIL |
| By/bygd | SSB tettsteder |

Uten valgt område får norske datasett et lite forsprang i rangeringen
(`PREFERRED_REGION` i `js/search.js`).

### Legge til et datasett

Legg til et objekt i `data/datasets.js` (se feltbeskrivelsen øverst i filen),
og kjør testene:

```bash
npm test     # søk, planlegger og nedlastingsskript
```

Testene sjekker at alle felter er på plass, at søket og planleggeren gir forventede
treff, og at de genererte nedlastingsskriptene er gyldig Python. Hvert skript kjøres
også ende til ende uten nett, med API-svar i samme format som de ekte API-ene
(`tests/script_offline_test.py`).

## Struktur

```
index.html          brukergrensesnitt
css/style.css       stil (lys/mørk modus)
data/datasets.js    den kuraterte katalogen
data/recipes.js     oppgavetyper, karttyper, plattformer og stedsnavn for planleggeren
js/search.js        søk, synonymer, verktøy-/formålsgjenkjenning, kvalitetsscore
js/howto.js         veiledninger per verktøy og format (inkl. Python-kode)
js/live.js          live-søk i eksterne datakataloger
js/planner.js       tolker oppgaveteksten og lager planen
js/scriptgen.js     lager nedlastingsskriptet (Python)
js/plan-ui.js       visning av planen og fanene
js/app.js           kobler alt sammen i nettleseren
tests/              tester for søkelogikken (Node, ingen avhengigheter)
```

## Merk

- Live-søket kaller kildenes offentlige API-er direkte fra nettleseren. Hvis en
  kilde ikke svarer eller blokkerer forespørselen, vises en lenke for å søke
  direkte hos kilden i stedet.
- Sjekk alltid lisens og vilkår hos dataeieren før du bruker eller deler data.
