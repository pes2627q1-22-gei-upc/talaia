# data

Scripts de descàrrega i preprocés de dades obertes (contaminació lumínica, elevacions,
seeds de punts i fenòmens). Els fitxers grans no es versionen.

- [`astronomia/`](astronomia/README.md): format normalitzat dels calendaris oficials d'IMO i
  NASA (TG-106).
- [Foscor del cel](#foscor-del-cel-tg-97-p10): el mapa de contaminació lumínica de la Generalitat,
  rasteritzat a GeoTIFF, i l'`sqm` de cada punt (TG-97).
- [Perfil d'horitzó](#perfil-dhoritzó-tg-116): el relleu que tapa el cel de cada punt, amb el model
  d'elevacions de 5 m de l'ICGC (TG-116).

`data` és un workspace (`@talaia/data`): `npm install` a l'arrel n'instal·la l'única dependència
(`geotiff`), i `npm test -w data` executa els seus tests (`node --test`, sense Jest).

## Punts d'observació (TG-87, P13)

La font de veritat del catàleg inicial és **`punts_observacio.geojson`** (GeoJSON RFC 7946, WGS84, coordenades `[lon, lat]`). Es pot obrir i editar a [geojson.io](https://geojson.io) o QGIS, i GitHub el mostra com a mapa a les PR.

Cada `Feature` és un `Point` amb aquestes propietats:

| Propietat | Tipus | Notes |
|---|---|---|
| `slug` | text | Únic i estable (`kebab-case`). El seed fa *upsert* per `slug`. |
| `nom`, `municipi`, `descripcio` | text | En català. |
| `altitud` | enter o `null` | Metres. S'omple amb `fill-altitudes.ts`. |
| `sqm` | nombre (2 decimals) o `null` | Brillantor del cel al zenit en mag/arcsec² segons el mapa de la Generalitat; com més alt, més fosc. `null` = fora del mapa. S'omple amb `fill-sqm.ts`. |
| `horitzo_obert` | `["N","NE",…]` o `null` | Direccions amb l'horitzó obert, **aproximades** i escrites a mà. El perfil calculat és `horitzo`. |
| `accessibilitat` | text | Com s'hi arriba en cotxe. |
| `font_coordenades` | text | Traçabilitat; no va a la base de dades. |
| `horitzo` | 360 nombres (1 decimal) o `null` | Alçada aparent de l'horitzó en graus per a cada grau d'azimut (posició 0 = N, 90 = E), segons el model d'elevacions de l'ICGC. S'omple amb `fill-horitzo.ts`. |

Les coordenades venen del [geocodificador de l'ICGC](https://eines.icgc.cat/geocodificador) (consulta del 12/10/2026). Tots els punts són `origen = 'OFICIAL'` (sense creador) i `estat = 'PUBLICAT'`. L'índex **no** és aquí: el calcula el worker.

### Flux

```bash
node data/scripts/fill-altitudes.ts           # omple les altituds que falten (Open-Meteo, Copernicus DEM 90 m)
node data/scripts/build-mapa-foscor.ts        # descarrega el mapa de contaminació lumínica → data/raw/mapa-sqm-2024.tif
node data/scripts/fill-sqm.ts                 # omple l'sqm de tots els punts a partir del GeoTIFF
node data/scripts/fill-horitzo.ts             # perfil d'horitzó de tots els punts (WCS de l'ICGC, ~1 min per punt el primer cop)
node data/scripts/build-seed-punts.ts --check # valida el GeoJSON i comprova que el seed versionat està al dia
node data/scripts/build-seed-punts.ts         # genera supabase/seeds/01_punts_observacio.sql
npx supabase db reset                         # aplica migracions + seeds a la base local
```

Node 22 executa els `.ts` directament. Els tipus es comproven amb `npx tsc -p data` i el seed amb `--check`, tots dos a la CI. El fitxer SQL generat es versiona (és el que executa el CLI de Supabase), però no s'edita a mà: es canvia el GeoJSON i es torna a generar.

## Foscor del cel (TG-97, P10)

Decisió i context: [ADR-0020](../docs/decisions/0020-foscor-sqm-geotiff.md).

La font és el **Mapa de brillantor del cel nocturn de Catalunya 2024** (Generalitat / IEEC): la brillantor del fons del cel al zenit en mag/arcsec² (SQM) en una malla d'1 km. 17,5 és cel de ciutat; 21,6 o més, cel fosc natural. Es pot veure al [visor Hipermapa](https://sig.gencat.cat/visors/hipermapa.html?background=icgc_mapa_estandard&bg_transp=1&BBOX=-51568,4430393,831927,4819055&layers=ATMOSFERA_MAPA_SQM_2024&styles=0&transparency=1). La Generalitat no en publica cap ràster: serveix la malla com a capa vectorial WFS (`ATMOSFERA:ATMOSFERA_MAPA_SQM_2024`, 32.096 cel·les, EPSG:25831, atribut `MAG`).

| Fitxer | Què fa |
|---|---|
| `scripts/mapa-foscor.ts` | Mòdul: projecció ETRS89 → UTM 31N, descàrrega pel WFS, rasterització, GeoTIFF (escriptura i lectura amb geotiff.js) i consulta `sqmA(malla, lat, lon)` / `sqmProper` (cel·la més propera si el punt cau en un forat) |
| `scripts/build-mapa-foscor.ts` | Descarrega la capa i escriu `data/raw/mapa-sqm-2024.tif` (Float32, EPSG:25831, nodata −9999; ~270 KB, no versionat) |
| `scripts/fill-sqm.ts` | Omple l'`sqm` de tots els punts del GeoJSON a partir del GeoTIFF (2 decimals; cel·la més propera fins a 2 km si cal, i ho diu) |
| `scripts/mapa-foscor.test.ts` | Tests amb cel·les reals de la font: `npm test -w data` |

El GeoTIFF es pot comprovar amb GDAL si es té instal·lat (`gdalinfo -stats data/raw/mapa-sqm-2024.tif`; `gdallocationinfo -wgs84 … 0.7112 42.0294` dona el mateix que `sqmA`). Quan la Generalitat actualitzi el mapa: `build-mapa-foscor.ts` → `fill-sqm.ts` → `build-seed-punts.ts`, i els canvis d'`sqm` queden al diff del GeoJSON.

## Perfil d'horitzó (TG-116)

Decisió i context: [ADR-0022](../docs/decisions/0022-perfil-horitzo-icgc.md).

La font és el **Model d'elevacions del terreny de Catalunya 5 × 5 m** de l'ICGC (CC BY 4.0), pel seu
WCS (`icc:met`, només ArcGrid, EPSG:25831). Per a cada punt se'n baixen tres finestres: 5 m fins a
1,5 km, 30 m fins a 12 km i 200 m fins a 50 km. Per a cada grau d'azimut, l'alçada de l'horitzó és
l'angle més alt fins al terreny entre 50 m i 50 km, des d'uns ulls a 2 m, amb la corbatura de la
Terra i la refracció terrestre (k = 0,13): és l'alçada **aparent**.

| Fitxer | Què fa |
|---|---|
| `scripts/horitzo.ts` | Mòdul: finestres, descàrrega i lectura de l'ArcGrid, cota interpolada (`elevacioA`), convergència de meridians i `perfilHoritzo` |
| `scripts/fill-horitzo.ts` | Calcula `horitzo` per a tots els punts (o els slugs que se li passin) i desa les finestres a `data/raw/met/` (GeoTIFF, no versionat) |
| `scripts/horitzo.test.ts` | Tests amb malles sintètiques (un pla, una paret, el mar): `npm test -w data` |

**El model només cobreix Catalunya.** Fora (el mar, l'Aragó, França, Andorra) compta el nivell del
mar: sobre el mar és exacte i sobre terra és un mínim. El script diu quins azimuts de cada punt
surten de Catalunya per terra, i també on `horitzo_obert` diu obert però el relleu tapa més de 3°.
