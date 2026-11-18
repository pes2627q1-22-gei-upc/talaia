# TG-141 · Registre de proves

Validació local del 18/11/2026 a `feature/TG-141-on-veure-ho`.
Entorn admès: Node 22.23.3, Expo SDK 58 segons `apps/mobile/package.json`.

Guies aplicades: [proves d’UI](testing-ui.md), [CI](ci.md) i
[onboarding](onboarding.md). El seguiment visual es recull a l'[inventari d'UI](testing-ui-inventari.md);
aquest document conserva el detall de les ordres de la tasca.

## Comportament final que es valida

- La fitxa ofereix «On veure-ho» i demana la ubicació quan es prem el botó.
  Si l’esdeveniment ha acabat, el botó queda desactivat amb un missatge; una
  resposta `franja_passada` al rànquing explica el motiu sense oferir reintent.
- El rànquing s’obre dins del Calendari; «Enrere» retorna a la fitxa.
- La consulta envia l’esdeveniment i l’origen. La finestra horària la resol l’API.
- Sense límit explícit de temps, es consideren tots els punts publicats i es
  retornen els 20 primers després d’ordenar-los.
- L’ordre prioritza el nivell ras/jus/tap i després la puntuació
  `índex − min(10, km/30)`. Els empats es resolen per distància, índex exacte,
  mitjana i identificador. La puntuació no modifica l’índex mostrat.
- Sense previsió, els punts s’ordenen per distància i es mostra l’avís.
- El full es plega i es recupera arrossegant la nansa, sense botó visible;
  la nansa ofereix una acció equivalent als lectors de pantalla.
- La franja plegada és de 32 pt. A iOS l’overlay respecta la zona segura nativa
  de les pestanyes; a Android no duplica el marge que aplica Expo Router.

## Verificacions automàtiques

S’han executat les ordres del workflow `.github/workflows/ci.yml` amb les
dependències instal·lades. No s’ha repetit `npm ci`, perquè no hi ha canvis de
dependències. No s’ha executat el desplegament ni l’anàlisi remota de SonarCloud.

| Comprovació | Resultat |
| --- | --- |
| App: `npm run test --workspace apps/mobile -- --ci --coverage --runInBand` | 90 suites, 586 tests correctes |
| API: mateixa ordre amb `--workspace services/api` | 36 suites, 682 tests correctes |
| Worker: mateixa ordre amb `--workspace services/worker` | 12 suites, 97 tests correctes |
| DB: mateixa ordre amb `--workspace packages/db` | 1 suite, 6 tests correctes |
| Índex: mateixa ordre amb `--workspace packages/index` | 3 suites, 111 tests correctes |
| `npm run test --workspace data` | 63 tests correctes |
| `npm run test:supabase` | 2 tests correctes |
| `npm run test:sm` | 19 tests correctes |
| `node --test scripts/ci/prepare-sonar-coverage.test.mjs` | 4 tests correctes |
| `npm run typecheck` | Correcte a tots els workspaces |
| `npm run lint` | Cap error; un avís existent a `apps/mobile/src/core/i18n/index.ts` |
| `npm run format:check` | Correcte |
| `npx tsc -p data --noEmit` | Correcte |
| `node data/scripts/build-seed-punts.ts --check` | 32 punts vàlids; seed al dia |
| `node data/scripts/build-seed-astronomia.ts --check` | 15 fenòmens i 22 esdeveniments vàlids |
| `npm run astronomia:calendari --workspace services/worker -- --check` | 7 fenòmens i 40 esdeveniments calculats vàlids |
| `node scripts/ci/prepare-sonar-coverage.mjs` | Correcte amb els cinc informes LCOV finals |
| `git diff --check` | Correcte |

L’avís de lint és `import/no-named-as-default-member`, fora dels fitxers modificats.
Jest de l’API també avisa de la configuració existent `TS151002`; les suites passen.
No s’han ampliat els canvis per corregir aquests avisos.

El flux afectat s’ha executat també de forma focalitzada: 10 suites i 75 tests
correctes, incloent-hi les dues proves afegides durant aquesta revisió.

## Casos coberts

- **Ubicació:** consulta real desactivada fins al toc, permís denegat, error,
  reintent, configuració del sistema, retorn a l’app, doble toc i sortida de la
  fitxa mentre espera. El geocodificador pot fallar sense impedir la cerca.
- **Navegació i API:** identificador de l’esdeveniment i coordenades correctes;
  no s’inventa una data ni una franja a l’app; la fitxa del punt continua obrint-se.
- **Rànquing:** índex de la finestra, proximitat, límit de penalització, empats
  estables, nivells de qualitat, manca de previsió, consulta sense radi i límit
  de resultats aplicat després d’ordenar. Es manté el contracte d’Explora.
- **Ponderació final:** 100 a 150 km guanya 95 a 20 km amb el pes de 30 km/punt;
  100 a 102,8 km guanya 92 a 63 km. Els índexs retornats continuen sent els reals.
