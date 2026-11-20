# @talaia/worker

Procés de Talaia que ingesta les dades externes i recalcula l'índex de visibilitat de tots els punts **cada hora** ([ADR-0004](../../docs/decisions/0004-index-precalculat.md)). Node 22 + TypeScript (strict), mateixes eines que l'API.

Estat: hi ha la **ingesta de la previsió d'Open-Meteo** (TG-95 i TG-114), el **càlcul astronòmic** amb Astronomy Engine (TG-96), la **fórmula de l'índex v1** amb la seva persistència (TG-98) i la **ingesta de les observacions de la XEMA** de Meteocat (TG-115, `npm run xema`), amb l'**índex v2** (TG-184, ADR-0037: la Lluna amagada pel relleu i la humitat corregida amb el biaix de cada estació). El **procés horari** (TG-99) recalcula l'índex de tots els punts en arrencar i cada hora amb node-cron, dins del contenidor, i després **avalua les alertes** (TG-153): i **n'envia les notificacions push** amb l'Expo Push Service (TG-154).

El client d'Open-Meteo, el càlcul astronòmic i la fórmula de l'índex són a **`@talaia/index`** (`packages/index`), perquè l'API també els fa servir per calcular l'índex d'una ubicació qualsevol al moment ([ADR-0031](../../docs/decisions/0031-visibilitat-ubicacio-al-moment.md)). El worker hi posa la planificació, la persistència i les CLI de prova.

## Ordres

```bash
nvm use && npm install        # des de l'arrel: instal·la tots els workspaces
```

