# ADR-0020: Foscor del cel per punt: la malla WFS de la Generalitat es rasteritza a GeoTIFF amb geotiff.js i omple `punts_observacio.sqm`

**Estat:** Acceptada · **Data:** 2026-10-16 · Resol la decisió pendent P10 · TG-97

## Context

El factor foscor de l'índex v1 ([ADR-0018](0018-formula-index-v1.md)) es calcula a partir de l'SQM del punt (brillantor del fons del cel al zenit, en mag/arcsec²; com més alt, més fosc) i, mentre no n'hi ha, val 0,6 i l'índex es marca `foscorEstimada`. La font acordada ([producte.md](../producte.md)) és el mapa de contaminació lumínica de la Generalitat: el **Mapa de brillantor del cel nocturn de Catalunya 2024**, elaborat per l'IEEC amb modelització (inventari d'enllumenat, satèl·lit i la xarxa de sensors), a 1 km de resolució.

En mirar-ho de prop, la Generalitat **no publica cap fitxer ràster**: el mapa es consulta al visor Hipermapa i el seu servidor OGC (`sig.gencat.cat/ows/ATMOSFERA`) el serveix com a **capa vectorial** `ATMOSFERA_MAPA_SQM_2024` (WMS i WFS): 32.096 polígons d'1 km × 1 km en ETRS89 / UTM 31N (EPSG:25831) amb l'atribut `MAG` (de 13,99 a 21,72). No hi ha WCS per a aquesta capa. P10 demanava triar entre geotiff.js i GDAL per al preprocés.

## Decisió

Un preprocés **únic i reproduïble** a `data/scripts/`, en Node i sense dependències de sistema:

1. **`build-mapa-foscor.ts`** descarrega la capa pel WFS (GeoJSON en EPSG:25831, paginat), comprova que cada polígon és una cel·la d'1 km amb un SQM plausible, la **rasteritza** en una malla regular (265 × 259 cel·les, origen a la cantonada nord-oest arrodonida al metre) i la desa com a **GeoTIFF** d'una banda Float32 amb **geotiff.js** (`data/raw/mapa-sqm-2024.tif`, ~270 KB, no versionat; `GDAL_NODATA = -9999`). GDAL el llegeix i hi troba els mateixos valors que el `GetFeatureInfo` del WMS.
2. **`fill-sqm.ts`** llegeix el GeoTIFF i escriu l'`sqm` (2 decimals) de cada punt a `data/punts_observacio.geojson`, la font de veritat del catàleg ([ADR-0017](0017-cataleg-inicial-punts.md)). Si el punt cau en un **forat** de la malla (la font només té cel·les sobre terra: el far del Cap de Creus o un coll fronterer en queden fora) s'agafa la cel·la més propera fins a 2 km i s'avisa; si no n'hi ha, `null`.
3. **`build-seed-punts.ts`** porta l'`sqm` al seed, i la migració afegeix la columna **`punts_observacio.sqm numeric(4,2)`** (`null` = fora del mapa). El worker la passa a `calculaIndexHores` tal qual: la fórmula no canvia.

La projecció WGS84/ETRS89 → UTM 31N es fa amb les sèries de Krüger al mateix mòdul (`mapa-foscor.ts`), contrastada amb PROJ a 1 cm: no cal `proj4`. La lògica (projecció, rasterització, consulta, lectura i escriptura del GeoTIFF, descàrrega) té tests amb `node --test` a la CI, i `data/` passa a ser un workspace (`@talaia/data`) perquè `npm ci` instal·li `geotiff`.

### Per què així

- **geotiff.js i no GDAL:** tot l'equip i la CI ja tenen Node; GDAL és una instal·lació de sistema diferent a cada màquina. El GeoTIFF continua sent el format intermedi: qualsevol SIG l'obre i, si cal, el worker o l'API el poden consultar en calent per a coordenades arbitràries (`sqmProper`).
- **Preprocés i columna, no consulta en temps d'execució:** el mapa és estàtic (una campanya l'any) i els punts són pocs; el worker horari no depèn de la disponibilitat de `sig.gencat.cat` ni d'un fitxer dins del contenidor, i l'índex és reproduïble.
- **El GeoTIFF no es versiona, els valors sí:** `data/raw/` és al `.gitignore` (regla de [ADR-0017](0017-cataleg-inicial-punts.md) per als fitxers grans) i es regenera en 3 segons; l'`sqm` de cada punt queda al GeoJSON i al seed, revisable a la PR.

## Alternatives descartades

- **GDAL en un script a part** (`ogr2ogr` + `gdal_rasterize` + `gdallocationinfo`): menys codi, però una dependència de sistema per a cada membre i per a la CI.
- **`GetFeatureInfo` del WMS per a cada punt**, a l'hora de crear-lo: una petició per punt a un servidor extern, sense dades en bloc ni reproduïbilitat.
- **Carregar els 32.096 polígons a PostGIS** i fer `ST_Intersects`: ho resoldria també per als punts de la comunitat, però és molta taula per a un valor per punt; si els punts de la comunitat ho demanen, es pot afegir després a partir del mateix GeoTIFF.
- **Guardar el factor foscor (0–1) en lloc de l'SQM:** l'SQM és la mesura física i la que mostra la fitxa del punt; la conversió a factor és de la fórmula (ADR-0018) i pot canviar.

## Conseqüències

- Els 32 punts oficials tenen `sqm` (de 18,04 a Prades a 21,71 al pantà de Cavallers); l'índex d'aquests punts deixa de ser `foscorEstimada` quan TG-99 llegeixi la columna.
- Els punts de la **comunitat** (`origen = 'COMUNITAT'`) neixen amb `sqm = null` fins que l'API els calculi l'SQM en crear-los (el mòdul ja ho pot fer a partir del GeoTIFF); mentrestant tenen la foscor estimada, marcada com a tal.
- Quan la Generalitat actualitzi el mapa (el projecte continua fins al 2026), es torna a executar `build-mapa-foscor.ts` i `fill-sqm.ts` i es regenera el seed; el canvi de valors queda a la PR.
- El tipus `PuntObservacio` de `@talaia/shared` encara no porta `sqm`: s'afegirà quan la fitxa del punt (HU02) el mostri.
- Tasques afectades: TG-99 (passa `sqm` a la fórmula), TG-92 i TG-104/105 (mostren la foscor i el desglossament), TG-116 (el mateix flux de preprocés per al perfil d'horitzó).
