# Mesura dels requisits no funcionals (TG-182)

Primera mesura dels RNF de Taiga que tenen un mètode definit al Sprint 2 ([TEC] TG-117): RNF01 (mapa), RNF02 (API), RNF03 (qualitat) i RNF05 (accessibilitat). Els RNF i com es mesura cadascun són a [backlog.md](backlog.md#requisits-no-funcionals) i a Taiga. Aquesta mesura es repeteix al final del sprint, després de la `release/0.2.0` del 20/11: vegeu [Com repetir la mesura](#com-repetir-la-mesura).

## Resum

| RNF | Objectiu | Primera mesura (11/11/2026) | Resultat |
|---|---|---|---|
| [RNF01](https://tree.taiga.io/project/mohamed-dari-pes_22_c_talaia/us/122) · Mapa | En moure el mapa, punts de l'àrea visible en < 2 s (p95), en 4G | Cal el mòbil. Indicador: `/punts` (32 punts, 2,2 kB amb gzip) arriba en 54 ms (p50) | Pendent |
| [RNF02](https://tree.taiga.io/project/mohamed-dari-pes_22_c_talaia/us/123) · API | p95 < 500 ms amb 50 peticions concurrents | `/punts` 116–194 ms (una de les tres tandes, 1.253 ms) · `/recomanacions` 872–1.028 ms · `/esdeveniments` sense mesurar | **No compleix** |
| [RNF03](https://tree.taiga.io/project/mohamed-dari-pes_22_c_talaia/us/124) · Qualitat | Quality Gate en verd, ≥ 70 % de cobertura al codi nou, cap bug greu | Gate **Passed**, 93,2 % al codi nou, 0 bugs. Només analitza l'app | Compleix (l'app) |
| [RNF05](https://tree.taiga.io/project/mohamed-dari-pes_22_c_talaia/us/126) · Accessibilitat | Tacte ≥ 44 pt, contrast AA, tot etiquetat | Components base etiquetats i contrast AA; el botó `text`, dos enllaços i la barra lliscant no arriben a 44 pt; revisió amb VoiceOver i TalkBack pendent | **No compleix** |

## Entorn

- **Data:** 11/11/2026, de 20:06 a 20:14 (hora de Catalunya).
- **API:** la VM de la FIB ([desplegament.md](desplegament.md)): Nginx + API + worker. `GET /api/v1/health` respon `{"status":"ok","version":"0.1.0"}` (versió del paquet de l'API; `stable` és a `v0.1.1`, un hotfix només de l'app). L'adreça pública (`API_PUBLIC_URL`) és al gestor de contrasenyes (P20) i no s'escriu al repo; el script l'amaga a l'informe.
- **Client de la prova de càrrega:** un ordinador de l'equip fora de la FIB (macOS, Node 22), una sola IP.
- **SonarCloud:** branca `snapshot` a `071e975` (anàlisi del 11/11/2026 a les 19:24).

## RNF01 · Rendiment del mapa

**Pendent:** cal un iPhone i un Android. Aquí no hi ha cap xifra del mòbil.

En moure el mapa, l'app no fa cap petició a l'API: el mapa té tots els punts en un sol GeoJSON ([ADR-0012](decisions/0012-punts-mapa-geojson.md)) que es baixa un cop i val fins a la propera hora. El temps en moure'l és el de MapLibre dins del WebView (ADR-0015) pintant els marcadors i les tessel·les de l'ICGC.

### Procediment al dispositiu

1. A `apps/mobile/.env`, `EXPO_PUBLIC_API_URL` amb l'adreça de la VM (P20). Sense, l'app crida l'API local de l'ordinador.
2. `npm run start --workspace apps/mobile -- --no-dev --minify` i obre l'app a Expo Go amb el Wi-Fi (Metro només s'hi arriba per la xarxa local, o amb `--tunnel`). El mode de desenvolupament és més lent i no serveix ([design-system.md](design-system.md#moviment-i-fluïdesa), regla 10).
3. Un cop carregada, apaga el Wi-Fi i passa a dades mòbils en **4G** (no 5G: Ajustaments → Dades mòbils, «4G» o «LTE»). Mode d'estalvi d'energia apagat. Apunta la cobertura (barres).
4. Obre el mapa sense cerca («Mostra el mapa») i espera que surtin tots els marcadors.
5. Grava la pantalla (iOS: Centre de control → Gravació de pantalla; Android: el gravador del sistema, amb «Mostra els tocs» activat a Opcions per a desenvolupadors).
6. Fes **20 desplaçaments** cap a zones que no eren a la pantalla (p. ex. de Barcelona cap al Pirineu, cap a les Terres de l'Ebre i tornada), amb una pausa de 3 s entre cadascun. Alterna arrossegar i fer zoom.
7. A la gravació, fotograma a fotograma (QuickTime: tecles ← i →; a 60 fps, un fotograma són 16,7 ms): el temps va del **primer fotograma amb el mapa quiet** (s'acaba el gest i la inèrcia, l'equivalent al `moveend` de MapLibre) al **primer fotograma amb tots els marcadors de l'àrea visible pintats** (si ja hi són quan el mapa s'atura, 0 s).
8. Ordena els 20 temps de cada mòbil: el p95 és el 19è (rang més proper). Compleix si és < 2 s.

Amb la mateixa gravació es pot apuntar també la primera càrrega (de tocar «Mostra el mapa» als marcadors pintats), que és on pesen el WebView, l'estil i `/punts`, tot i que l'RNF01 no la demana.

Si cal més precisió, una mesura amb el codi: a `NightMap`, apuntar `performance.now()` a `moveend` i al primer `render` en què `queryRenderedFeatures` torna els marcadors de la vista, i escriure la diferència al log (només en una branca de mesura, no a `snapshot`).

| # | iPhone (model, iOS) — s | Android (model, versió) — s |
|---|---|---|
| 1 | | |
| 2 | | |
| 3 | | |
| 4 | | |
| 5 | | |
| 6 | | |
| 7 | | |
| 8 | | |
| 9 | | |
| 10 | | |
| 11 | | |
| 12 | | |
| 13 | | |
| 14 | | |
| 15 | | |
| 16 | | |
| 17 | | |
| 18 | | |
| 19 | | |
| 20 | | |
| **p50 (10è)** | | |
| **p95 (19è)** | | |
| **Resultat** | | |

### Indicador que es pot mesurar sense el mòbil

No és l'RNF01: només la part de xarxa de la primera càrrega del mapa. `GET /punts` de la VM, 20 peticions seguides amb `curl --compressed`, cadascuna amb una connexió nova (DNS + TCP + TLS + resposta), des de l'ordinador de la prova:

| Punts | Mida | Amb gzip | p50 | p95 | Màx. |
|---|---|---|---|---|---|
| 32 | 7,8 kB | 2,2 kB | 54 ms | 83 ms | 627 ms |

El màxim és la primera petició: DNS en fred (124 ms) i 470 ms de servidor. La primera petició després d'una estona sense trànsit va sempre més lenta (la primera de la sessió, 1,07 s). En 4G cal afegir-hi la latència de la xarxa mòbil; la mida (2,2 kB) no hi pesa.

## RNF02 · Temps de resposta de l'API

### Mètode

[`scripts/rnf/carrega-api.mjs`](../scripts/rnf/carrega-api.mjs) (`npm run rnf:api`): Node 22 sense dependències. Cada tanda envia, per endpoint, **ràfegues de N peticions alhora**, una cada 3 s durant 20 s (7 ràfegues), després d'una ràfega d'escalfament que obre les connexions TLS i no compta. Mesura el temps fins a l'últim byte de cada resposta i calcula p50, p95 i p99 (rang més proper) de les 2xx; els 429, els altres codis i els errors de xarxa es compten a part. Paràmetres com els de l'app: `/punts` sense `bbox` i `/recomanacions` amb els valors per defecte d'Explora (`cel_estrellat`, 22–6 h, 150 min) des de Barcelona, Girona, Lleida, Tarragona i Vic.

Per què no autocannon ni k6: Nginx limita cada IP a **20 peticions/s amb una ràfega de 40** (`limit_req`, TG-253). Des d'una sola IP, 50 connexions que repeteixen peticions sense parar rebrien sobretot 429 i es mesuraria el limitador. Amb ràfegues cada 3 s, el comptador es buida entre ràfegues: d'una ràfega de 50, en passen 41 i 9 reben 429 (el 18 %). No s'ha provat d'esquivar el límit; amb N = 40 no n'hi ha cap.

### Resultats

| Tanda | Hora | Peticions alhora | `/punts` p50 / p95 / p99 | `/recomanacions` p50 / p95 / p99 | 429 |
|---|---|---|---|---|---|
| 1 | 20:06 | 50 (n'arriben 41 a l'API) | 87 / **116** / 144 ms | 708 / **956** / 975 ms | 18 % i 17 % |
| 2 | 20:08 | 40 | 464 / **1.253** / 1.413 ms | 645 / **1.028** / 1.065 ms | 0 |
| 3 | 20:13 | 50 (n'arriben 41 a l'API) | 106 / **194** / 195 ms | 682 / **872** / 926 ms | 18 % i 17 % |

350 peticions per endpoint a les tandes 1 i 3, i 280 a la 2. Cap error ni cap codi que no fos 2xx o 429. Respostes de 7,8 kB (`/punts`) i 6,1 kB (`/recomanacions`) sense comprimir.

Referència sense càrrega (una petició cada segon, connexió nova): `/punts` 60–120 ms (la primera, 502 ms) i `/recomanacions` 200–375 ms.

`/esdeveniments` necessita credencial (JWT o la clau d'Aprop, `X-API-Key`) i no s'ha mesurat: no s'ha fet servir la clau de producció d'Aprop. Es mesura amb `TALAIA_API_KEY` (vegeu [Com repetir la mesura](#com-repetir-la-mesura)).

### Lectura

- **`/punts` compleix en dues tandes de tres.** El document és en memòria; la tanda 2 (p50 de 464 ms) no s'explica des de fora. Va ser poc després del recàlcul horari del worker (minut 5), que corre a la mateixa VM, però la tanda 1, encara més a prop, va anar bé. Cal repetir-la mirant `docker stats` i el log del worker.
- **`/recomanacions` no compleix:** p95 de 0,9–1 s amb unes 40 peticions alhora. Una petició sola triga 200–375 ms i cadascuna fa consultes a Supabase, amb un pool de 5 connexions a l'API ([ADR-0013](decisions/0013-acces-bd-kysely.md)): 40 consultes fan cua en grups de 5. És la hipòtesi; cal confirmar-la amb el temps de la consulta (`EXPLAIN ANALYZE`) abans de canviar res.
- **50 usuaris reals no venen d'una sola IP.** Si el NAT de la FIB no conserva la IP del client (el comentari de `default.conf.template` ja ho preveu), el límit de 20 r/s seria per a tots els usuaris alhora i 50 peticions concurrents tindrien 429. Es comprova al log de Nginx de la VM: si totes les peticions surten amb la mateixa `remote_addr`, la IP no es conserva.

## RNF03 · Qualitat del codi

Valors de l'API pública de SonarCloud (`/api/qualitygates/project_status` i `/api/measures/component`, projecte `pes2627q1-22-gei-upc_talaia`), branca `snapshot` a `071e975`. El codi nou és el posterior a la versió anterior (des del 08/10/2026).

| Mesura | Valor | Objectiu RNF03 |
|---|---|---|
| Quality Gate (Sonar way) | **Passed** | En verd |
| Cobertura del codi nou | **93,2 %** (2.101 línies, 84 sense cobrir) | ≥ 70 % (el gate en demana 80 %) |
| Cobertura total | 92,8 % (2.159 línies, 100 sense cobrir) | — |
| Bugs · vulnerabilitats · code smells | 0 · 0 · 0 (cap incidència oberta) | Cap bug greu |
| Fiabilitat · seguretat · mantenibilitat (codi nou) | A · A · A | — |
| Duplicació al codi nou · hotspots revisats | 0,0 % · 100 % | — |

**Abast:** Sonar només analitza `apps/mobile/src` (8.174 línies de codi, `sonar-project.properties`). L'API i el worker tenen tests a la CI però ni cobertura ni anàlisi a Sonar ([ci.md](ci.md#abast-i-ampliacions)): l'RNF03 es compleix per a l'app, no per a tot el codi.

Cobertura local de Jest a `snapshot` (`npm run test --workspace <w> -- --coverage`), només dels fitxers que carreguen els tests:

| Workspace | Tests | Línies | Branques | A Sonar |
|---|---|---|---|---|
| `apps/mobile` | 379 (67 fitxers) | 97,16 % | 88,53 % | Sí |
| `services/api` | 317 (22) | 98,98 % | 89,31 % | No |
| `services/worker` | 207 (15) | 96,59 % | 84,09 % | No |
| `packages/db` | 6 (1) | 100 % | 0 % (0 de 2) | No |

## RNF05 · Accessibilitat

### Test automàtic (la mesura que demana l'RNF)

- [`shared/ui/__tests__/accessibility.test.tsx`](../apps/mobile/src/shared/ui/__tests__/accessibility.test.tsx): tot el que es pot prémer dels components base té rol (`button`, `tab`, `adjustable`) i nom per al lector de pantalla, i on la mida és fixa, 44 pt de tacte (alçada o `minHeight` més el `hitSlop`). Les dues mancances conegudes són `it.failing`: quan s'arreglin, el test fallarà i caldrà passar-les a `it`.
- [`core/theme/__tests__/contrast.test.ts`](../apps/mobile/src/core/theme/__tests__/contrast.test.ts): ràtio de contrast WCAG de cada color de text sobre les superfícies del tema.

### Etiquetes

Tots els components base que es poden prémer tenen nom: `Button`, `Chip` i l'acció de `StateMessage` pel text; `Card`, les fletxes i els dies de `MonthCalendar`, `Slider`, `WheelPicker`, `TextField` i el fons de `Sheet` per `accessibilityLabel`; les opcions de `SegmentedControl` són pestanyes amb el text. `IndexIndicator` es llegeix «Índex de visibilitat: N de 100, franja».

A les pantalles (`features/` i `app/`) hi ha 16 elements tocables fets amb `PressableScale` o `Pressable`: 14 amb `accessibilityLabel` i 2 amb el text visible com a nom (els enllaços de `RecommendationsSheet`). Els marcadors del mapa són dins del WebView de MapLibre: cal comprovar al dispositiu què en llegeix el lector de pantalla (el full del rànquing en té les mateixes dades).

### Zones tàctils

| Element | Zona tàctil (alçada) | Resultat |
|---|---|---|
| `Button` `primary`, `secondary`, `light` · `TextField` | 54 pt | Compleix |
| `Chip` | 34 + 2 × 5 de `hitSlop` = 44 pt | Compleix |
| `SegmentedControl` | 38 + 2 × 4 = 46 pt | Compleix |
| `MonthCalendar` (fletxes i dies) · tancar del correu · tornar del mapa | 44 pt | Compleix |
| `WheelPicker` (cada fila) | 48 pt | Compleix |
| `Button` `text` (`link`, 17 de línia) | 17 + 2 × 12 = **41 pt** | No compleix |
| Enllaços de `RecommendationsSheet` (mostra/amaga i torna-ho a provar) | 17 + 2 × 12 = **41 pt** | No compleix |
| `Slider` (la barra sencera és la zona del gest) | **28 pt**, sense `hitSlop` | No compleix (amb el lector de pantalla s'ajusta lliscant amunt i avall) |

### Contrast (WCAG AA)

Text normal ≥ 4,5:1; text gran (24 pt, o 18,7 pt en negreta) ≥ 3:1.

| Text | `nit` | `card` | `sheet` | `vel` | `crep` |
|---|---|---|---|---|---|
| `lluna` | 15,81 | 14,58 | 14,23 | 12,55 | 10,59 |
| `boira` | 7,23 | 6,67 | 6,51 | 5,74 | 4,84 |
| `far` | 10,25 | 9,45 | 9,22 | 8,13 | 6,86 |
| `ras` | 10,03 | 9,25 | 9,03 | 7,96 | 6,72 |
| `jus` | 10,84 | 10,00 | 9,76 | 8,60 | 7,26 |
| `tap` | 5,88 | 5,42 | 5,29 | 4,66 | **3,93** |
| `pedra` | 10,59 | 9,76 | 9,53 | 8,40 | 7,09 |
| `fenomen*` (els quatre) | ≥ 8,71 | ≥ 8,03 | ≥ 7,84 | ≥ 6,91 | ≥ 5,84 |

- 54 dels 55 parells arriben a 4,5:1. `tap` sobre `crep` (3,93:1) només val per a text gran; avui no hi ha text `tap` sobre `crep`.
- `nit` sobre els botons i xips plens: `far` 10,25, `lluna` 15,81, `ras` 10,03, `jus` 10,84, `tap` 5,88.
- Els botons desactivats (opacitat 0,4) en queden exempts (WCAG 1.4.3).
- **A comprovar al dispositiu:** a la benvinguda, el text legal (`boira`, `caption`) i l'error (`tap`) són sobre el cel. Si al darrere hi ha el final del degradat (`#2F3680`), fan 4,30:1 i 3,50:1, per sota de 4,5. L'Accessibility Inspector de Xcode (Color contrast) ho mesura sobre la pantalla real.

### Revisió al dispositiu (pendent)

Per pantalla, amb VoiceOver (iPhone), TalkBack (Android) i l'auditoria de l'Accessibility Inspector de Xcode (simulador) o l'Accessibility Scanner (Android): tot es pot recórrer i activar amb el lector, l'ordre té sentit, els noms són els de la pantalla, cap element no queda tapat i la mida de text gran no talla res. Registre amb el format de [testing-ui.md](testing-ui.md#evidències-a-la-pr-i-seguiment-de-la-tg-260):

| Pantalla | VoiceOver | TalkBack | Inspector / Scanner | Problemes |
|---|---|---|---|---|
| Benvinguda i correu | | | | |
| Explora («Què vols veure?») | | | | |
| Mapa i rànquing | | | | |
| Fitxa del punt | | | | |
| Calendari | | | | |
| Alertes · Perfil | | | | |

## Següents passos

1. **RNF01:** les 20 mesures a l'iPhone i a l'Android (Hugo), a la taula d'aquest document.
2. **RNF02 · `/recomanacions`:** informar-ne el responsable de TG-100 (Mohamed) amb aquestes xifres i l'ordre per reproduir-ho; confirmar on va el temps (consulta o cua del pool) abans de triar una solució.
3. **RNF02 · `/esdeveniments`:** mesurar-lo amb la clau d'Aprop de P20, a mà i des de la màquina de qui la tingui.
4. **RNF02 · VM:** mirar al log de Nginx si el NAT conserva la IP del client, i repetir `/punts` amb `docker stats` per explicar la tanda 2.
5. **RNF03:** portar la cobertura de l'API i del worker a Sonar ([ci.md](ci.md#abast-i-ampliacions)).
6. **RNF05:** informar-ne el responsable dels components (Joan): `Button` `text`, els enllaços de `RecommendationsSheet` i `Slider`, a 44 pt (el `hitSlop` del `Chip` n'és el model). Revisió de les pantalles al dispositiu.
7. Repetir aquesta mesura després de la `release/0.2.0` (20/11) i afegir-la aquí com a «Segona mesura».

## Com repetir la mesura

```bash
# RNF02: les tres tandes (≤ 20 s per endpoint). La URL és a P20 (API_PUBLIC_URL).
npm run rnf:api -- --url "$API_PUBLIC_URL"                      # 50 alhora (el 18 % són 429)
npm run rnf:api -- --url "$API_PUBLIC_URL" --concurrencia 40     # el màxim sense 429 des d'una IP
TALAIA_API_KEY=… npm run rnf:api -- --url "$API_PUBLIC_URL" --endpoints esdeveniments

# RNF01 (indicador): mida i temps de /punts
for i in $(seq 20); do curl -so /dev/null --compressed -w '%{size_download} %{time_total}\n' "$API_PUBLIC_URL/punts"; sleep 0.5; done

# RNF03: Quality Gate i cobertura de snapshot
curl -s 'https://sonarcloud.io/api/qualitygates/project_status?projectKey=pes2627q1-22-gei-upc_talaia&branch=snapshot'
curl -s 'https://sonarcloud.io/api/measures/component?component=pes2627q1-22-gei-upc_talaia&branch=snapshot&metricKeys=coverage,new_coverage,bugs,reliability_rating&additionalFields=periods'

# RNF05: etiquetes, zones tàctils i contrast
npm run test --workspace apps/mobile -- accessibility contrast
```

Opcions del script: `--concurrencia` (50), `--durada` (20 s), `--interval` (3 s; `0` contra una API local sense Nginx), `--endpoints` (`punts,recomanacions,esdeveniments`) i `--data` (avui). La credencial de `/esdeveniments` va a `TALAIA_API_KEY` o `TALAIA_JWT`. L'informe surt en Markdown, sense l'adreça de la VM, i el codi de sortida és 1 si algun endpoint no compleix.
