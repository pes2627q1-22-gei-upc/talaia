# @talaia/mobile

App mòbil de Talaia: React Native + TypeScript amb **Expo SDK 57** i **Expo Router**, arquitectura **MVVM**.

## Arrencar

```bash
nvm use                      # Node 22 (des de l'arrel)
npm install                  # des de l'arrel: instal·la tots els workspaces
npm run mobile               # = expo start, des de l'arrel
```

Variables: copia `apps/mobile/.env.example` a `apps/mobile/.env` (Expo no llegeix el `.env` de l'arrel). Al mòbil, l'adreça de l'API ha de ser la IP de l'ordinador: [docs/onboarding.md](../../docs/onboarding.md#4-engega-lapi-i-lapp).

Tota l'app es prova amb **Expo Go**, mapa inclòs. El mapa és MapLibre GL JS en una DOM component (`src/features/map/NightMap.tsx`, ADR-0015) i el seu estil nocturn és a `src/features/map/style/nightStyle.ts`. `metro.transformer.js` evita que Babel transformi `maplibre-gl`: no el treguis.

| Ordre | Què fa |
|---|---|
| `npm run typecheck -w apps/mobile` | TypeScript strict |
| `npm test -w apps/mobile` | Jest (`jest-expo`) |
| `npm run lint -w apps/mobile` | ESLint amb la configuració de l'arrel (`eslint.config.mjs`) |

> Per afegir dependències amb codi natiu: `npx expo install <paquet>` dins d'`apps/mobile` (tria la versió compatible amb l'SDK).

## Estructura

```
src/
  app/                  Rutes d'Expo Router. Fitxers prims: només importen la pantalla de la feature.
    _layout.tsx         Proveïdors globals + Stack arrel
    (tabs)/             Pestanyes natives: Mapa (index), Calendari, Perfil
    punt/[id].tsx       Fitxa d'un punt d'observació
    benvinguda.tsx      Benvinguda i accés (modal)
  features/<feature>/   Una carpeta per funcionalitat, amb les tres capes MVVM
    XxxScreen.tsx       View: només pinta i crida accions del ViewModel
    useXxxViewModel.ts  ViewModel: estat, textos traduïts, accions
    xxxRepository.ts    Model/Repository: dades remotes (TanStack Query + core/api)
    __tests__/
  core/
    api/                httpClient (únic accés HTTP, errors { error: { code, message } }) i queryClient
    config/env.ts       Variables EXPO_PUBLIC_*
    i18n/               i18next: ca (per defecte), es, en; claus tipades
    providers/          AppProviders (SafeArea, React Query, i18n)
    theme/tokens.ts     Tokens del design system (colors, espaiats, radis, mides)
  shared/ui/            Components de presentació reutilitzables
  test-utils/           Ajudes per als tests (createQueryWrapper)
```

Els tipus de domini (`PuntObservacio`, `Esdeveniment`, `IndexVisibilitat`…) no es defineixen a l'app: vénen de [`@talaia/shared`](../../packages/shared/README.md), sempre amb `import type`.

## Regles

- **MVVM:** cap pantalla ni ViewModel crida `fetch`; només els Repository, a través de `core/api`.
- **i18n:** cap text a les pantalles; tot via `t('…')`. Una clau nova va als tres fitxers de `core/i18n/locales/` (hi ha un test que ho comprova).
- **Tokens:** cap color, mida ni espaiat a mà; tot de `core/theme/tokens.ts`.
- Rutes en català (`/punt/[id]`, `/calendari`) i identificadors de codi en anglès.

## Mòdul de referència: `features/apiStatus`

L'indicador d'estat de l'API (a la pantalla de Perfil) és el patró que cal copiar. Fa el camí sencer fins a l'API real:

```
ApiStatusCard.tsx  →  useApiStatusViewModel.ts  →  apiStatusRepository.ts  →  core/api/httpClient  →  GET /api/v1/health
     View                  ViewModel                   Model/Repository           únic accés HTTP
```

| Capa | Fitxer | Què hi va | Què no hi va |
|---|---|---|---|
| View | `ApiStatusCard.tsx` | JSX, estils amb tokens, `onPress={vm.accio}` | `t()`, `useQuery`, decisions |
| ViewModel | `useApiStatusViewModel.ts` | L'estat que pinta la View (`loading`/`ok`/`error`), textos amb `t()`, accions (`retry`) | `fetch`, rutes de l'API, colors |
| Repository | `apiStatusRepository.ts` | La ruta de l'API, el tipus de `@talaia/shared`, `useQuery` i les seves claus | Textos, estat de pantalla |
| Tests | `__tests__/` | Repository i ViewModel amb `apiGet` simulat i `createQueryWrapper()` | Crides reals a l'API |

## Afegir una pantalla nova

Per a una feature `xxx` (identificadors en anglès) amb ruta `/ruta-en-catala`:

1. **Tipus.** Si la resposta és un tipus de domini, és (o s'afegeix) a `packages/shared`: `import type { Esdeveniment } from '@talaia/shared'`.
2. **Repository** `src/features/xxx/xxxRepository.ts`: `fetchXxx()` crida `apiGet<T>('/recurs')` i `useXxxQuery()` l'embolica amb `useQuery` i una clau pròpia (`['recurs', filtres]`). És l'únic fitxer de la feature que coneix l'API.
3. **ViewModel** `useXxxViewModel.ts`: crida el hook del Repository i retorna el que la View pinta: textos ja traduïts, dades ja formatades, l'estat (`loading`/`ok`/`error`) i les accions.
4. **View** `XxxScreen.tsx`: `const vm = useXxxViewModel();` i només JSX. Esquelet amb `Screen` (`shared/ui`); colors, mides i espaiats de `core/theme/tokens`.
5. **Ruta** a `src/app/` (o a `src/app/(tabs)/` si és una pestanya): un fitxer prim que només retorna `<XxxScreen />`. Amb paràmetres, mira `src/app/punt/[id].tsx`.
6. **Textos**: les claus noves als tres fitxers de `core/i18n/locales/` (ca, es, en). Són tipades: una clau inexistent no compila, i un test comprova que els tres idiomes tenen les mateixes.
7. **Tests** a `src/features/xxx/__tests__/`: copia els d'`apiStatus`. Només se simula `apiGet` (`jest.mock('@/core/api/httpClient', …)`) i el proveïdor de consultes és `createQueryWrapper()`.
8. Abans de la PR, des de l'arrel: `npm run lint && npm run typecheck && npm test`.
