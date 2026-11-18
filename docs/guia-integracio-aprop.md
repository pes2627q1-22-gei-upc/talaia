# Guia d'integració del calendari astronòmic per a Aprop

**Versió del servei públic comprovada:** `stable` (`4e67bd2`), 17/11/2026. Aquesta guia
descriu el llistat que Aprop pot consumir ara. Abans d'enviar-la, cal confirmar que la
[documentació OpenAPI pública](#documentació-interactiva) continua descrivint aquest contracte.

## Accés

Talaia ofereix el calendari mitjançant una API HTTPS. L'equip de Talaia facilitarà a Aprop
la URL base pública i la clau d'API per un canal privat. La URL base acaba en `/api/v1`;
als exemples següents s'anomena `API_BASE`. La clau s'ha de desar al backend d'Aprop i enviar
en cada consulta a la capçalera `X-API-Key`. No s'ha d'incloure a l'app mòbil, al codi font,
als logs ni als enllaços.

```http
GET {API_BASE}/esdeveniments?des_de=2026-11-01&fins_a=2026-11-30
X-API-Key: <clau facilitada per Talaia>
```

La consulta es fa des del backend d'Aprop. No cal configurar CORS per a aquest ús.

## Consulta del llistat

| Paràmetre | Obligatori | Significat |
|---|---|---|
| `des_de` | Sí | Primer dia civil de Catalunya inclòs, en format `YYYY-MM-DD`. |
| `fins_a` | Sí | Últim dia civil de Catalunya inclòs, en format `YYYY-MM-DD`. |
| `tipus` | No | Filtra una categoria. Si s'omet, es retornen totes. |

L'interval pot contenir **366 dies civils com a màxim** i no té paginació. Les dates de
consulta s'interpreten a `Europe/Madrid`; els instants retornats, en canvi, són ISO 8601
en **UTC**. Un esdeveniment entra al resultat si el seu interval se solapa amb el període
consultat. La llista s'ordena per `inici` ascendent i pot ser buida.

Els valors admesos per `tipus` són `fase_llunar`, `pluja_estels`, `eclipsi_solar`,
`eclipsi_llunar`, `conjuncio` i `superlluna`. Els textos del llistat amb la clau d'Aprop
són en català.

La resposta té la forma `{ "data": [...] }`. Cada element conté:

| Camp | Significat |
|---|---|
| `id` | Identificador públic de l'esdeveniment. |
| `tipus` | Categoria de la llista anterior. |
| `nom`, `descripcio` | Textos en català. |
| `inici`, `fi` | Instants UTC en format ISO 8601. |
| `maxim` | Instant de màxima activitat en UTC, o `null` si la font no el publica. |
| `ubicacio` | Punt general de referència amb `nom`, `latitud` i `longitud`; no és una predicció del millor lloc d'observació. |
| `font` | Organització o mètode de càlcul d'origen. |

La resposta **no** conté un camp `estat`: Aprop pot derivar si l'esdeveniment és futur,
actiu o passat a partir de `inici` i `fi`. Per a l'esquema exacte i els possibles valors,
consulteu l'OpenAPI publicada.

## Prova des del backend

Amb la URL base i la clau configurades com a variables d'entorn del vostre backend,
una consulta de prova seria:

```bash
curl --fail --silent --show-error \
  --get "$API_BASE/esdeveniments" \
  --header "X-API-Key: $APROP_API_KEY" \
  --data-urlencode 'des_de=2026-11-01' \
  --data-urlencode 'fins_a=2026-11-30'
```

No enganxeu la clau literal a la comanda ni compartiu la seva sortida amb capçaleres
d'autenticació. Per a una càrrega completa, ometeu `tipus` i consulteu l'interval de dates
que necessiteu dins del límit de 366 dies. D'acord amb el patró que ens heu comunicat,
la càrrega en arrencar i l'actualització diària són compatibles amb el servei.

## Errors i límit de peticions

| HTTP | Què indica | Acció orientativa |
|---|---|---|
| `400` | Dates, interval o tipus invàlids. | Reviseu els paràmetres; no repetiu la mateixa petició sense canvis. |
| `401` | Falta la clau o no és vàlida. | Reviseu la configuració de la capçalera `X-API-Key`. |
| `429` | S'ha superat el límit general de Nginx. | Espereu i torneu-ho a provar amb menys freqüència. |
| `500` | Error intern. | Torneu-ho a provar més tard i aviseu Talaia si persisteix. |
| `503` | Servei o dades temporalment no disponibles. | Torneu-ho a provar més tard i aviseu Talaia si persisteix. |

Els errors generats per l'API tenen el format `{ "error": { "code": "...", "message": "..." } }`.
El `429` el pot generar Nginx **abans** que la petició arribi a l'API, de manera que no
cal pressuposar aquest format en aquesta resposta. El límit actual és de **20 peticions
per segon i per IP**, amb una ràfega de 40 peticions, compartit amb la resta de l'API;
no és una quota per clau. No cal fer peticions repetides per comprovar aquest límit.

## Documentació interactiva

Amb la URL base facilitada per Talaia, la documentació publicada es pot obrir sense clau:

- Swagger UI: `{API_BASE}/docs/`
- Especificació OpenAPI en JSON: `{API_BASE}/openapi.json`

El 17/11/2026 ambdues rutes van respondre HTTP 200 des d'un client sense VPN. La
consulta al llistat sense clau va respondre 401 i amb la clau d'Aprop va respondre 200
amb dades del calendari. La clau només és necessària per consultar els esdeveniments.

**Abast d'aquesta guia:** la versió pública comprovada descriu el llistat. A `snapshot`
hi ha una ruta de detall per identificador i una anotació del `429` a l'OpenAPI que encara
no formen part de la versió publicada. Talaia revisarà i actualitzarà aquesta guia quan
es desplegui la release corresponent.
