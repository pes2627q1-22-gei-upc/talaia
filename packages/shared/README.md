# @talaia/shared

Tipus de domini compartits per l'app, l'admin, l'API i el worker. Cada tipus s'escriu **una sola vegada** aquí.

## Què hi ha

| Fitxer | Tipus | Estat |
|---|---|---|
| `src/api.ts` | `ApiErrorBody`, `HealthResponse` | Decidits |
| `src/indexVisibilitat.ts` | `IndexVisibilitat` (valor 0–100 + franja), `FranjaIndex` (`tap`/`jus`/`ras`) | Llindars de les franges pendents de P12 (TG-98) |
| `src/meteo.ts` | `PrevisioMeteoHora`, `PrevisioMeteoPunt`, `FontMeteo` (previsió d'Open-Meteo per punt) i `LecturaXema` (observacions de Meteocat) | Variables de TG-95 i TG-114; observacions de la XEMA, TG-115 |
| `src/astronomia.ts` | `EfemeridesHora`, `NitAstronomica`, `PosicioAstre`, `EstatLluna`, `FranjaCrepuscle`, `FaseLunar` (Sol, Lluna, fase i crepuscles per punt, calculats pel worker) | TG-96; els consumeix la fórmula de l'índex (TG-98) |
| `src/punts.ts` | `PuntObservacio`, `PuntsMapaGeoJson` (el GeoJSON del mapa, ADR-0012) | Metadades del punt pendents de P13 (TG-87) i del model de TG-86 |
| `src/recomanacions.ts` | `ObjectiuObservacio`, `ConsultaRecomanacions` (el que es tria a «Què vols veure?», TG-101) | Paràmetres de `GET /recomanacions` (TG-100) |
| `src/esdeveniments.ts` | `Esdeveniment`, `TipusFenomen` | Valors de `tipus` pendents de P14; contracte amb Aprop a TG-109 |

Un camp que depèn d'una decisió pendent porta un comentari que ho diu. No s'hi inventen valors: quan es decideixi, s'actualitza aquí i a l'ADR.

## Com es fa servir

Ja és una dependència de l'app i de l'API (npm workspaces). Sempre amb **`import type`**:

```ts
import type { PuntsMapaGeoJson } from '@talaia/shared';
```

Per què només tipus: el paquet no té pas de build. Metro, Jest i el `tsc` de l'API llegeixen els `.ts` directament i els esborren en compilar, i així no cal compilar res abans de treballar. Un `import` normal fallaria a l'API compilada (`node dist/server.js`), i per això ESLint el rebutja (`@typescript-eslint/no-restricted-imports` a `eslint.config.mjs`).

Quan calgui codi en temps d'execució (esquemes zod compartits, la fórmula de l'índex), s'haurà d'afegir un build a aquest paquet (`tsc` cap a `dist/`) i treure aquesta regla. Es decideix amb un ADR.

## Afegir un tipus

1. Posa'l al fitxer del seu domini (o crea'n un de nou a `src/`) amb `export type`.
2. Si el fitxer és nou, afegeix-lo a `src/index.ts` (`export type * from './fitxer'`).
3. Noms i camps en català, tal com surten a l'API (`nom`, `municipi`, `inici`…).
4. A l'API, tipa l'esquema zod amb el tipus compartit (`const Schema: z.ZodType<Tipus> = …`): si divergeixen, no compila. Exemple: `services/api/src/routes/health.ts`.
5. `npm run typecheck` des de l'arrel.
