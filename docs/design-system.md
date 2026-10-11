# Design system (marca Talaia)

Font de veritat visual: els mockups de **Figma** (16 pantalles). Aquest document recull els tokens que l'app ha d'implementar a TG-113 (Joan). Tema **fosc** per defecte: és una app que s'usa de nit.

## Colors

| Token | Hex | Ús |
|---|---|---|
| `nit` | `#0E1433` | Fons principal |
| `card` | `#141B42` | Targetes |
| `sheet` | `#161D45` | Fulls inferiors (bottom sheets) |
| `crep` | `#28316B` | Superfícies elevades, estats actius |
| `linia` | `#26306A` | Separadors i vores |
| `lluna` | `#EEF0F7` | Text principal |
| `boira` | `#9AA3C7` | Text secundari |
| `far` | `#FFB547` | Accent principal (CTA, destacats) |
| `ras` | `#5FD4C4` | Índex bo / cel ras |
| `tap` | `#E0708A` | Índex dolent / cel tapat, errors |
| `jus` | `#E3C58F` | Índex regular |
| `pedra` | `#D9C4A0` | Accent càlid secundari |

Escala de l'índex de visibilitat: `tap` (0–39) → `jus` (40–69) → `ras` (70–100). *Llindars a confirmar amb la fórmula v1 (TG-98).*

## Tipografia

- **Big Shoulders Display** — titulars, xifres de l'índex, marca.
- **Atkinson Hyperlegible Next** — text de lectura, botons, etiquetes (llegibilitat de nit i accessibilitat).

## Components base (TG-113)

Botons (primari `far`, secundari, text), targetes de punt, xips de filtre (fenomen, tipus), indicador de l'índex (xifra + anell/barra amb l'escala de color), full inferior, barra de pestanyes, estats buits i d'error.

## Moviment i fluïdesa

L'app ha de ser molt estètica i anar sempre fluida: és part del producte, no un acabat final. Tota pantalla nova passa aquestes regles abans de la PR.

**Tokens de moviment** (s'implementen a `core/theme/tokens.ts` a TG-113; són valors inicials i s'ajusten al dispositiu):

| Token | Valor | Ús |
|---|---|---|
| `motion.fast` | 150 ms | Resposta al tacte, canvis de color o d'estat petits |
| `motion.base` | 250 ms | Aparèixer i desaparèixer elements, canvi de càrrega a contingut |
| `motion.slow` | 400 ms | Fulls inferiors, transicions pròpies entre vistes |
| `motion.spring` | `damping` 18 · `stiffness` 180 | El que l'usuari arrossega o el que «arriba» (full inferior, targetes) |

Corbes: en entrar, desacceleració (`Easing.out(Easing.cubic)`); en sortir, acceleració (`Easing.in(Easing.cubic)`). Mai lineal.

**Regles**

1. **Reanimated** (ja instal·lat) per a tota animació: corre al fil de la interfície. Res d'`Animated` de React Native ni de `setState` a cada fotograma.
2. S'animen només `transform` i `opacity`. Animar mides o posicions (`width`, `height`, `top`…) obliga a recalcular el disseny i talla.
3. **Resposta immediata al tacte:** tot element que es pot prémer s'encongeix lleugerament (≈ 0,97) amb `motion.fast`. A les accions clau (desar un pla, activar una alerta, triar un punt al mapa), vibració lleu (`expo-haptics`, s'afegeix a TG-113).
4. **Càrregues sense salts:** un esquelet amb la forma del contingut, que ocupa el mateix espai, i fosa de `motion.base` quan arriben les dades. No hi ha spinners a pantalla completa ni textos «Carregant…».
5. **Mai una pantalla buida si ja hi havia dades:** TanStack Query ensenya les de la memòria cau mentre refresca.
6. Les llistes que poden créixer van virtualitzades (`FlatList`), mai amb un `map` dins d'un `ScrollView`.
7. Res de càlcul pesat mentre s'anima: les dades arriben preparades del ViewModel (`useMemo`), no es transformen a la View.
8. Es respecta l'opció del sistema de reduir el moviment (`useReducedMotion` de Reanimated): les animacions es converteixen en fosos curts.
9. **Objectiu: 60 fps.** Es comprova al dispositiu, amb Expo Go en mode de producció (`npx expo start --no-dev --minify`). El mode de desenvolupament va més lent i no serveix per jutjar-ho. El mapa és un WebView (ADR-0015): mira-hi els fps en un Android de gamma mitjana, i sense el mode d'estalvi d'energia.

## Mapa

Estil nocturn propi sobre les tessel·les vectorials de l'ICGC, recolorit amb aquesta paleta (aigua i terreny en blaus `nit`/`crep`, etiquetes `boira`). Atribució ICGC + OpenStreetMap obligatòria. Implementat a `apps/mobile/src/features/map/style/nightStyle.ts` (TG-89): terra `card`, aigua `nit`, vegetació `sheet`, carreteres `linia` (les principals `crep`), edificis `crep`, etiquetes `lluna`/`boira` sobre halo `nit`, terreny 3D amb ombrejat i cel de nit amb boira a l'horitzó (cel `nit`, horitzó `crep`, boira `card`; [ADR-0015](decisions/0015-mapa-dom-component.md)).

## Regles

- Cap color, mida de font o espaiat escrit a mà a les pantalles: sempre des dels tokens del tema.
- Contrast mínim WCAG AA per al text.
- Tots els textos visibles passen per i18n.
