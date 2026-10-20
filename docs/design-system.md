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
| `indexLg` | Big Shoulders 800 | 66 / 76 | Xifra de l'índex al detall del punt |
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

Espaiats (`spacing`): 4 · 8 · 12 · 16 · 20 · 24 · 32. Radis (`radii`): 10 (etiquetes) · 14 (camps i controls de formulari) · 16 (botons, targetes) · 20 (targeta de l'índex) · píndola. Mides fixes (`sizes`): botó 54, xip 34, tacte mínim 44, icona 22.

## Components base (TG-113)

A `apps/mobile/src/shared/ui/`. Cap pantalla torna a definir un botó, una targeta o un xip.

| Component | Què és |
|---|---|
| `AppText` | Text amb una variant tipogràfica i un color de token |
| `PressableScale` | Base de tot el que es pot prémer: s'enfonsa a 0,96 i torna amb un spring; `haptic` (`true` o `'selection'`) |
| `Button` | `primary` (`far`, una per pantalla) · `secondary` (`sheet` + `vora`) · `light` (`lluna`, «Continua amb Google») · `text` (enllaç `far`). Icona opcional |
| `Card` | Targeta `card` + `linia`; amb `selected`, `vel` + `vora`; amb `onPress`, es pot prémer |
| `Chip` | Xip de filtre de 34 d'alçada (seleccionat: `far`), amb `hitSlop` fins a 44 |
| `IndexIndicator` | Xifra de l'índex amb el color de la franja; `md` hi afegeix la franja a sota, `lg` és només la xifra |
| `Skeleton` | Esquelet de càrrega que batega en opacitat |
| `StateMessage` | Estat buit o d'error, amb acció opcional |
| `TextField` | Camp de text (TG-249): etiqueta `small` `boira`, fons `sheet`, vora `vora` (`far` amb el focus, `tap` amb error), radi de formulari i 54 d'alçada. L'error surt a sota com a alerta |
| `Screen` | Esquelet de pantalla: fons, títol `display` i subtítol; el primer cop que es munta, entra amb una fosa i 6 pt |
| `SegmentedControl` | Control segmentat (TG-101): la peça triada (`crep`) llisca darrere el text sense rebot; cada opció és una pestanya accessible. `onReselect` avisa si es torna a tocar la triada |
| `MonthCalendar` | Calendari mensual a l'estil de l'inline d'iOS (TG-101): fletxes `far`, avui en `far`, el dia triat dins un cercle `far` que apareix amb una molla i els dies fora de rang apagats. Es canvia de mes lliscant o amb les fletxes; la setmana comença en dilluns (ca, es) o en diumenge (en) |
| `WheelPicker` | Roda a l'estil de l'alarma d'iOS (TG-101): les files giren en cilindre (`rotateX` i opacitat al fil de la interfície), banda `crep`, vores que s'esvaeixen, un tic de vibració a cada fila i dona la volta. Diverses rodes poden compartir una sola banda (`band={false}`) |
| `Slider` | Barra lliscant (TG-101): pista `crep`, valor `far` i control `lluna`. Segueix el dit al fil de la interfície, avança per passos amb un tic de vibració a cada pas i s'hi ajusta en deixar-la; amb un lector de pantalla, puja i baixa un pas |
| `Sheet` | Full inferior (TG-101): puja sobre un fons `nit` enfosquit i es tanca tocant fora, amb el botó enrere d'Android o amb el gest d'escapament de VoiceOver. Amb «reduir moviment», només una fosa |

L'índex, al Figma, és només la xifra amb el color de la franja i l'etiqueta: ni anell ni barra. L'anell és dels marcadors del mapa (capa de MapLibre, TG-90) i les barres, del desglossament per factors (TG-105).

Encara no hi són: el gest d'arrossegar el full inferior (TG-102), les etiquetes i la llegenda del mapa (TG-89/TG-90/TG-102) i les icones de Talaia (`Button` ja accepta `icon`). La barra de pestanyes és la nativa (`NativeTabs`), amb quatre pestanyes (Explora, Calendari, Alertes i Perfil) i l'activa en `far`.

## Moviment i fluïdesa

L'app ha de ser molt estètica i anar sempre fluida: és part del producte, no un acabat final. Tota pantalla nova passa aquestes regles abans de la PR.

**Tokens de moviment** (`motion` a `core/theme/tokens.ts`; són valors inicials i s'ajusten al dispositiu):

| Token | Valor | Ús |
|---|---|---|
| `motion.fast` | 150 ms | Resposta al tacte, canvis de color o d'estat petits |
| `motion.base` | 250 ms | Aparèixer i desaparèixer elements, canvi de càrrega a contingut |
| `motion.slow` | 400 ms | Fulls inferiors, transicions pròpies entre vistes |
| `motion.spring` | `damping` 18 · `stiffness` 180 | El que l'usuari arrossega o el que «arriba» (full inferior, targetes) |
| `motion.press` | 0,96 en 90 ms · spring `damping` 19, `stiffness` 320, `mass` 0,6 | Prémer: s'enfonsa de seguida i torna amb un rebot mínim |
| `motion.stagger` | 40 ms | Retard entre elements que entren en cascada (llistes, targetes, contingut de la benvinguda) |
| `motion.leave` | 720 ms | Sortida d'una pantalla amb coreografia abans de navegar (el salt de la benvinguda) |

Corbes: en entrar, desacceleració (`Easing.out(Easing.cubic)`); en sortir, acceleració (`Easing.in(Easing.cubic)`). Mai lineal.

**Regles**

1. **Reanimated** (ja instal·lat) per a tota animació: corre al fil de la interfície. Res d'`Animated` de React Native ni de `setState` a cada fotograma.
2. S'animen només `transform` i `opacity`. Animar mides o posicions (`width`, `height`, `top`…) obliga a recalcular el disseny i talla.
3. **Resposta immediata al tacte:** tot element que es pot prémer s'enfonsa a 0,96 en 90 ms i torna amb un spring que s'assenta amb un rebot mínim (`motion.press`). A les accions clau (desar un pla, activar una alerta, triar un punt al mapa), un cop de vibració lleu (`haptic`); als xips i controls de selecció, el tic de selecció (`haptic="selection"`, ja ho fa `Chip`).
4. **Moure's entre pantalles:** la pila fa el lliscament d'iOS a les dues plataformes i, a iOS, es torna enrere lliscant des de qualsevol punt (`core/navigation/transitions.ts`). Les pestanyes canvien a l'instant, sense animació: es fan servir desenes de vegades al dia i animar-les les faria lentes. El contingut d'una pantalla entra amb una fosa curta només el primer cop que es munta (`Screen`).
5. **Càrregues sense salts:** un esquelet amb la forma del contingut, que ocupa el mateix espai, i fosa de `motion.base` quan arriben les dades. No hi ha spinners a pantalla completa ni textos «Carregant…».
6. **Mai una pantalla buida si ja hi havia dades:** TanStack Query ensenya les de la memòria cau mentre refresca.
7. Les llistes que poden créixer van virtualitzades (`FlatList`), mai amb un `map` dins d'un `ScrollView`.
8. Res de càlcul pesat mentre s'anima: les dades arriben preparades del ViewModel (`useMemo`), no es transformen a la View.
9. Es respecta l'opció del sistema de reduir el moviment (`useReducedMotion` de Reanimated): les animacions es converteixen en fosos curts.
10. **Objectiu: 60 fps.** Es comprova al dispositiu, amb Expo Go en mode de producció (`npx expo start --no-dev --minify`). El mode de desenvolupament va més lent i no serveix per jutjar-ho. El mapa és un WebView (ADR-0015): mira-hi els fps en un Android de gamma mitjana, i sense el mode d'estalvi d'energia.

## Il·lustracions

Es fan servir els SVG exportats del Figma tal com són, sense redibuixar-los, i es pinten amb `expo-image` (funciona a Expo Go). La benvinguda (TG-82) és a `apps/mobile/assets/images/welcome/`: resplendor, turó, logotip, la icona del correu i, a `torre/`, els vectors de la torre per separat (cos, muralla, merlet, finestra i estel) perquè es puguin animar. Els 42 estels surten de l'export del Figma com a dades (`features/auth/stars.ts`): cadascun és un punt `lluna` amb la seva posició, mida i opacitat. Les capes es col·loquen amb les coordenades del frame de 393 d'amplada. En pantalles baixes la il·lustració s'encongeix perquè la torre no quedi tallada (`illustrationScale`, amb test).

### La benvinguda: coreografia

La pantalla d'accés és l'única amb una coreografia pròpia: és la primera impressió de la marca. És una línia de temps a l'estil de GSAP (`TL` a `features/auth/intro/timeline.ts`, amb les corbes `expoOut`, `power2Out`, `backOut` i `sineInOut`), però amb un sol rellotge de Reanimated al fil de la interfície. El cel és un shader de **Skia** (`@shopify/react-native-skia`, que va a Expo Go): degradat de la marca, Via Làctia amb pols i franges fosques, tres capes d'estels que parpellegen i el feix del far.

| t | Què passa |
|---|---|
| 0 s | Un sol estel batega on hi haurà l'estel de la torre (dues vibracions suaus) |
| 0,4 s | El cel s'obre: una ona que surt de la torre encén els estels (`power2Out`, 1,3 s) |
| 1 s | Apareix la Via Làctia (`sineInOut`, 1,4 s) |
| 1,5 s | Floreix el resplendor, puja el turó i la torre s'alça de darrere seu (`expoOut`, 0,9 s) |
| 2,05 s | L'estel de la torre s'encén girant (`backOut`) amb un esclat de lent (vibració mitjana) |
| 2,25 s | La finestra s'il·lumina amb un parpelleig, com un fanal |
| 2,5 s | El feix del far escombra el cel de dreta a esquerra (1,1 s) i aviva els estels per on passa |
| 3,15 s | El feix dibuixa Cassiopea, la «W» (un toc per cada estel que s'uneix) |
| 3,35 s | El logotip puja del seu marc i l'estel de la «i» fa una espurna (vibració lleu) |
| 3,55 s | El contingut entra en cascada, 60 ms entre elements |
| 4,5 s | Fi |

- **Modes** (`useIntro`): sencera el primer cop (es guarda a AsyncStorage, `talaia:intro-vista`), curta a partir de 3,15 s les altres vegades, i quieta i ja acabada amb «reduir moviment». Un toc al cel la salta (350 ms). Per veure-la sencera: `/benvinguda?intro=sencera`.
- **Després continua viva:** els estels parpellegen i es mouen amb el giroscopi (paral·laxi de ±14 px), l'estel de la torre respira, cada 5,2 s passa un estel fugaç i, si es toca el cel, en surt un des del dit.
- **Sortida** (`motion.leave`): salt a la velocitat de la llum cap a l'estel de la torre, amb raigs, el cel que s'hi apropa i un flaix; després l'app entra amb una fosa. Amb «reduir moviment», una fosa curta.

**El que hem après amb Skia i els worklets**

- Skia compila els pipelines de la GPU el primer cop que dibuixa una cosa, i això atura la imatge (~0,7 s al simulador). Per això el que surt més tard es dibuixa des del principi amb opacitat 1/255 (`WARM` a `SkyCanvas.tsx`) i la línia de temps espera 300 ms (`INTRO_LEAD`).
- Dins d'un worklet, cap funció fletxa que no capturi res: el React Compiler la treu fora del component (`_temp`), deixa de ser worklet i l'app peta al fil de la interfície. Cal fer-ne una funció de mòdul amb `'worklet'`.
- Res d'`usePathValue`: es torna a disparar a si mateix. Un camí fix es passa com a text SVG; un d'animat, amb `useDerivedValue` i `Skia.PathBuilder`.
- A Jest, Skia corre sobre CanvasKit (`@shopify/react-native-skia/jestEnv.js`): els shaders es compilen de debò als tests.

## Mapa

Estil nocturn propi sobre les tessel·les vectorials de l'ICGC, recolorit amb aquesta paleta (aigua i terreny en blaus `nit`/`crep`, etiquetes `boira`). Atribució ICGC + OpenStreetMap obligatòria. Implementat a `apps/mobile/src/features/map/style/nightStyle.ts` (TG-89): terra `card`, aigua `nit`, vegetació `sheet`, carreteres `linia` (les principals `crep`), edificis `crep`, etiquetes `lluna`/`boira` sobre halo `nit`, terreny 3D amb ombrejat i cel de nit amb boira a l'horitzó (cel `nit`, horitzó `crep`, boira `card`; [ADR-0015](decisions/0015-mapa-dom-component.md)).

## Regles

- Cap color, mida de font o espaiat escrit a mà a les pantalles: sempre des dels tokens del tema.
- Contrast mínim WCAG AA per al text.
- Tots els textos visibles passen per i18n.
