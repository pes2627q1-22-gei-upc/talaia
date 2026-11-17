# ADR-0032: Mode nit vermell sobre negre amb un tema de tokens, un filtre al mapa i la brillantor baixa

**Estat:** Proposada · **Data:** 2026-11-16 · TG-238 (HU45)

## Context

La HU45 demana un mode nit: quan l'usuari observa, tota l'app (també el mapa) ha de fer servir només vermells foscos sobre negre, i la brillantor de la pantalla ha de baixar. La llum vermella és la que menys trenca l'adaptació de l'ull a la foscor. El blau i el verd la trenquen en pocs segons.

Avui l'app no té cap tema que es pugui canviar:

- **Colors.** Els colors són constants de mòdul (`colors`, `gradients` i `pointMapColors` de `core/theme/tokens.ts`). Els fan servir 38 fitxers en 190 llocs, sobretot dins de `StyleSheet.create` en carregar el mòdul.
- **Mapa.** És una DOM component (ADR-0015). L'estil és una còpia de l'estil fosc de l'ICGC, amb centenars de colors dins d'expressions, i els colors propis li arriben com a props (`MarkerPalette` i `MapChrome`).
- **Finestres natives.** Hi ha pantalles que es presenten en una finestra nativa a part: el `Modal` del `Sheet` i la pantalla `fullScreenModal` de `_layout.tsx`.

Opcions per als colors de l'app:

- **A.** Un tema de tokens: una segona paleta amb les mateixes claus, que les pantalles llegeixen d'un context.
- **B.** Una capa per sobre de tota l'app que ho tenyeixi de vermell (`mixBlendMode`, que té RN 0.88), sense tocar les pantalles.

Opcions per al mapa:

- **C.** Un filtre CSS al contenidor del mapa, dins de la DOM component.
- **D.** Un segon estil de MapLibre en vermell.

## Decisió

Opcions **A** per a l'app i **C** per al mapa. La brillantor baixa amb `expo-brightness`.

### Paleta `vermell`

Hi ha una segona paleta amb les mateixes claus que `colors`. Les regles són aquestes:

- **Només el canal vermell:** a cada color, el verd i el blau són `00` (`#RR0000`, amb transparència o sense).
- **Contrast del text:** el text és ≥ 4,5:1 sobre totes les superfícies.
- **Contrast de la resta:** els accents, les franges i les categories són ≥ 3:1 sobre totes les superfícies, perquè també fan de vora o de punt sobre targetes i fulls.
- **Comprovació:** un test de la paleta comprova les tres regles.

Amb només el vermell, el contrast màxim sobre el negre és 5,25:1. Per això el text principal i el secundari surten gairebé iguals, i la jerarquia la fan la mida i el pes.

| Token | `normal` | `vermell` | Notes |
|---|---|---|---|
| `nit` | `#0E1433` | `#000000` | Fons |
| `card` | `#141B42` | `#0F0000` | |
| `sheet` | `#161D45` | `#120000` | |
| `vel` | `#1E2657` | `#170000` | |
| `crep` | `#28316B` | `#1C0000` | |
| `linia` | `#26306A` | `#2E0000` | Separadors |
| `vora` | `#333D7A` | `#5A0000` | |
| `lluna` | `#EEF0F7` | `#FF0000` | 5,0–5,25:1 |
| `boira` | `#9AA3C7` | `#F20000` | ≥ 4,5:1 fins a `crep` |
| `far` | `#FFB547` | `#FF0000` | El text sobre `far` és `nit` (5,25:1) |
| `ras` · `jus` · `tap` | | `#FF0000` · `#DC0000` · `#BE0000` | ≥ 3:1 fins a `crep` (`tap`, 3,04:1). Només una pista: la franja la diuen el número i el text |
| `ubicacio` | `#4B9FFF` | `#FF0000` | |
| `fenomen*`, `pedra` | | `#C80000` | ≥ 3:1 fins a `crep`. Les categories del calendari les diu el text |

Els degradats i `pointMapColors` també tenen la seva versió vermella. A la TG-239 es poden ajustar els valors, sempre dins de les regles: el test és qui mana.

### Com s'aplica a l'app

- **Tema i context:**
  - `core/theme` exporta les dues paletes;
  - un `ThemeProvider` a `_layout.tsx` dona el tema actual a tot l'arbre;
  - `useTheme()` el retorna (`{ name, colors, gradients, pointMapColors }`).

  El context també arriba a les pantalles i als `Modal` que es presenten en una finestra nativa, perquè continuen sent fills de l'arbre de React.
