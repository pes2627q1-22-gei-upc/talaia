# ADR-0026: Contracte del calendari astronòmic per a Aprop i Talaia

**Estat:** Acceptada · **Data:** 2026-10-20 · TG-109 (P14)

## Context

Aprop consumirà el calendari astronòmic de Talaia (HU43), i la mateixa ruta ha de servir la
pantalla de calendari de l'app (HU09). Aprop va acceptar per correu la consulta per dates i
tipus, amb una ubicació general al mapa, textos en català i API key. Castellà i anglès es van
plantejar només com a millora opcional. Després es va acordar en persona que `estat` era
redundant amb les dates. TG-106 i TG-107 ja guarden els esdeveniments a PostgreSQL, amb hores
UTC i dies de fases lunars definits en hora civil de Catalunya.

## Decisió

- `GET /api/v1/esdeveniments` rep `des_de` i `fins_a` obligatoris (`YYYY-MM-DD`) i `tipus`
  opcional. P14 fixa les sis categories públiques: `fase_llunar`, `pluja_estels`,
  `eclipsi_solar`, `eclipsi_llunar`, `conjuncio` i `superlluna`. La «lluna de sang» és un
  eclipsi lunar, no un tipus nou. Afegir un tipus públic exigeix coordinar i versionar el
  contracte amb Aprop; la taula interna de tipus pot créixer sense exposar automàticament
  categories noves.
- Les dates de consulta representen **dies civils de `Europe/Madrid`**. El rang és
  `[des_de 00:00, fins_a + 1 dia 00:00)` en hora local, convertit a UTC per consultar la BD.
  S'inclou un esdeveniment si `inici < final` i `fi > començament`. El rang ha d'estar en
  ordre i no pot superar **366 dies civils inclosos**. La resposta s'ordena per `inici`, no
  porta paginació i expressa les hores com a instants ISO 8601 en UTC.
- Cada entrada retorna `id`, `tipus`, `nom`, `inici`, `fi`, `maxim` (pot ser `null`),
  `descripcio`, `ubicacio` i `font`. No retorna `estat`. Els textos són en català;
  `?idioma=es|en` queda fora del primer contracte perquè Aprop pot traduir-los.
- `ubicacio` és obligatòria i conté `nom`, `latitud` i `longitud`. Al MVP, TG-108 llegirà el
  punt oficial publicat amb slug `centre-observacio-univers` del catàleg de punts per a tots
  els esdeveniments. És una **referència general** acceptada per Aprop, no un càlcul del millor
  lloc segons núvols o geometria específica. Si falta el punt, el servei falla
  explícitament; no inventa coordenades ni retorna `null`. Una recomanació individual per
  fenomen requereix una decisió posterior.
- `font` prové de l'organització de la font importada (`IMO` o `NASA`) o, si és un
  esdeveniment calculat, del valor de `metode_calcul` (p. ex. `Astronomy Engine 2.1.19`).
- Aprop entra amb `X-API-Key`, que només viu al seu backend. L'app entra a la **mateixa
  ruta** amb `Authorization: Bearer` i un JWT de Supabase verificat segons [ADR-0023](0023-validacio-jwt-jwks.md).
  Les dues alternatives s'expressen com a OR a OpenAPI. Una credencial absent o invàlida
  dona 401; una indisponibilitat temporal de la BD o del JWKS dona 503. No hi ha 403 per
  una clau simplement invàlida ni 429 sense un límit de peticions acordat.

## Conseqüències

- TG-108 implementa el router, la consulta Kysely, el mapatge dels textos i fonts, la
  ubicació del catàleg i l'autenticació doble. La clau real es configura com a secret a l'API
  i es lliura a Aprop per un canal privat; no entra al repositori ni a l'app.
- El contracte OpenAPI es registra abans del router funcional. Fins a TG-108, la ruta
  documentada respon 404; la descripció ho indica. Quan es faci el router, el registre i
  la validació han de compartir els mateixos esquemes (ADR-0011).
- L'interval de les pluges importades de l'IMO (TG-106) es guarda amb límits de dia UTC.
  Alguna pot aparèixer al dia civil adjacent en filtrar per Catalunya; cal revisar aquesta
  dada d'origen a TG-106 sense reinterpretar les dates del contracte.
- La integració de Mobilicat continua pendent i és independent d'aquest servei.
