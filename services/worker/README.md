# @talaia/worker

Procés de Talaia que ingesta les dades externes i recalcula l'índex de visibilitat de tots els punts **cada hora** ([ADR-0004](../../docs/decisions/0004-index-precalculat.md)). Node 22 + TypeScript (strict), mateixes eines que l'API.

Estat: hi ha la **ingesta de la previsió d'Open-Meteo** (TG-95 i TG-114). La planificació horària i el contenidor Docker arriben amb TG-99; la fórmula de l'índex, amb TG-98.

## Ordres

```bash
nvm use && npm install        # des de l'arrel: instal·la tots els workspaces
```

| Ordre (`-w services/worker`) | Què fa |
|---|---|
| `npm run meteo -- <lat,lon> [<lat,lon> …]` | Demana la previsió d'un o més llocs a Open-Meteo i la mostra per pantalla |
| `npm run build` | Compila a `dist/` (sense els tests) |
| `npm run typecheck` | TypeScript strict (`tsconfig.base.json` de l'arrel) |
| `npm test` | Jest |
| `npm run lint` | ESLint amb la configuració de l'arrel |

Exemple (Montsec i Barcelona):

```bash
npm run meteo -w services/worker -- 42.0294,0.7112 41.3851,2.1734
```

## Variables d'entorn

Es llegeixen del `.env` de l'**arrel** del repo (`--env-file-if-exists`; vegeu `.env.example`) i es validen a `src/config/env.ts`.

| Variable | Per defecte | Què és |
|---|---|---|
| `OPEN_METEO_BASE_URL` | `https://api.open-meteo.com/v1` | URL base de l'API d'Open-Meteo (sense clau; 10.000 crides/dia) |

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

  Les unitats de temperatura, precipitació i vent es demanen explícitament (`UNITATS`), per no dependre dels valors per defecte de la font. Una variable nova s'afegeix a `VARIABLES_HORARIES`, a l'esquema zod i a `toHores`; el typecheck avisa si en falta alguna.
- **Hores en UTC.** Es demana `timezone=UTC` i `timeformat=unixtime`, i cada hora es desa com a ISO 8601 (`2026-10-12T21:00:00.000Z`). Per defecte, **4 dies** de previsió: Open-Meteo compta els dies de 00:00 a 23:00 UTC, i amb 3 la nit de demà passat quedaria tallada a la 01:00 hora local; amb 4, la nit d'avui i les dues següents hi són senceres.
- **Una petició per lot de llocs.** Open-Meteo admet llistes de coordenades: els punts es demanen en lots de 50 (`llocsPerPeticio`), en el mateix ordre, i cada lloc compta com una crida de la quota. Amb el catàleg del Sprint 1 (≥ 30 punts) i una execució per hora són menys de 1.000 crides al dia.
- **Valors `null`.** Si el model no dóna un valor per a una hora, es desa `null` (no s'inventa res). La fórmula de l'índex (TG-98) decideix què fer-ne.
- **Errors.** Un error de xarxa o un timeout (`timeoutMs`, 15 s per defecte), un error HTTP, un cos inesperat (també una sèrie més curta que `time`) o un nombre de llocs diferent del demanat llancen `OpenMeteoError` (amb `status` quan hi ha resposta HTTP). Si falla un lot, `previsio` rebutja sencer: la ingesta no desa res i es conserva la previsió anterior. Un reintent per a 429, 5xx i errors de xarxa queda per a TG-99.
- **Persistència.** `ingestaPrevisioMeteo` escriu a un `PrevisioMeteoRepository`. La implementació amb Kysely (`@talaia/db`, [ADR-0013](../../docs/decisions/0013-acces-bd-kysely.md)) i la migració de la taula de previsions es faran quan hi hagi la taula de punts (TG-86); fins aleshores hi ha la de memòria, que fan servir els tests i la CLI.

## Tests

Jest, sense xarxa: el client es prova amb un `fetch` fals (URL construïda, resposta d'un lloc i de diversos, lots i un lot que falla, `null`, timeout, errors de xarxa i HTTP, cossos inesperats) i la ingesta amb un client i un repositori falsos.
