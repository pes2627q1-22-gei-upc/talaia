# @talaia/worker

Procés de Talaia que ingesta les dades externes i recalcula l'índex de visibilitat de tots els punts **cada hora** ([ADR-0004](../../docs/decisions/0004-index-precalculat.md)). Node 22 + TypeScript (strict), mateixes eines que l'API.

Estat: hi ha la **ingesta de la previsió d'Open-Meteo** (TG-95). La planificació horària i el contenidor Docker arriben amb TG-99; la fórmula de l'índex, amb TG-98.

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

## Ingesta de la previsió d'Open-Meteo (TG-95)

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

- **Variables** (horàries): `cloud_cover`, `cloud_cover_low`, `cloud_cover_mid`, `cloud_cover_high`, `relative_humidity_2m` i `visibility`. Al domini (`@talaia/shared`, `PrevisioMeteoHora`): `nuvolsTotal`, `nuvolsBaixos`, `nuvolsMitjans`, `nuvolsAlts` (%), `humitat` (%) i `visibilitat` (m). La resta de variables (temperatura, vent, precipitació, punt de rosada) és TG-114: s'afegeixen a `VARIABLES_HORARIES`, a l'esquema zod i a `toHores`.
- **Hores en UTC.** Es demana `timezone=UTC` i `timeformat=unixtime`, i cada hora es desa com a ISO 8601 (`2026-10-12T21:00:00.000Z`). Per defecte, 3 dies de previsió (la nit d'avui i les dues següents).
- **Una petició per lot de llocs.** Open-Meteo admet llistes de coordenades: els punts es demanen en lots de 50 (`llocsPerPeticio`), en el mateix ordre, i cada lloc compta com una crida de la quota. Amb el catàleg del Sprint 1 (≥ 30 punts) i una execució per hora són menys de 1.000 crides al dia.
- **Valors `null`.** Si el model no dóna un valor per a una hora, es desa `null` (no s'inventa res). La fórmula de l'índex (TG-98) decideix què fer-ne.
- **Errors.** Un error HTTP, un cos inesperat o un nombre de llocs diferent del demanat llancen `OpenMeteoError` (amb `status`). La ingesta no desa res si la font falla.
- **Persistència.** `ingestaPrevisioMeteo` escriu a un `PrevisioMeteoRepository`. La implementació amb Kysely (`@talaia/db`, [ADR-0013](../../docs/decisions/0013-acces-bd-kysely.md)) i la migració de la taula de previsions es faran quan hi hagi la taula de punts (TG-86); fins aleshores hi ha la de memòria, que fan servir els tests i la CLI.

## Tests

Jest, sense xarxa: el client es prova amb un `fetch` fals (URL construïda, resposta d'un lloc i de diversos, lots, `null`, errors HTTP i cossos inesperats) i la ingesta amb un client i un repositori falsos.
