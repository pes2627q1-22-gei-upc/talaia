# ADR-0034: Tests de la web d'administració amb Vitest

**Estat:** Acceptada · **Data:** 2026-11-17 · Excepció a l'ADR-0010 (P7) per a `apps/admin` · TG-263 ([TEC])

## Context

L'ADR-0010 fixa **Jest a tot arreu** (P7). La web d'administració (ADR-0030) és una aplicació Vite: el codi llegeix la configuració pública amb `import.meta.env` i s'escriu com a mòduls ES. Jest no entén `import.meta` sense un transformador addicional (Babel o un plugin de `ts-jest`) i una configuració pròpia de mòduls ES, que duplicaria la de `vite.config.ts`.

La TG-263 afegeix una suite de tests de comportament a l'admin i en porta la cobertura a SonarCloud (TG-181).

## Decisió

- `apps/admin` es prova amb **Vitest**, configurat al mateix `vite.config.ts` (`test`): reutilitza el plugin de React, la resolució de mòduls i `import.meta.env` de Vite.
- Entorn **jsdom** amb **Testing Library** (`@testing-library/react`, `user-event` i `jest-dom`): els tests actuen com l'usuari (rols, etiquetes i textos visibles) i no depenen de l'estat intern dels components.
- Supabase Auth i l'API se simulen: `@supabase/supabase-js` es substitueix per un client en memòria (`src/__tests__/support/`) i `fetch` es reemplaça a cada test. Cap test fa crides reals.
- Cobertura amb `@vitest/coverage-v8` en format LCOV (`apps/admin/coverage/lcov.info`). La CI l'adapta a l'arrel del repositori amb `scripts/ci/prepare-sonar-coverage.mjs` i SonarCloud la importa amb la resta d'informes. El Quality Gate no canvia.
- La resta del monorepo continua amb Jest.

## Alternativa descartada

**Jest amb un transformador per a `import.meta.env`**: mantindria un sol runner, però afegiria dependències i configuració de Babel o `ts-jest` només per a l'admin, i separaria la configuració dels tests de la del build. Vitest comparteix l'API de Jest (`describe`, `it`, `expect`, mocks), així que canviar d'un a l'altre entre workspaces no demana aprendre res nou.

## Conseqüències

- `npm run test --workspace apps/admin` executa `vitest run`; la CI hi afegeix `--coverage`. Vitest no accepta les opcions de Jest `--ci` ni `--runInBand`.
- Els helpers dels tests viuen a `src/__tests__/`, que Sonar classifica com a tests, i no compten com a codi de producció.
- Les pantalles noves de l'admin (punts, TG-175; usuaris, TG-178) afegeixen els seus tests a la mateixa tasca, amb el mateix client simulat.