| Ordre (`-w services/worker`) | Què fa |
|---|---|
| `npm run start` | Procés horari (`src/main.ts`): recalcula l'índex en arrencar i cada hora. Cal `DATABASE_URL` |
| `npm run meteo -- <lat,lon> [<lat,lon> …]` | Demana la previsió d'un o més llocs a Open-Meteo i la mostra per pantalla |
| `npm run astro -- <lat,lon[,altitud]> [YYYY-MM-DD]` | Mostra la nit d'un lloc (Sol, crepuscles, Lluna) i les efemèrides hora a hora, sense xarxa |
| `npm run xema -- <codi estació> [YYYY-MM-DD]` | Lectures d'un dia d'una estació de la XEMA (cal `METEOCAT_API_KEY`; gasta 7 consultes), sense base de dades |
| `npm run build` | Compila a `dist/` (sense els tests) |
| `npm run typecheck` | TypeScript strict (`tsconfig.base.json` de l'arrel) |
| `npm test` | Jest |
| `npm run lint` | ESLint amb la configuració de l'arrel |

Exemple (Montsec i Barcelona):

```bash
npm run meteo -w services/worker -- 42.0294,0.7112 41.3851,2.1734
npm run astro -w services/worker -- 42.0294,0.7112,1570 2026-10-14
```

## Variables d'entorn

Es llegeixen del `.env` de l'**arrel** del repo (`--env-file-if-exists`; vegeu `.env.example`) i es validen a `src/config/env.ts`.

| Variable | Per defecte | Què és |
|---|---|---|
| `OPEN_METEO_BASE_URL` | `https://api.open-meteo.com/v1` | URL base de l'API d'Open-Meteo (sense clau; 10.000 crides/dia) |
| `DATABASE_URL` | — | Postgres (`postgresql://…`). Obligatòria per a `npm run start`; les CLI de prova no la fan servir |
| `METEOCAT_API_KEY` | — | Clau de l'API de Meteocat (pla gratuït amb «Dades de la XEMA»). Opcional: sense ella no s'ingesten les observacions. Secreta |

## Ingesta de la previsió d'Open-Meteo (TG-95 i TG-114)

```
src/
  config/env.ts            Variables d'entorn validades amb zod
  meteo/
    ingesta.ts             Cas d'ús: previsió de tots els punts → repositori, amb un resum
    repository.ts          Port `PrevisioMeteoRepository` + implementació en memòria
    cli.ts                 `npm run meteo`: prova manual sense base de dades
```

El client (`createOpenMeteoClient`) és a `@talaia/index`: les variables i les unitats, les hores en UTC, els 4 dies de previsió, els lots de llocs i els errors (`OpenMeteoError`) s'expliquen al [README del paquet](../../packages/index/README.md#previsió-dopen-meteo-tg-95-i-tg-114).

- **Quota** (sense clau, 10.000 crides/dia): cada lloc compta com una crida, i amb 13 variables, 1,3. Amb 30 punts i una execució per hora: 30 × 24 × 1,3 ≈ 940 crides al dia; el límit s'assoleix cap als 320 punts. L'API en gasta una part per a les ubicacions que es consulten al moment (`GET /visibilitat`), amb un sostre per hora (ADR-0031).
- **Errors.** Si falla un lot, `previsio` rebutja sencer: la ingesta no desa res i es conserva la previsió anterior. El recàlcul horari ho torna a provar una vegada si l'error és transitori (TG-99).
- **Persistència.** `ingestaPrevisioMeteo` escriu a un `PrevisioMeteoRepository`. La implementació amb Kysely (`@talaia/db`, [ADR-0013](../../docs/decisions/0013-acces-bd-kysely.md)) i la migració de la taula de previsions són el següent pas, ara que hi ha `punts_observacio` (TG-86); fins aleshores hi ha la de memòria, que fan servir els tests i la CLI.

## Observacions de la XEMA de Meteocat (TG-115)

```
src/meteocat/
  xema.ts                Client de l'API de dades mesurades (x-api-key, zod, timeout)
  ingesta.ts             Estacions operatives i la més propera a cada punt; lectures d'un dia
  repository.ts          Taules `estacions_xema` i `lectures_xema` amb Kysely, i en memòria
  planificacio.ts        Les dues tasques dins del procés horari (`main.ts`), amb node-cron en UTC
  cli.ts                 `npm run xema`: prova manual amb la clau, sense base de dades
```

El que es va mesurar de debò, per contrastar-ho amb la previsió d'Open-Meteo. Cada dia, `meteocat/ajust.ts` calcula el biaix de la humitat de cada estació (TG-184): la mediana de la XEMA menys Open-Meteo a les hores de nit dels últims 14 dies, amb un mínim de 48 parelles. El recàlcul l'aplica només als punts propers (menys de 25 km i 350 m d'altitud) durant 7 dies com a màxim. Per què així: [ADR-0025](../../docs/decisions/0025-observacions-xema.md) i [ADR-0037](../../docs/decisions/0037-index-v2-lluna-humitat.md).

- **Estacions** (`actualitzaEstacionsXema`, un cop al mes): desa les estacions operatives (`/estacions/metadades?estat=ope`), marca com a no operatives les que ja no ho són (sense esborrar-les ni perdre'n les lectures) i assigna a cada punt l'estació operativa més propera (`punts_observacio.estacio_xema`, KNN de PostGIS, només per distància).
- **Lectures** (`ingestaLecturesXema`, un cop al dia, en UTC i no abans de les 03:00 UTC): les d'**ahir** (UTC) de les estacions assignades als punts. Una petició per variable per a totes les estacions (`/variables/mesurades/{codi}/{any}/{mes}/{dia}`): temperatura, humitat, precipitació, vent i irradiància solar. La XEMA no mesura els núvols; la irradiància en fa de testimoni de dia.
- **Format:** una fila per estació i lectura semihorària (`LecturaXema` de `@talaia/shared`), amb les unitats d'Open-Meteo (el vent, de m/s a km/h). La XEMA etiqueta per davant: la de les 11:00Z cobreix de 11:00 a 11:30. `validada` diu si Meteocat ja ha validat tots els valors de la fila (estat «V»); a les d'ahir sol ser `false`.
- **Qualitat:** les lectures invàlides (estat «N») no es desen, i els valors fora del rang físic (`RANGS`, els mateixos que els `check`, i un test ho vigila) es descarten un a un (`descartades` al resum). En tornar a baixar un dia, un valor que ara és invàlid es posa a `null`.
- **Errors:** si falla una variable, es desen les altres i l'error queda al resum. Si fallen totes, llança un error. Amb la clau rebutjada (401, 403) o la quota exhaurida (429), desa el que ja ha baixat i llança de seguida. Si el procés s'atura abans de demanar res, torna el resum amb els motius en lloc d'un error. Una lectura amb una data que no s'entén es descarta sola. Tornar a baixar un dia no esborra els valors que la nova ingesta no porta. Les lectures es guarden 90 dies.
- **Planificació** (`planificaXema`, des de `main.ts`): amb `METEOCAT_API_KEY`, les lectures cada dia a les **06:15 UTC** (`15 6 * * *`) i les estacions el **dia 1 de cada mes a les 06:00 UTC** (`0 6 1 * *`) i també en arrencar si `estacions_xema` és buida. Les lectures no baixen només ahir: baixen **els dies que falten** entre l'última lectura desada i ahir, com a molt 4 (`diesPendentsXema`), i també ho fan en arrencar. Així, un dia que no s'ha pogut ingerir (Meteocat caigut, un deploy a les 06:15, el dia 1 amb les estacions encara en curs) es recupera a la següent execució. Fan servir el mateix pool que el recàlcul i comparteixen un executor: no van mai a la vegada (la que arriba amb l'altra en curs se salta), un error o els `errors` del resum es mostren al log sense aturar el procés, i l'aturada espera la tasca en curs. Sense la clau, un avís al log en arrencar i no es planifica res.
- **Quota:** unes 190 consultes al mes (6 al dia i les metadades), sigui quin sigui el nombre de punts.

```bash
npm run xema -w services/worker -- CC 2026-10-18    # cal METEOCAT_API_KEY al .env de l'arrel
```

## Càlcul astronòmic amb Astronomy Engine (TG-96)

```
src/
  astronomia/
    cli.ts                 `npm run astro`: prova manual sense xarxa
    calendari.ts           Efemèrides del calendari de fenòmens (TG-107)
    calendari-cli.ts       `npm run astronomia:calendari`: genera i comprova el seed del calendari
```

Les funcions (`efemeridesHora`, `efemeridesHores`, `nitAstronomica`…) són a `@talaia/index`, amb Astronomy Engine dins del servidor, sense API externa ni quota ([ADR-0004](../../docs/decisions/0004-index-precalculat.md)). Què dona cadascuna, les alçades geomètriques, la fase de la Lluna, la nit i els errors: [README del paquet](../../packages/index/README.md#càlcul-astronòmic-amb-astronomy-engine-tg-96).

## Índex de visibilitat v1 (TG-98)

```
src/
  index/
    repository.ts          Persistència a `index_visibilitat`: Kysely i en memòria
    cli.ts                 `npm run index`: prova manual amb la previsió real
```

`índex = 100 × N × S × (0,6 · F + 0,4 · L)`, cada factor de 0 a 1: **N** núvols, **S** Sol, **F** foscor (de l'SQM del punt, la columna `sqm` de `punts_observacio` que omple TG-97; 0,6 si el punt no en té) i **L** Lluna ([ADR-0018](../../docs/decisions/0018-formula-index-v1.md)). La fórmula (`calculaIndex`, `calculaIndexHores`, `FORMULA_V1`) és codi pur a `@talaia/index`: [README del paquet](../../packages/index/README.md#índex-de-visibilitat-v1-tg-98).

| Funció | Què fa |
|---|---|
| `createKyselyIndexRepository(db)` | `desaIndexs(puntId, hores)` (recalcular una hora la substitueix) i `indexsDe(puntId)` |

Prova manual, sense base de dades:

```bash
npm run index -w services/worker -- 42.0294,0.7112          # el Montsec, foscor estimada
npm run index -w services/worker -- 42.0294,0.7112 21.56    # amb l'SQM del lloc (data/punts_observacio.geojson)
```

## Recàlcul horari (TG-99)

```
src/
  main.ts                  Cablejat del procés llarg: pool, node-cron a «5 * * * *» (UTC), alertes, XEMA i senyals
  recalcul/
    executor.ts            Sense solapaments, errors que no aturen el procés i aturada que espera
    recalcul.ts            Una execució, per lots: punts → Open-Meteo → efemèrides → índex → BD
    repository.ts          Els ports sobre Kysely: punts, `index_visibilitat`, `execucions_worker`
```

Per què node-cron i no el cron del sistema: [ADR-0024](../../docs/decisions/0024-planificacio-worker-node-cron.md).

- **Una execució** (`recalculaIndex`): llegeix els punts `PUBLICAT` (posició, altitud i SQM), i els recalcula **en lots de 10**: per a cada lot, en demana la previsió a Open-Meteo (timeout de 30 s i **un reintent** si l'error és de xarxa, timeout, 429 o 5xx), hi creua les efemèrides i desa l'índex de l'hora en curs i de les següents (`desaIndexs` substitueix les hores ja calculades). Un lot que falla no atura els altres. Després esborra l'índex de fa més de 24 hores i avalua les alertes (vegeu «Avaluació de les alertes»).
- **La marca de versió** (ADR-0012): en acabar, desa una fila a `execucions_worker` (`iniciada_el`, `acabada_el`, `estat`, punts i hores desats, i el missatge de l'error). L'estat és `ok` només si tots els lots han anat bé; si no, és `error` i l'error diu quins punts han fallat. Si el registre mateix falla, es mostra al log i no amaga l'error de l'execució. L'API fa servir l'última `acabada_el` d'una execució que ha desat algun punt (també si n'ha fallat algun lot) per saber quan ha de regenerar el GeoJSON del mapa.
- **Errors:** si falla Open-Meteo o la base de dades, l'error queda a `execucions_worker`, es mostra al log i el procés continua: es torna a provar a l'hora següent. Si una execució encara no ha acabat quan arriba la següent, la nova se salta.
- **Base de dades penjada:** el pool té timeouts (10 s per connectar, 30 s per consulta), i una BD que no respon no pot deixar l'execució encallada per sempre.
- **Aturada:** amb `SIGTERM` (Docker) o `SIGINT` no comença cap lot més, espera el que està en curs i tanca el pool. El compose dona 75 s (`stop_grace_period`).
- **Build:** `npm run build` compila amb tsup, que inclou `@talaia/db`, `@talaia/index` i `@talaia/shared` dins de `dist/main.js` (no tenen build), com a l'API.

Prova en local amb la base de dades de Supabase local (`npx supabase start`):

```bash
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres npm run start -w services/worker
```

## Avaluació de les alertes (TG-153)

```
src/
  alertes/
    avaluacio.ts           Els plans de cada execució (finestra i quan avisa), la decisió pura i el cas d'ús (`evaluateAlerts`)
    repository.ts          Una consulta per als candidats i un insert per a les notificacions (Kysely)
```

Per què així: [ADR-0033](../../docs/decisions/0033-avaluacio-alertes-worker.md), que concreta l'[ADR-0028](../../docs/decisions/0028-notificacions-push.md).

- **Quan:** dins de cada execució (port `alertes` de `recalculaIndex`), amb l'índex ja desat, si l'execució n'ha desat algun punt (també si ha fallat algun lot). Un error de les alertes **no fa fallar el recàlcul**: queda al log i a `execucions_worker.error_alertes`, i l'`estat` continua sent el de l'índex. `execucions_worker.notificacions` diu quantes notificacions noves s'han desat.
- **Quines hores** (`alertsWindow`): les que queden de la nit en curs, des de l'hora en curs fins a les 12:00 locals de l'endemà. La nit és la de l'API (TG-104), compartida a `@talaia/shared` (`nit.ts`): de 12:00 a 12:00 a `Europe/Madrid`, de 23 o 25 hores els dies del canvi d'hora.
- **Quan avisa** (`alertsPlans`, TG-146): les alertes amb `avisa_en_arribar` s'avaluen a cada execució, amb les hores que queden de la nit en curs. Les que tenen `hora_avis` només a l'execució d'aquella hora local, amb la nit del dia d'avui (la del vespre): a partir del migdia és la nit en curs i va en la mateixa consulta; abans del migdia (una alerta de les 9), la nit en curs encara és la d'ahir i la d'avui es demana a part, sencera. Com a molt dues consultes per execució.
- **La decisió** (`pickNotifications`, codi pur): per a cada alerta activa del pla i d'un compte no bloquejat (ADR-0029), els punts publicats a `distancia_max_km` o menys de l'origen amb un índex ≥ `index_minim` i més gran que 0. El millor és el de més índex; si empaten, el més proper, i després l'hora més d'hora. A la v1 l'índex és el mateix per a tots els objectius (ADR-0018).
- **Una per alerta i nit:** `notificacions_alertes` té la clau primària `(alerta_id, nit)` i la notificació es desa amb `on conflict do nothing`. La consulta de candidats ja salta les alertes notificades aquesta nit. Si cap hora no arriba al mínim, no es desa res i una previsió millor encara pot notificar més tard.
- **Eficient:** una sola consulta per pla per a totes les alertes (`st_dwithin` amb el radi de cada una, sobre l'índex GIST) i un sol `insert`, sigui quin sigui el nombre d'alertes.
- **Enviament:** el fa `createAlertsStep` després d'avaluar (vegeu «Enviament de les notificacions»).

## Enviament de les notificacions (TG-154)

```
src/
  alertes/
    expoPush.ts              Client de l'Expo Push Service amb `fetch` (un POST de com a molt 100 missatges)
    enviament.ts             Què s'envia, el text i els reintents (`sendPendingNotifications`)
    enviamentRepository.ts   Pendents, tokens de `dispositius_push`, `enviada_el` i tokens morts (Kysely)
```

- **Què:** a cada execució, després d'avaluar, les files de `notificacions_alertes` amb `enviada_el` a `null` la millor hora de les quals encara no ha passat (l'hora en curs compta), d'alertes actives, comptes no bloquejats i punts publicats, i on l'**índex actual** d'aquella hora (`index_visibilitat`) encara arriba al mínim de l'alerta. El text porta aquest índex, no el de l'avaluació. Són les noves i les que no s'han pogut enviar abans: **les fallides es reintenten** a l'execució següent.
- **Sense duplicats:** abans d'enviar, cada fila es **reserva** amb un sol `update … set enviada_el = now() where enviada_el is null … returning` (`claim`). Dos workers alhora contra la mateixa BD no poden reservar la mateixa fila (Postgres bloqueja la fila i el segon la salta), i un error de la BD després d'enviar no fa que es torni a enviar. Les que no arriben a cap dispositiu es desfan (`release`, només si la reserva és la pròpia) i es reintenten; si desfer-ho falla, aquella nit es perd, que és preferible a enviar-la dues vegades.
- **A qui:** un missatge per token del perfil (`dispositius_push`), en peticions de com a molt 100, amb `data: { puntId }` (l'app obre la fitxa en tocar-la), `channelId: 'alertes'`, `sound: 'default'` i el text en català: «Bona nit per observar a Montsec» / «Índex de visibilitat 75 a les 23:00».
- **Enviada:** quan Expo accepta el missatge d'almenys un dispositiu: es desen els `ticket_ids` i `enviada_el` es queda. Amb la clau `(alerta_id, nit)` de l'avaluació, com a molt una per alerta i nit.
- **Tokens morts:** el ticket `DeviceNotRegistered` (l'app s'ha desinstal·lat) esborra el token de `dispositius_push`, després de desar l'estat de les notificacions i amb el seu propi `try`. Els altres errors (`MessageRateExceeded`, HTTP, xarxa, BD) van al log i a `execucions_worker.error_alertes`; les notificacions noves continuen comptant a `execucions_worker.notificacions`.
- **Sense token** (sense permís de notificacions, Expo Go): no s'envia res i la reserva es desfà; si l'usuari activa les notificacions abans de la millor hora, la rep llavors.
- **`ENVIA_PUSH`**: el worker només envia amb `ENVIA_PUSH=true`. Per defecte no, perquè un `npm run start` local amb la BD compartida no notifiqui usuaris reals (avalua igualment i desa les notificacions, que enviarà la VM). El `deploy/compose.yaml` de la VM la posa a `true` si no es diu res.
- **`EXPO_ACCESS_TOKEN`** (opcional): cal si el projecte d'Expo té activada la seguretat reforçada de push; s'envia com a `Authorization: Bearer`.
- Per què `fetch` i no `expo-server-sdk`: amb unes poques notificacions per hora només cal un `POST`, i la llibreria (ESM, Node ≥ 22.12) afegiria una dependència per a quatre línies. Els reintents ja els fa l'execució horària.
- Encara no es llegeixen els *receipts* d'Expo (`/push/getReceipts`): un `DeviceNotRegistered` que només arribi pel receipt no esborra el token fins que un ticket posterior el torni (vegeu l'ADR-0028).

## Tests

Jest, sense xarxa: la ingesta es prova amb un client d'Open-Meteo i un repositori falsos, el recàlcul amb ports en memòria, el repositori de l'índex en memòria i la XEMA amb un `fetch` fals. Els tests del client d'Open-Meteo, del càlcul astronòmic i de la fórmula són a `@talaia/index` (`npm test -w packages/index`). Les alertes (TG-155): la finestra de la nit (migdia, matinada, estiu i hivern, les nits de 23 i 25 hores del canvi d'hora), els plans de cada execució (en arribar-hi i a una hora, abans i després del migdia), la decisió (mínim, índex 0, radi, alertes inactives, comptes bloquejats, quan avisa, hores passades i de la nit següent, desempats), la no repetició amb un repositori en memòria que fa de clau primària i amb l'SQL de Kysely (`src/testing/fakeDb.ts`), i que un error de les alertes no fa fallar el recàlcul. L'enviament (TG-154): el client d'Expo amb un `fetch` fals (tickets, errors HTTP i de xarxa, access token, lots de 100), els reintents, la reserva (dues execucions alhora, errors de la BD després d'enviar) i la no repetició amb un repositori en memòria, els tokens `DeviceNotRegistered` i l'SQL de Kysely.
