# Datafinner – søkemotor for åpne datasett

Finn åpne datasett med god kvalitet og få direkte lenke til nedlasting.
Skriv **hva** du leter etter og **hvorfor / hva du skal bruke det til**, velg
**verktøy** (ArcGIS Pro, QGIS, VS Code / Python eller Excel / Power BI), så får du:

- en rangert liste med kvalitetsvurderte datasett (★ 1–5)
- lenke til nedlastingsside og eventuelt API
- hvilke formater som passer i verktøyet ditt (uthevet)
- steg-for-steg-veiledning for å åpne datasettet i ArcGIS Pro / QGIS / Excel,
  og ferdig Python-kode for VS Code
- «Min liste» der du lagrer datasett med formålet ditt og eksporterer
  som prosjektnotat (Markdown) eller CSV
- live-søk videre i Geonorge, data.europa.eu, Zenodo og Hugging Face

## Kom i gang

Ingen installasjon eller byggesteg – det er en statisk nettside.

```bash
# Alternativ 1: åpne index.html direkte i nettleseren
# Alternativ 2: lokal server (anbefalt for live-søk)
python3 -m http.server 8000   # → http://localhost:8000
```

Kan publiseres gratis med **GitHub Pages** (Settings → Pages → Deploy from branch → `main` / root).

## Slik fungerer søket

| Del | Hva den gjør |
|---|---|
| Fritekst | Søk på norsk eller engelsk. Synonymer utvides automatisk (f.eks. *flom → flood, flomsone, vannføring*), og norske sammensetninger forstås (*flomsoner*, *veier*, *nedbørsdata*). |
| «Hvorfor»-feltet | Teksten brukes til å oppdage **verktøy** («i ArcGIS Pro», «med Python»), **formål** («masteroppgave», «maskinlæring», «lage kart») og **område** («i Bergen» → Norge). |
| Verktøy | Datasett med formater som verktøyet leser direkte rangeres høyere. |
| Kvalitet | Score ut fra offisiell kilde, tydelig lisens, dokumentasjon og vedlikehold. |

Søk kan deles via URL, f.eks. `index.html?q=flomsoner&tool=arcgis`.

## Katalogen

Rundt 50 håndplukkede kilder – norske (Kartverket/Geonorge, SSB, NVE, NGU,
Miljødirektoratet, MET, NIBIO, Statens vegvesen, Entur, Artsdatabanken m.fl.),
europeiske (Copernicus, Eurostat, EMODnet) og globale (OpenStreetMap, Overture,
Natural Earth, NASA, USGS, World Bank, Our World in Data, Hugging Face, Kaggle …).

### Legge til et datasett

Legg til et objekt i `data/datasets.js` (se feltbeskrivelsen øverst i filen),
og kjør testene:

```bash
npm test     # eller: node tests/search.test.js
```

Testene sjekker at alle felter er på plass, at formatene er kjente og at
søket gir forventede treff.

## Struktur

```
index.html          brukergrensesnitt
css/style.css       stil (lys/mørk modus)
data/datasets.js    den kuraterte katalogen
js/search.js        søk, synonymer, verktøy-/formålsgjenkjenning, kvalitetsscore
js/howto.js         veiledninger per verktøy og format (inkl. Python-kode)
js/live.js          live-søk i eksterne datakataloger
js/app.js           kobler alt sammen i nettleseren
tests/              tester for søkelogikken (Node, ingen avhengigheter)
```

## Merk

- Live-søket kaller kildenes offentlige API-er direkte fra nettleseren. Hvis en
  kilde ikke svarer eller blokkerer forespørselen, vises en lenke for å søke
  direkte hos kilden i stedet.
- Sjekk alltid lisens og vilkår hos dataeieren før du bruker eller deler data.
