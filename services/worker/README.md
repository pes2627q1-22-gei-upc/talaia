# @talaia/worker

Procés de Talaia que ingesta les dades externes i recalcula l'índex de visibilitat de tots els punts **cada hora** ([ADR-0004](../../docs/decisions/0004-index-precalculat.md)). Node 22 + TypeScript (strict), mateixes eines que l'API.

Estat: hi ha la **ingesta de la previsió d'Open-Meteo** (TG-95 i TG-114), el **càlcul astronòmic** amb Astronomy Engine (TG-96) i la **fórmula de l'índex v1** amb la seva persistència (TG-98). El **procés horari** (TG-99) recalcula l'índex de tots els punts en arrencar i cada hora amb node-cron, dins del contenidor.

## Ordres

```bash
nvm use && npm install        # des de l'arrel: instal·la tots els workspaces
```

| Ordre (`-w services/worker`) | Què fa |
|---|---|
| `npm run start` | Procés horari (`src/main.ts`): recalcula l'índex en arrencar i cada hora. Cal `DATABASE_URL` |
| `npm run meteo -- <lat,lon> [<lat,lon> …]` | Demana la previsió d'un o més llocs a Open-Meteo i la mostra per pantalla |
| `npm run astro -- <lat,lon[,altitud]> [YYYY-MM-DD]` | Mostra la nit d'un lloc (Sol, crepuscles, Lluna) i les efemèrides hora a hora, sense xarxa |
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

## Ingesta de la previsió d'Open-Meteo (TG-95 i TG-114)

```
src/
  config/env.ts            Variables d'entorn validades amb zod
  meteo/
    openMeteo.ts           Client HTTP: construeix la petició, valida la resposta (zod) i la
                           converteix a `PrevisioMeteoHora[]` per lloc
    ingesta.ts             Cas d'ús: previsió de tots els punts → repositori, amb un resum
    repository.ts          Port `PrevisioMeteoRepository` + implementació en memòria
    cli.ts                 `npm run meteo`: prova manual sense base de dades
```

- **Variables** (horàries), amb el nom del domini (`@talaia/shared`, `PrevisioMeteoHora`) i la unitat:

  | Open-Meteo | Domini | Unitat | Tasca |
  |---|---|---|---|
  | `cloud_cover`, `cloud_cover_low`, `cloud_cover_mid`, `cloud_cover_high` | `nuvolsTotal`, `nuvolsBaixos`, `nuvolsMitjans`, `nuvolsAlts` | % | TG-95 |
  | `relative_humidity_2m` | `humitat` | % | TG-95 |
  | `visibility` | `visibilitat` | m | TG-95 |
  | `temperature_2m`, `dew_point_2m` | `temperatura`, `puntRosada` | °C | TG-114 |
  | `precipitation`, `precipitation_probability` | `precipitacio`, `probabilitatPrecipitacio` | mm, % | TG-114 |
  | `wind_speed_10m`, `wind_gusts_10m`, `wind_direction_10m` | `ventVelocitat`, `ventRafegues`, `ventDireccio` | km/h, km/h, graus | TG-114 |

  **Hora anterior o instant.** Totes les variables són instantànies (el valor a `hora`) excepte tres, que Open-Meteo dóna com a resum de l'hora **anterior** (de `hora` − 1 h a `hora`): `precipitacio` (suma), `probabilitatPrecipitacio` i `ventRafegues` (màxim). Es desen tal com arriben i el tipus ho documenta; la fórmula (TG-98) decideix com les alinea.

  Les unitats de temperatura, precipitació i vent es demanen explícitament (`UNITATS`), per no dependre dels valors per defecte de la font, i la resposta es rebutja si `hourly_units` no declara la unitat esperada de cada sèrie (`UNITATS_ESPERADES`). Una variable nova s'afegeix a `VARIABLES_HORARIES`, a l'esquema zod i a `toHores`; el typecheck avisa si en falta alguna.
