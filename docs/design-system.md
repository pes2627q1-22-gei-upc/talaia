# Design system (marca Talaia)

Font de veritat visual: els mockups de **Figma** (16 pantalles). Aquest document recull els tokens i els components base, implementats a TG-113 a `apps/mobile/src/core/theme/tokens.ts` i `apps/mobile/src/shared/ui/`. Tema **fosc** per defecte: és una app que s'usa de nit.

## Colors

| Token | Hex | Ús |
|---|---|---|
| `nit` | `#0E1433` | Fons principal |
| `card` | `#141B42` | Targetes |
| `sheet` | `#161D45` | Fulls inferiors (bottom sheets), botó secundari |
| `vel` | `#1E2657` | Etiquetes i targeta seleccionada |
| `crep` | `#28316B` | Superfícies elevades, estats actius, esquelets |
| `linia` | `#26306A` | Separadors i vores |
| `vora` | `#333D7A` | Vora del que es pot prémer (botó secundari, targeta seleccionada) |
| `lluna` | `#EEF0F7` | Text principal |
| `boira` | `#9AA3C7` | Text secundari |
| `far` | `#FFB547` | Accent principal (CTA, destacats) |
| `ras` | `#5FD4C4` | Índex bo / cel ras |
| `tap` | `#E0708A` | Índex dolent / cel tapat, errors |
| `jus` | `#E3C58F` | Índex regular |
| `pedra` | `#D9C4A0` | Accent càlid secundari |

`vel` i `vora` surten del Figma (TG-113): `vora` unifica tres vores gairebé iguals (`#2E3875`, `#333D7A`, `#36408A`).

**Degradats** (`gradients` a `tokens.ts`): `cel`, el fons de la benvinguda, de `#0B1030` a `#17205A` (58 %) i `#2F3680`, amb `expo-linear-gradient`. Els seus colors només existeixen dins del degradat.

Escala de l'índex de visibilitat: `tap` (0–39) → `jus` (40–69) → `ras` (70–100). *Llindars a confirmar amb la fórmula v1 (TG-98).* L'app no els calcula: la franja arriba de l'API (`IndexVisibilitat.franja`) i és el nom del token de color.

## Tipografia

- **Big Shoulders Display** — titulars, xifres de l'índex, marca.
- **Atkinson Hyperlegible Next** — text de lectura, botons, etiquetes (llegibilitat de nit i accessibilitat).

Es carreguen amb `@expo-google-fonts` al layout arrel. Cada pes és una família (`fonts` a `tokens.ts`): no s'escriu `fontWeight`. Les pantalles fan servir `<AppText variant="…" color="…">`.

