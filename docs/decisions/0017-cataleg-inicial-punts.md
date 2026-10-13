# ADR-0017: Catàleg inicial de punts d'observació en un GeoJSON versionat

**Estat:** Acceptada · **Data:** 2026-10-12 · Resol la decisió pendent P13 · TG-87

## Context

HU06 demana com a mínim 30 punts d'observació de Catalunya al mapa. Cal decidir quins punts i amb quines metadades, i com s'introdueixen a la base de dades. Criteris de P13: accés en cotxe, foscor del cel i horitzó obert. La taula `punts_observacio` la crea TG-86 ([ADR-0013](0013-acces-bd-kysely.md)).

## Decisió

- **Font de veritat: `data/punts_observacio.geojson`** (RFC 7946, WGS84, `[lon, lat]`). Es pot editar visualment (geojson.io, QGIS) i GitHub el mostra com a mapa a les PR. És el mateix format que serveix `GET /punts` ([ADR-0012](0012-punts-mapa-geojson.md)).
- **32 punts** repartits per tot el territori: les zones Starlight (Montsec, Muntanyes de Prades i Montsant, Aigüestortes), la plana de la Noguera, colls del Pirineu i el Prepirineu, Montseny, els Ports, el delta de l'Ebre, l'Empordà i observatoris d'aficionats de la Catalunya central.
- **Excepcions als criteris de P13**, acceptades pel cel fosc al zenit: Santa Fe de Montseny i el pantà de Cavallers tenen l'horitzó tapat per les muntanyes (`horitzo_obert` és `null` i la descripció ho diu), i a Sant Joan de l'Erm s'hi arriba per pista forestal (ho diu `accessibilitat`).
- **Coordenades del geocodificador de l'ICGC**, no escrites a mà. Cada punt guarda d'on surten (`font_coordenades`, que no va a la base de dades).
- **Metadades:** `slug` (únic i estable), `nom`, `municipi`, `descripcio`, `altitud`, `horitzo_obert` i `accessibilitat`. Tots són `OFICIAL` (sense creador) i `PUBLICAT`.
- **`horitzo_obert` és aproximat:** una llista de direccions (`N`, `NE`… `NW`) només on la geografia és clara (costa, cims, cingles). Si no, `null`. El perfil d'horitzó real el calcula TG-116 amb el model d'elevacions de 5 m de l'ICGC.
- **No hi ha foscor ni índex al catàleg.** La foscor la calcula TG-97 a partir del GeoTIFF i l'índex el worker.
- **Seed generat, no escrit a mà.** `data/scripts/build-seed-punts.ts` valida el GeoJSON (≥ 30 punts, slugs únics, coordenades dins de Catalunya, direccions vàlides) i genera `supabase/seeds/01_punts_observacio.sql` amb `on conflict (slug) do update`, que només toca punts `OFICIAL`. Amb `--check` també comprova que el seed versionat està al dia. És idempotent: `supabase db reset` i `db push --include-seed` no dupliquen punts. La càrrega de `./seeds/*.sql` a `config.toml` s'activa amb TG-86, que crea la taula; fins llavors el seed no s'executa.

## Alternatives descartades

- **`INSERT` escrits a mà a `seed.sql`:** difícils de revisar i d'editar amb 30+ punts, i fàcil intercanviar latitud i longitud.
- **CSV + `COPY`:** compacte, però sense previsualització al mapa i amb la geometria en columnes soltes.
- **`ogr2ogr` (GDAL):** afegeix una dependència a tot l'equip i no encaixa bé amb els enums i el `slug`.
- **Seed en TypeScript amb Kysely:** necessitaria `DATABASE_URL` i no s'executaria sol amb `supabase db reset`.

## Conseqüències

- Afegir o corregir un punt = editar el GeoJSON i tornar a generar el seed a la mateixa PR.
- L'altitud s'omple amb `data/scripts/fill-altitudes.ts` (Copernicus DEM 90 m, via Open-Meteo), prou precisa per a la fitxa del punt.
- Els punts proposats per la comunitat (HU28) no passen per aquí: van a la mateixa taula amb `origen = 'COMUNITAT'`.
- Tasques afectades: TG-86 (les columnes han de coincidir), TG-88 i TG-92 (llegeixen aquests camps), TG-97 i TG-116 (calculen per a aquests punts).