- **Hores en UTC.** Es demana `timezone=UTC` i `timeformat=unixtime`, i cada hora es desa com a ISO 8601 (`2026-10-12T21:00:00.000Z`). Per defecte, **4 dies** de previsió: Open-Meteo compta els dies de 00:00 a 23:00 UTC, i amb 3 la nit de demà passat quedaria tallada a la 01:00 hora local; amb 4, la nit d'avui i les dues següents hi són senceres.
- **Una petició per lot de llocs.** Open-Meteo admet llistes de coordenades: els punts es demanen en lots de 50 (`llocsPerPeticio`), en el mateix ordre. Quota (sense clau, 10.000 crides/dia): cada lloc compta com una crida, i a partir de 10 variables les crides són fraccionades (13 variables → 1,3 crides per lloc). Amb 30 punts i una execució per hora: 30 × 24 × 1,3 ≈ 940 crides al dia; el límit s'assoleix cap als 320 punts.
- **Valors `null`.** Si el model no dóna un valor per a una hora, es desa `null` (no s'inventa res). La fórmula de l'índex (TG-98) decideix què fer-ne.
- **Errors.** Un error de xarxa o un timeout (`timeoutMs`, 15 s per defecte), un error HTTP, un cos inesperat (també una sèrie més curta que `time`) o un nombre de llocs diferent del demanat llancen `OpenMeteoError` (amb `status` quan hi ha resposta HTTP). Si falla un lot, `previsio` rebutja sencer: la ingesta no desa res i es conserva la previsió anterior. Un reintent per a 429, 5xx i errors de xarxa queda per a TG-99.
- **Persistència.** `ingestaPrevisioMeteo` escriu a un `PrevisioMeteoRepository`. La implementació amb Kysely (`@talaia/db`, [ADR-0013](../../docs/decisions/0013-acces-bd-kysely.md)) i la migració de la taula de previsions són el següent pas, ara que hi ha `punts_observacio` (TG-86); fins aleshores hi ha la de memòria, que fan servir els tests i la CLI.

## Càlcul astronòmic amb Astronomy Engine (TG-96)

```
src/
  astronomia/
    astronomia.ts          Càlcul pur: posició del Sol i de la Lluna, fase, franja de crepuscle,
                           efemèrides per hora i esdeveniments d'una nit
    cli.ts                 `npm run astro`: prova manual sense xarxa
```

[Astronomy Engine](https://github.com/cosinekitty/astronomy) calcula dins del servidor, sense API externa ni quota ([ADR-0004](../../docs/decisions/0004-index-precalculat.md)): exacte (± 1 minut en sortides i postes), determinista i sense dependències. Els tipus són a `@talaia/shared` (`src/astronomia.ts`). Totes les funcions reben un `LlocObservacio` (`lat`, `lon` en graus WGS84 i `altitud` opcional en metres) i instants ISO 8601; retornen sempre UTC.

| Funció | Què dóna |
|---|---|
| `efemeridesHora(lloc, hora)` | `EfemeridesHora`: alçada i azimut del Sol, franja de crepuscle i estat de la Lluna (alçada, azimut, fracció il·luminada, angle de fase i nom) en un instant |
| `efemeridesHores(lloc, hores)` | Una `EfemeridesHora` per hora, en el mateix ordre: pensat per alinear-les amb les hores de la previsió (`PrevisioMeteoHora.hora`) abans de calcular l'índex (TG-98) |
| `nitAstronomica(lloc, 'YYYY-MM-DD')` | `NitAstronomica`: posta i sortida del Sol, fi i inici dels tres crepuscles, si la Lluna és sobre l'horitzó a la posta, sortida i posta de la Lluna dins de la nit i fase a mitja nit |
| `posicioSol`, `estatLluna`, `faseLunar` | Les peces per separat |
| `franjaCrepuscle(alcadaSol)`, `nomFaseLunar(angle)` | Classificadors purs, sense Astronomy Engine |

- **Alçades geomètriques.** `alcada` és la del centre de l'astre sense refracció atmosfèrica, que és el que fan servir les definicions dels crepuscles: `dia` (> −0,833°, la convenció de sortida i posta), `civil` (fins a −6°), `nautic` (fins a −12°), `astronomic` (fins a −18°) i `nit`. Les sortides i postes (`SearchRiseSet`) sí que tenen en compte la refracció i el disc, però per a un **horitzó ideal** (el mar): l'`altitud` només afina la refracció (uns 27 s al Montsec) i el relleu que tapa l'horitzó real és feina del perfil d'horitzó (TG-116). Alçades i azimuts amb 2 decimals; fracció il·luminada amb 3; angle de fase amb 1. Els valors d'`EfemeridesHora` són els de l'**instant** `hora`, no un resum de l'hora que comença.
- **Fase de la Lluna.** `angleFase` és la diferència de longitud eclíptica Lluna − Sol (0° nova, 90° quart creixent, 180° plena, 270° quart minvant), i `fase` el nom en vuit trams de 45° centrats en aquests angles. `fraccioIlluminada` (0–1) és la que pesa a la fórmula de l'índex. És igual a tota la Terra: no depèn del lloc.
- **La nit.** `nitAstronomica` és la nit que **comença el vespre** del dia `data`: la posta de sol es busca a partir del migdia solar mitjà del lloc (12:00 UTC corregit per la longitud), de manera que no cal cap zona horària. La sortida i la posta de la Lluna només s'informen si cauen entre la posta i la sortida del Sol (`null` si no), i `llunaSobreHoritzoALaPosta` desfà l'ambigüitat dels dos `null`: amb Lluna plena hi és tota la nit (`true`: surt abans de la posta i es pon després de l'alba) i amb Lluna nova no hi és mai (`false`). Un crepuscle és `null` si el Sol no arriba a l'alçada (a Catalunya sempre hi arriba; a latituds altes, no); si el Sol no es pon o no surt, llança `RangeError`. Cada cerca del Sol comença un minut després de l'esdeveniment anterior, perquè a latituds altes (el Sol fregant l'horitzó) no torni a trobar el mateix instant; el càlcul s'ha comprovat fins a 66° N.
- **Errors.** Un lloc fora de rang, una `altitud` que no és un nombre, un instant que no és ISO 8601 **amb zona** (`2026-10-14T22:00:00Z` o `…+02:00`; sense zona, JavaScript el llegiria amb la zona de la màquina) o una `data` que no és un dia real en format `YYYY-MM-DD` (`2026-02-30` es rebutja) llancen `RangeError` abans de calcular res.

## Índex de visibilitat v1 (TG-98)

```
src/
  index/
    formula.ts             Càlcul pur: factors, índex de 0 a 100 i franja (ADR-0018)
    repository.ts          Persistència a `index_visibilitat`: Kysely i en memòria
    cli.ts                 `npm run index`: prova manual amb la previsió real
```

`índex = 100 × N × S × (0,6 · F + 0,4 · L)`, cada factor de 0 a 1: **N** núvols (la capa que més tapa; 0 si plou), **S** Sol (1 de nit o en el crepuscle astronòmic, 0,5 en el nàutic, 0 si no), **F** foscor (de l'SQM del punt, la columna `sqm` de `punts_observacio` que omple TG-97; 0,6 si el punt no en té) i **L** Lluna (la llum que fa segons la fracció il·luminada i l'alçada). Franges: 0–39 `tap`, 40–69 `jus`, 70–100 `ras`. Els pesos i els llindars són a `FORMULA_V1`; per què, a l'[ADR-0018](../../docs/decisions/0018-formula-index-v1.md).

| Funció | Què fa |
|---|---|
| `calculaIndex({ meteo, efemerides, sqm })` | `IndexHora` d'una hora: valor, franja, `factors` (`FactorsIndex`, per al desglossament de HU04) i `foscorEstimada`. Llança `RangeError` si la previsió i les efemèrides no són del mateix instant |
| `calculaIndexHores(meteo, efemerides, sqm)` | L'índex de cada hora que tenen totes dues llistes, en l'ordre de la previsió |
| `factorNuvols`, `factorSol`, `factorFoscor`, `factorLluna`, `franjaDe` | Les peces per separat |
| `createKyselyIndexRepository(db)` | `desaIndexs(puntId, hores)` (recalcular una hora la substitueix) i `indexsDe(puntId)` |

Prova manual, sense base de dades:

```bash
npm run index -w services/worker -- 42.0294,0.7112          # el Montsec, foscor estimada
npm run index -w services/worker -- 42.0294,0.7112 21.56    # amb l'SQM del lloc (data/punts_observacio.geojson)
```

## Recàlcul horari (TG-99)

```
src/
  main.ts                  Cablejat del procés llarg: pool, node-cron a «5 * * * *» (UTC) i senyals
  recalcul/
    executor.ts            Sense solapaments, errors que no aturen el procés i aturada que espera
    recalcul.ts            Una execució, per lots: punts → Open-Meteo → efemèrides → índex → BD
    repository.ts          Els ports sobre Kysely: punts, `index_visibilitat`, `execucions_worker`
```

Per què node-cron i no el cron del sistema: [ADR-0024](../../docs/decisions/0024-planificacio-worker-node-cron.md).

- **Una execució** (`recalculaIndex`): llegeix els punts `PUBLICAT` (posició, altitud i SQM), i els recalcula **en lots de 10**: per a cada lot, en demana la previsió a Open-Meteo (timeout de 30 s i **un reintent** si l'error és de xarxa, timeout, 429 o 5xx), hi creua les efemèrides i desa l'índex de l'hora en curs i de les següents (`desaIndexs` substitueix les hores ja calculades). Un lot que falla no atura els altres. Després esborra l'índex de fa més de 24 hores.
- **La marca de versió** (ADR-0012): en acabar, desa una fila a `execucions_worker` (`iniciada_el`, `acabada_el`, `estat`, punts i hores desats, i el missatge de l'error). L'estat és `ok` només si tots els lots han anat bé; si no, és `error` i l'error diu quins punts han fallat. Si el registre mateix falla, es mostra al log i no amaga l'error de l'execució. L'API fa servir l'última `acabada_el` correcta per saber quan ha de regenerar el GeoJSON del mapa.
- **Errors:** si falla Open-Meteo o la base de dades, l'error queda a `execucions_worker`, es mostra al log i el procés continua: es torna a provar a l'hora següent. Si una execució encara no ha acabat quan arriba la següent, la nova se salta.
- **Base de dades penjada:** el pool té timeouts (10 s per connectar, 30 s per consulta), i una BD que no respon no pot deixar l'execució encallada per sempre.
- **Aturada:** amb `SIGTERM` (Docker) o `SIGINT` no comença cap lot més, espera el que està en curs i tanca el pool. El compose dona 75 s (`stop_grace_period`).
- **Build:** `npm run build` compila amb tsup, que inclou `@talaia/db` i `@talaia/shared` dins de `dist/main.js` (no tenen build), com a l'API.

Prova en local amb la base de dades de Supabase local (`npx supabase start`):

```bash
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres npm run start -w services/worker
```

## Tests

Jest, sense xarxa: el client d'Open-Meteo es prova amb un `fetch` fals (URL construïda, resposta d'un lloc i de diversos, lots i un lot que falla, `null`, unitats inesperades, timeout, errors de xarxa i HTTP, cossos inesperats) i la ingesta amb un client i un repositori falsos. El càlcul astronòmic es contrasta amb fets independents de la llibreria: l'alçada del Sol al migdia del solstici (90° − latitud + 23,44°), la Lluna nova durant l'eclipsi solar del 12/08/2026 i la plena durant l'eclipsi lunar del 03/03/2026, les hores de l'USNO i de JPL Horizons a Barcelona (posta, crepuscles, Lluna i la nit del canvi d'hora), l'ordre i la durada dels crepuscles i el Sol just al llindar en cada esdeveniment. La fórmula de l'índex es prova factor a factor, amb l'exemple de l'ADR-0018, les franges i el repositori en memòria.