| Variant | Font | Mida / interlineat | Ús (Figma) |
|---|---|---|---|
| `indexLg` | Big Shoulders 800 | 66 / 62 | Xifra de l'índex al detall del punt |
| `indexMd` | Big Shoulders 800 | 40 / 38 | Xifra de l'índex a les llistes |
| `display` | Big Shoulders 800 | 38 / 40 | Títol de pantalla («Calendari») |
| `title` | Atkinson 700 | 22 / 28 | «On i quan mirar el cel.» |
| `heading` | Atkinson 700 | 17 / 22 | Capçalera de secció |
| `body` | Atkinson 400 | 16 / 23 | Text de lectura |
| `label` | Atkinson 700 | 16 / 20 | Botons, nom d'un punt |
| `small` | Atkinson 400 | 14 / 20 | Text secundari |
| `chip` | Atkinson 600 | 14 / 18 | Xips de filtre |
| `link` | Atkinson 700 | 13 / 17 | Enllaços («Veure'ls tots») |
| `caption` | Atkinson 400 | 12 / 17 | Notes petites |
| `tag` | Atkinson 700 | 12 / 16 | Etiquetes |
| `overline` | Atkinson 800 | 10,5 / 14, majúscules | Franja sota la xifra («CEL RAS») |

Espaiats (`spacing`): 4 · 8 · 12 · 16 · 20 · 24 · 32. Radis (`radii`): 10 (etiquetes) · 16 (botons, targetes) · 20 (targeta de l'índex) · píndola. Mides fixes (`sizes`): botó 54, xip 34, tacte mínim 44, icona 22.

## Components base (TG-113)

A `apps/mobile/src/shared/ui/`. Cap pantalla torna a definir un botó, una targeta o un xip.

| Component | Què és |
|---|---|
| `AppText` | Text amb una variant tipogràfica i un color de token |
| `PressableScale` | Base de tot el que es pot prémer: s'encongeix a 0,97 i accepta `haptic` |
| `Button` | `primary` (`far`, una per pantalla) · `secondary` (`sheet` + `vora`) · `light` (`lluna`, «Continua amb Google») · `text` (enllaç `far`). Icona opcional |
| `Card` | Targeta `card` + `linia`; amb `selected`, `vel` + `vora`; amb `onPress`, es pot prémer |
| `Chip` | Xip de filtre de 34 d'alçada (seleccionat: `far`), amb `hitSlop` fins a 44 |
| `IndexIndicator` | Xifra de l'índex amb el color de la franja; `md` hi afegeix la franja a sota, `lg` és només la xifra |
| `Skeleton` | Esquelet de càrrega que batega en opacitat |
| `StateMessage` | Estat buit o d'error, amb acció opcional |
| `Screen` | Esquelet de pantalla: fons, títol `display` i subtítol |

L'índex, al Figma, és només la xifra amb el color de la franja i l'etiqueta: ni anell ni barra. L'anell és dels marcadors del mapa (capa de MapLibre, TG-90) i les barres, del desglossament per factors (TG-105).

Encara no hi són: el full inferior (TG-90, amb el gest), les etiquetes i la llegenda del mapa (TG-89/TG-90/TG-102) i les icones de Talaia (`Button` ja accepta `icon`). La barra de pestanyes és la nativa (`NativeTabs`) amb els colors del tema.

## Moviment i fluïdesa

L'app ha de ser molt estètica i anar sempre fluida: és part del producte, no un acabat final. Tota pantalla nova passa aquestes regles abans de la PR.

**Tokens de moviment** (`motion` a `core/theme/tokens.ts`; són valors inicials i s'ajusten al dispositiu):

| Token | Valor | Ús |
|---|---|---|
| `motion.fast` | 150 ms | Resposta al tacte, canvis de color o d'estat petits |
| `motion.base` | 250 ms | Aparèixer i desaparèixer elements, canvi de càrrega a contingut |
| `motion.slow` | 400 ms | Fulls inferiors, transicions pròpies entre vistes |
| `motion.spring` | `damping` 18 · `stiffness` 180 | El que l'usuari arrossega o el que «arriba» (full inferior, targetes) |
| `motion.stagger` | 40 ms | Retard entre elements que entren en cascada (contingut de la benvinguda) |
| `motion.leave` | 320 ms | Sortida d'una pantalla amb coreografia abans de navegar (benvinguda) |
| `motion.ease` | `expoOut` · `power2Out` · `backOut` · `sineInOut` | Corbes de GSAP com a Bézier de Reanimated, per a les coreografies |

Corbes: en entrar, desacceleració (`Easing.out(Easing.cubic)`); en sortir, acceleració (`Easing.in(Easing.cubic)`). Mai lineal.

**Regles**

1. **Reanimated** (ja instal·lat) per a tota animació: corre al fil de la interfície. Res d'`Animated` de React Native ni de `setState` a cada fotograma.
2. S'animen només `transform` i `opacity`. Animar mides o posicions (`width`, `height`, `top`…) obliga a recalcular el disseny i talla.
3. **Resposta immediata al tacte:** tot element que es pot prémer s'encongeix lleugerament (≈ 0,97) amb `motion.fast`. A les accions clau (desar un pla, activar una alerta, triar un punt al mapa), vibració lleu (`haptic` de `PressableScale` i `Button`, amb `expo-haptics`).
4. **Càrregues sense salts:** un esquelet amb la forma del contingut, que ocupa el mateix espai, i fosa de `motion.base` quan arriben les dades. No hi ha spinners a pantalla completa ni textos «Carregant…».
5. **Mai una pantalla buida si ja hi havia dades:** TanStack Query ensenya les de la memòria cau mentre refresca.
6. Les llistes que poden créixer van virtualitzades (`FlatList`), mai amb un `map` dins d'un `ScrollView`.
7. Res de càlcul pesat mentre s'anima: les dades arriben preparades del ViewModel (`useMemo`), no es transformen a la View.
8. Es respecta l'opció del sistema de reduir el moviment (`useReducedMotion` de Reanimated): les animacions es converteixen en fosos curts.
9. **Objectiu: 60 fps.** Es comprova al dispositiu, amb Expo Go en mode de producció (`npx expo start --no-dev --minify`). El mode de desenvolupament va més lent i no serveix per jutjar-ho. El mapa és un WebView (ADR-0015): mira-hi els fps en un Android de gamma mitjana, i sense el mode d'estalvi d'energia.

## Il·lustracions

Es fan servir els SVG exportats del Figma tal com són, sense redibuixar-los, i es pinten amb `expo-image` (funciona a Expo Go). La benvinguda (TG-82) és a `apps/mobile/assets/images/welcome/`: resplendor, estels fugaços, turó, logotip, la icona del correu i, a `torre/`, els vectors de la torre per separat (cos, muralla, merlet, finestra i estel) perquè es puguin animar. Els 42 estels surten de l'export del Figma com a dades (`features/auth/stars.ts`): cadascun és un punt `lluna` amb la seva posició, mida i opacitat. Les capes es col·loquen amb les coordenades del frame de 393 d'amplada. En pantalles baixes la il·lustració s'encongeix perquè la torre no quedi tallada (`illustrationScale`, amb test).

### La benvinguda: coreografia

La pantalla d'accés és l'única amb una coreografia pròpia, perquè es veu poques vegades i és la primera impressió de la marca. Funciona com una línia de temps de GSAP (`TIMELINE` a `features/auth/WelcomeIllustration.tsx`), però amb Reanimated al fil de la interfície:

| t | Què passa |
|---|---|
| 0–0,9 s | Els 42 estels del Figma s'encenen un a un (`power2Out`) |
| 0,1 s | El resplendor floreix darrere la torre (`expoOut`) |
| 0,15 s | El turó puja |
| 0,25 s | La torre s'alça de darrere el turó (`expoOut`, 0,9 s) |
| 0,65 s | L'estel de la torre s'encén girant, amb un petit rebot (`backOut`), i el resplendor fa un pols |
| 0,8 s | La finestra s'il·lumina amb un parpelleig, com un fanal |
| 0,88 s | El contingut entra en cascada amb `motion.spring` |

Després continua viva: cada estel parpelleja al seu ritme, l'estel de la torre respira i es balanceja, el resplendor batega i cada 6 s passa un estel fugaç. En triar una opció, el contingut baixa i s'esvaeix, el cel s'apropa i l'estel fa un esclat durant `motion.leave`; després l'app entra amb una fosa. Amb «reduir moviment» tot és quiet i la sortida és una fosa curta.

## Mapa

Estil nocturn propi sobre les tessel·les vectorials de l'ICGC, recolorit amb aquesta paleta (aigua i terreny en blaus `nit`/`crep`, etiquetes `boira`). Atribució ICGC + OpenStreetMap obligatòria. Implementat a `apps/mobile/src/features/map/style/nightStyle.ts` (TG-89): terra `card`, aigua `nit`, vegetació `sheet`, carreteres `linia` (les principals `crep`), edificis `crep`, etiquetes `lluna`/`boira` sobre halo `nit`, terreny 3D amb ombrejat i cel de nit amb boira a l'horitzó (cel `nit`, horitzó `crep`, boira `card`; [ADR-0015](decisions/0015-mapa-dom-component.md)).

## Regles

- Cap color, mida de font o espaiat escrit a mà a les pantalles: sempre des dels tokens del tema.
- Contrast mínim WCAG AA per al text.
- Tots els textos visibles passen per i18n.
