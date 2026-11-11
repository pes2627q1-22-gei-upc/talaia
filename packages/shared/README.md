# @talaia/shared

Tipus de domini compartits per l'app, l'admin, l'API i el worker, i el codi pur que han de compartir (la nit, [ADR-0028](../../docs/decisions/0028-notificacions-push.md)). Cada tipus i cada funció s'escriu **una sola vegada** aquí.

## Què hi ha

| Fitxer | Tipus | Estat |
|---|---|---|
| `src/api.ts` | `ApiErrorBody`, `HealthResponse` | Decidits |
| `src/indexVisibilitat.ts` | `IndexVisibilitat` (valor 0–100 + franja), `FranjaIndex` (`tap`/`jus`/`ras`) | Llindars de les franges pendents de P12 (TG-98) |
| `src/meteo.ts` | `PrevisioMeteoHora`, `PrevisioMeteoPunt`, `FontMeteo` (previsió d'Open-Meteo per punt) i `LecturaXema` (observacions de Meteocat) | Variables de TG-95 i TG-114; observacions de la XEMA, TG-115 |
| `src/astronomia.ts` | `EfemeridesHora`, `NitAstronomica`, `PosicioAstre`, `EstatLluna`, `FranjaCrepuscle`, `FaseLunar` (Sol, Lluna, fase i crepuscles per punt, calculats pel worker) | TG-96; els consumeix la fórmula de l'índex (TG-98) |
| `src/punts.ts` | `PuntObservacio`, `PuntsMapaGeoJson` (el GeoJSON del mapa, ADR-0012) | Metadades del punt pendents de P13 (TG-87) i del model de TG-86 |
| `src/recomanacions.ts` | `ObjectiuObservacio`, `ConsultaRecomanacions` (el que es tria a «Què vols veure?», TG-101), `Recomanacio`, `RecomanacionsResposta` | Paràmetres i resposta de `GET /recomanacions` (TG-100) |
| `src/esdeveniments.ts` | `Esdeveniment`, `TipusFenomen` | Contracte amb Aprop acordat a TG-109 |
| `src/nit.ts` | **Codi:** `nightWindow`, `defaultNight`, `TIME_ZONE`, `NIGHT_START_HOUR`… Una nit va de les 12:00 locals d'un dia a les 12:00 de l'endemà (`Europe/Madrid`) | TG-104; la fan servir l'API i les alertes del worker (TG-153) |

Un camp que depèn d'una decisió pendent porta un comentari que ho diu. No s'hi inventen valors: quan es decideixi, s'actualitza aquí i a l'ADR.

## Com es fa servir

Ja és una dependència de l'app, de l'API i del worker (npm workspaces). Els tipus, sempre amb **`import type`**; el codi (`nit.ts`), amb un `import` normal:

```ts
import type { PuntsMapaGeoJson } from '@talaia/shared';
import { defaultNight, nightWindow } from '@talaia/shared';
```

El paquet no té pas de build: Metro, Jest i `tsx` llegeixen els `.ts` directament (`main` apunta a `src/index.ts`, com a `@talaia/db`), i el `tsup` de l'API i del worker n'inclou el codi dins del seu `dist/` (`noExternal: [/^@talaia\//]`). Per això només hi pot haver **codi pur i sense dependències** ([ADR-0028](../../docs/decisions/0028-notificacions-push.md)): res de zod, de Node ni de React Native. Un fitxer de codi s'exporta amb `export *` a `src/index.ts`; els de tipus, amb `export type *`.

## Afegir un tipus

1. Posa'l al fitxer del seu domini (o crea'n un de nou a `src/`) amb `export type`.
2. Si el fitxer és nou, afegeix-lo a `src/index.ts` (`export type * from './fitxer'`).
3. Noms i camps en català, tal com surten a l'API (`nom`, `municipi`, `inici`…).
4. A l'API, tipa l'esquema zod amb el tipus compartit (`const Schema: z.ZodType<Tipus> = …`): si divergeixen, no compila. Exemple: `services/api/src/routes/health.ts`.
5. `npm run typecheck` des de l'arrel.
