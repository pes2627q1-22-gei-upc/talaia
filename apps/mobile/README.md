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

## Fitxa del punt (TG-93)

`features/point/pointRepository.ts` consumeix `GET /api/v1/punts/{id}` amb el contracte compartit `PuntFitxa`. Mostra les dades del punt, l'índex actual, les properes hores i l'SQM si estan disponibles; els valors absents no es substitueixen per zero. L'SQM es classifica amb els [llindars de qualitat del cel nocturn de la Generalitat](https://mediambient.gencat.cat/web/.content/home/ambits_dactuacio/atmosfera/contaminacio_luminica/Avaluacio_de_la_qualitat_del_cel_de_nit/campanya-2024.pdf) i s'explica com a valor de referència del lloc, no com a previsió de la nit. Les hores UTC es presenten en `Europe/Madrid`. La millor finestra és una agrupació de presentació de les hores consecutives de la franja màxima, no un camp de l'API. El refresc es programa després de la publicació horària del worker (minut 5 UTC). Un 400 o 404 mostra el punt com a inexistent; els errors de xarxa permeten reintentar. Les dades fictícies només són als tests de `features/point/__fixtures__`.

El mapa de situació és estàtic i mostra l'atribució. «Com arribar» obre Google Maps amb les coordenades; «Crea un pla» mostra un avís fins que existeixi aquest flux. El desglossament dels factors de l'índex correspon a TG-105. Proves específiques: `npm test -w apps/mobile -- --runInBand src/features/point`.

## Sessió (TG-83)

`AppProviders` munta un únic `AuthProvider`. `useAuthViewModel` exposa l'usuari
(identificador i correu), l'estat de restauració, els errors traduïts i les accions
`restore` i `signOut`. Els tokens queden dins del client de Supabase, accessible
als repositories mitjançant `core/auth/supabase.ts`.

El client restaura i renova la sessió amb Supabase Auth. A iOS i Android, desa
la sessió completa a Expo SecureStore; els errors del magatzem es propaguen,
incloent-hi el rebuig de valors massa grans. Al web només es desa en memòria:
recarregar la previsualització tanca la sessió. La renovació automàtica nativa
s'activa amb l'app en primer pla i s'atura quan passa a segon pla.

El perfil ofereix el logout quan hi ha sessió. Es fa servir `scope: 'local'`
per tancar la sessió d'aquest dispositiu. Si falla sense eliminar la sessió,
es mostra un error i es pot reintentar. Si Supabase ja ha notificat `SIGNED_OUT`,
es respecta el tancament local encara que falli la revocació remota. Els canvis
d'usuari i el logout buiden la memòria cau de React Query.

Configura `EXPO_PUBLIC_SUPABASE_URL` i `EXPO_PUBLIC_SUPABASE_ANON_KEY` al `.env`
de l'app. Sense aquestes variables, l'app continua en mode anònim. Mai no hi
posis la clau `service_role`.

TG-81 aporta la configuració de Google OAuth a Supabase. Aquesta implementació
es limita a la gestió de sessió: **els botons de la benvinguda encara no inicien
sessió real**, i no s'hi afegeix cap barrera d'accés. Quan s'implementi el login,
el seu repository ha d'utilitzar el mateix client; `onAuthStateChange`
actualitzarà automàticament el ViewModel.

El punt d'entrada per al repository del futur login és:

```ts
import { getAuthClient } from '@/core/auth/supabase';

const supabase = getAuthClient();
if (!supabase) throw new Error('Supabase Auth no està configurat');
// Fer servir supabase.auth.* per iniciar sessió o completar el callback OAuth.
// No crear un altre client ni desar els tokens manualment.
```

`AuthProvider` ja està muntat globalment i escolta els canvis de sessió a través
del repository. El login només ha de completar l'autenticació amb aquest client:
la sessió es persistirà i el ViewModel rebrà l'usuari automàticament.

### Contracte amb les tasques que consumeixen la sessió

- Els repositories fan servir `apiGet` o `apiPost` de `core/api/httpClient`.
  El client consulta `getSession()` abans de cada petició i hi afegeix el token
  vigent com a `Authorization: Bearer …`. Sense sessió, no envia autorització.
  Els errors de restauració/renovació es propaguen abans de fer la petició.
  Es conserven les capçaleres addicionals i el senyal de cancel·lació, però no
  una autorització antiga proporcionada pel caller. Es rebutgen URLs d'altres orígens.
- TG-84 espera aquest format Bearer. El contracte confirmat pel sprint master
  és `POST /api/v1/perfil`, idempotent: el futur flux de login cridarà
  `apiPost('/perfil')` després d'autenticar-se. La crida i la gestió dels
  seus errors corresponen a la nova tasca de login; TG-83 deixa preparat el transport.
- TG-85 pot provar la sessió mitjançant `AuthProvider` sota `QueryClientProvider`;
  les proves existents simulen el repository i no necessiten credencials.
- Les consultes de dades privades han d'esperar que `loading` sigui `false` i
  `isAuthenticated` sigui `true`, i incloure l'identificador d'usuari a la clau
  de React Query. Un canvi de compte buida la memòria cau; renovar el mateix
  compte no la buida.

**Pendent abans de donar HU35 per acabada:** connectar el login real, executar
la creació/recuperació del perfil i validar el flux en dispositiu contra l'API.
L'abast de TG-83 confirmat pel sprint master és restauració i persistència
segura de la sessió, logout i JWT a l'API. El login real de Google, Apple i
correu i la crida de creació del perfil es faran en una tasca nova de la Martina.
El sprint master actualitzarà l'assignació anterior de l'ADR-0016.

Validació pendent en dispositiu, quan hi hagi el login connectat: iniciar sessió,
tancar i reobrir l'app, passar-la a segon pla i tornar-hi després de caducar el
token, fer logout des del perfil i verificar que no es restaura en reobrir.
Les proves unitàries cobreixen restauració, canvis de compte, errors,
restauracions obsoletes i persistència amb el magatzem simulat.

Referències: [Supabase Auth per React Native](https://supabase.com/docs/guides/auth/quickstarts/react-native)
i [Expo SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/).

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
4. **View** `XxxScreen.tsx`: `const vm = useXxxViewModel();` i només JSX. Esquelet amb `Screen` i els components base de `shared/ui` (`AppText`, `Button`, `Card`, `Chip`, `IndexIndicator`…; taula a `docs/design-system.md`); colors, mides i espaiats de `core/theme/tokens`.
5. **Ruta** a `src/app/` (o a `src/app/(tabs)/` si és una pestanya): un fitxer prim que només retorna `<XxxScreen />`. Amb paràmetres, mira `src/app/punt/[id].tsx`.
6. **Textos**: les claus noves als tres fitxers de `core/i18n/locales/` (ca, es, en). Són tipades: una clau inexistent no compila, i un test comprova que els tres idiomes tenen les mateixes.
7. **Tests** a `src/features/xxx/__tests__/`: copia els d'`apiStatus`. Només se simula `apiGet` (`jest.mock('@/core/api/httpClient', …)`) i el proveïdor de consultes és `createQueryWrapper()`.
8. Abans de la PR, des de l'arrel: `npm run lint && npm run typecheck && npm test`.