- **Estils:** `makeStyles((t) => StyleSheet.create({ … }))` en lloc d'un `StyleSheet.create` amb `colors` en carregar el mòdul. Crea els estils un sol cop per tema, quan cal, i el component els llegeix amb el hook que retorna.
- **El que no són colors** (espaiats, radis, mides, tipografia i moviment) continua sent constant: el mode nit no hi toca.
- **Fitxers sense React:** el codi que fa servir colors fora d'un component (`nightStyle`, `MarkerPalette`, `MapChrome`) rep la paleta com a paràmetre.
- **Barra d'estat:** en mode nit s'amaga (`<StatusBar hidden />`). L'hora i la bateria de l'iOS sempre surten en blanc, i no es poden tenyir.
- **Barrera:** a la TG-239, quan s'acabi de migrar, una regla `no-restricted-imports` d'ESLint no deixarà importar `colors`, `gradients` ni `pointMapColors` fora de `core/theme`. Així, el codi nou no se salta el tema.

### Mapa

La DOM component rep el nom del tema. En mode nit, posa al contenidor del mapa `filter: grayscale(1)` i, a sobre, una capa `mix-blend-mode: multiply` de color `#FF0000` que no rep tocs.

El resultat és la lluminositat de cada píxel només al canal vermell. Hi entren tot el que pinta MapLibre (les tessel·les de l'ICGC, el relleu, els marcadors i els clústers) i els controls.

L'estil i els marcadors no canvien. L'estil de l'ICGC tampoc no s'ha de tornar a fer cada vegada que se n'actualitza la còpia.

### Brillantor

En entrar al mode nit, es desa la brillantor actual (`getBrightnessAsync`) i es posa a un valor baix: una constant, de primer 0,1.

Es torna a posar l'anterior:
- en sortir del mode;
- quan l'app passa a segon pla.

En tornar a primer pla, si encara és de nit, es torna a baixar.

A iOS, `setBrightnessAsync` canvia la brillantor de tota la pantalla, no només la de l'app, i no la desfà en sortir. Per això es restaura a mà. Només es baixa en entrar al mode o en tornar a l'app. Si l'usuari la torna a pujar des del Centre de control, no se li torna a baixar.

### Estat del mode

`auto` és el que hi ha per defecte. L'activació automàtica és cosa de la TG-240.

Una tria a mà (activar o desactivar) es desa a AsyncStorage amb la seva caducitat: les 06:00 següents, la mateixa hora en què l'app canvia de nit (`NIGHT_ENDS_AT`). Si es tria a la 01:00, caduca cinc hores després, no l'endemà. Així, «la seva tria mana fins a la nit següent».

El `ThemeProvider` decideix el tema a partir d'aquest estat.

### Per què així

- **Per què no B, la capa per sobre:**
  - una capa a l'arrel no cobreix el que es presenta en una altra finestra nativa (el `Sheet` i el `fullScreenModal`);
  - no garanteix el contrast: el `boira` sobre `card` quedaria a uns 2:1;
  - depèn de com cada plataforma compon el `mixBlendMode`.

  Amb els tokens, el mode nit és tan provable com la resta del design system.
- **Per què no D, un estil de MapLibre en vermell:** caldria recolorir centenars d'expressions de l'estil de l'ICGC i tornar-ho a fer a cada actualització. El filtre és un sol lloc i garanteix que no surti res que no sigui vermell.

## Conseqüències

- **La TG-239 toca pantalles de tot l'equip** (els 38 fitxers): el canvi és mecànic, de `styles` a `useStyles()` i de `colors` a `useTheme().colors`. Cal avisar abans de començar, perquè les PR obertes que toquin pantalles tindran conflictes petits. Les pantalles noves ja s'han de fer amb `makeStyles`.
- **Proves:**
  - el test de la paleta (només vermell i contrastos);
  - un test que canvia el tema i comprova que una pantalla en pinta els colors;
  - al dispositiu, que el mapa amb el filtre es mou amb fluïdesa. Si no, l'alternativa és un `feColorMatrix` en SVG o, en última instància, la D.
- **Franges i categories:** al mode nit, la franja de l'índex i les categories del calendari no es distingeixen pel color. A totes les pantalles que les ensenyen hi ha d'haver el número o el text: la TG-239 ho comprova pantalla per pantalla.
- **El que no s'acoloreix:**
  - els diàlegs del sistema (`Alert.alert`, permisos, el full de compartir) i el teclat no es poden tenyir; ja són foscos (`userInterfaceStyle: "dark"`);
  - les imatges de la benvinguda tampoc, però no es veuen amb la sessió iniciada.
- **Dependència nova:** `expo-brightness` (és a Expo Go).
- **`docs/design-system.md`** tindrà la taula de la paleta `vermell` quan s'implementi (TG-239).