- **Presentació:** càrrega, error amb reintent, buit, contingut, nom llarg,
  data resolta, distàncies, avisos i claus ca/es/en.
- **Full:** arrossegament cap avall i cap amunt, gest curt, ràpid i cancel·lat,
  límits de moviment, canvi d’alçada i reducció de moviment.
- **Accessibilitat:** activar la nansa amb un lector de pantalla plega i
  recupera el contingut; el gest d’escapament el plega. El contingut plegat
  queda ocult a l’arbre d’accessibilitat i el mapa es manté disponible.
- **Menú inferior:** configuració de zona segura d’iOS i Android i recuperació
  del full. Aquestes proves no mesuren la posició real de la nansa al mòbil.

## Comprovació visual confirmada

La responsable de TG-141, Vinyet (`vinyetam`), confirma el 18/11/2026 que ha
completat la validació visual de la funcionalitat.

| Dada | Validació comunicada |
| --- | --- |
| Entorn | Mòbil físic de la responsable |
| Plataforma | iOS |
| Idiomes | Català, castellà i anglès |
| Resultat | Validació visual completada, confirmada per la responsable |
| Evidència disponible | Confirmació directa a la conversa de treball |
| Model i versió d’iOS | No especificats |
| Mida de text | No especificada |
| Captures o vídeo | No s’ha facilitat cap enllaç |

Aquesta confirmació acredita la revisió manual comunicada per la responsable,
separada de les proves automàtiques executades per l’agent. No s’estén la
validació manual a Android ni s’atribueix una mesura de 60 fps o una prova amb
text ampliat que no s’hagi comunicat.

El Quality Gate de SonarCloud (80 % al codi nou, segons `docs/ci.md`) requereix
una execució remota de CI sobre la PR. La cobertura local i la preparació LCOV
no equivalen a haver superat aquest gate.

## Correccions de la revisió de PR #160

La revisió de Jsolee demana evitar la consulta d'esdeveniments acabats i el
reintent d'una franja passada. S'afegeixen tests per a aquests casos, incloent
l'esdeveniment que acaba mentre espera la ubicació, el retorn des del mapa i el
missatge en ca/es/en. També es prova l'apostrofació d'Igualada i Àger.

Validació d'aquesta correcció: `npm test -w apps/mobile -- --selectProjects app
--runInBand src/features/event src/features/recommendations
src/features/map/__tests__/MapScreen.test.tsx`: **9 suites i 80 tests correctes**.
`npm run typecheck -w apps/mobile` i `npm run lint -w apps/mobile` correctes;
el lint conserva l'avís d'i18n ja indicat. Format dels fitxers de codi i
`git diff --check` correctes.

El text de qualitat i proximitat explicita la prioritat ras/jus/tap. Es conserven
les fronteres de qualitat a 40 i 70; la penalització per distància només es
compara dins del mateix nivell.

Vinyet confirma el 18/11/2026 que ha provat el full del rànquing a iOS amb Expo Go
tant des d'Explora com des del Calendari. Es conserva `RankingSafeArea` perquè
la comprovació inclou els dos accessos. `react-native-screens/experimental`
continua sent una API experimental; cal revisar-la en actualitzar la dependència.
No s'han aportat captures/vídeo, model, versió d'iOS ni mida de text. La revisió
visual de l'estat passat afegit en aquesta correcció queda pendent. El registre
amb el format de `docs/testing-ui.md` és a `docs/testing-ui-inventari.md`.

## Fusió de snapshot i resolució de conflictes

Integrat `origin/snapshot` a `e82a923`. El conflicte de `RecommendationsSheet`
es resol conservant els gestos, les distàncies i l'error sense reintent de
TG-141, i els estils i la icona del cotxe adaptats al tema de TG-239.

Validació amb Node 22.23.3 i `npm ci`: app **100 suites, 714 tests**; API
**42 suites, 843 tests**; tots correctes. Typecheck de tots els workspaces,
lint i format correctes, amb els avisos d'i18n i ts-jest ja documentats.
El typecheck de l'app s'ha repetit després d'apartar els tipus locals generats
d'Expo Router, desfasats amb les rutes noves de snapshot.

Després de la fusió de la PR #131 a snapshot (`50eff61`), s'han combinat les
cerques d'Explora, A prop meu i esdeveniments al parser, repositori i ViewModel.
El mapa conserva el botó flotant, el selector d'origen i la zona segura del
rànquing. Es conserven els tests de les dues branques i es comprova que el full
d'A prop meu es pot plegar i recuperar. Resultat: **101 suites i 735 tests de
l'app correctes**, typecheck i lint de l'app i format del repositori correctes.
També s'ha incorporat snapshot a `67f0988` (avisos de desplegament), sense
conflictes ni canvis addicionals a l'app.
