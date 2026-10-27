# ADR-0010: Eines de l'app mòbil i del monorepo

**Estat:** Acceptada · **Data:** 2026-10-04 (ampliada el 2026-10-06 amb TG-67) · Resol les decisions pendents P1, P2, P3, P7 i P8

## Context

El scaffold de l'app (TG-66) necessitava tancar les eines bàsiques abans que l'equip comenci a programar el 08/10.

## Decisió

| # | Tema | Decisió |
|---|---|---|
| P1 | Workspaces | **npm workspaces** a l'arrel (`apps/mobile` de moment; cada servei s'hi afegeix quan neix). `package-lock.json` únic a l'arrel. |
| P2 | Navegació | **Expo Router** amb rutes a `apps/mobile/src/app/` i pestanyes natives (`NativeTabs`). |
| P3 | Dades remotes | **TanStack Query** a la capa Repository; estat local als ViewModels. Res de Redux. |
| P7 | Tests | **Jest** a tot arreu (`jest-expo` + Testing Library a l'app). |
| P8 | Node | **Node 22 LTS** (`.nvmrc`, `engines`). |
| TG-67 | Qualitat de codi | **ESLint 9** (flat config a l'arrel: `@eslint/js` + `typescript-eslint` a tot arreu, `eslint-config-expo` només a `apps/mobile`, `eslint-config-prettier`), **Prettier** a l'arrel i **`tsconfig.base.json`** strict que estenen els workspaces. `any` és error i tot `eslint-disable` porta justificació (`-- motiu`). |
| TG-67 | Hooks de Git | **husky + lint-staged** (ESLint `--fix` i Prettier al pre-commit) i **commitlint** (`config-conventional`, capçalera ≤ 72 caràcters, descripció en minúscula, peu `Refs: TG-<ref>` obligatori; merge commits exempts). |

Versions de partida: Expo SDK 57, React Native 0.86, React 19.2, TypeScript 6, i18next 26.

## Conseqüències

- Les dependències amb codi natiu s'afegeixen amb `npx expo install` (versió compatible amb l'SDK).
- Les rutes viuen a `src/app/` i són fitxers prims; la lògica és a `src/features/<feature>/` (MVVM).
- TypeScript 6 no carrega els tipus globals de test sol: `tsconfig` declara `"types": ["jest"]`.
- ESLint es queda a la 9 mentre `eslint-plugin-react` i `eslint-plugin-import` (via `eslint-config-expo`) no suportin la 10.
- Límit de 72 caràcters a la capçalera: coincideix amb el que GitHub mostra sense tallar i deixa marge per al català. Es va descartar 50 (gairebé cap commit real hi cabia) i 100 (GitHub els talla).
- Un workspace nou no necessita configuració d'ESLint pròpia; només ha d'estendre `tsconfig.base.json`.
