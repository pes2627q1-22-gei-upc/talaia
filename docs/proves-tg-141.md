# TG-141 · Registre de proves

Validació local del 18/11/2026 a `feature/TG-141-on-veure-ho`.
Entorn admès: Node 22.23.3, Expo SDK 58 segons `apps/mobile/package.json`.

Guies aplicades: [proves d’UI](testing-ui.md), [CI](ci.md) i
[onboarding](onboarding.md). No hi ha cap fitxer anomenat `testing.md` en aquesta
versió del repositori.

## Comportament final que es valida

- La fitxa ofereix «On veure-ho» i demana la ubicació quan es prem el botó.
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

## Comprovació visual pendent

La guia exigeix revisar a Expo Go les pantalles modificades. Els tests de Jest
no demostren que els elements es vegin sencers ni que el menú no tapi la nansa.
No es marca aquesta part com a validada ni es donen per comprovats els 60 fps.

En aquesta sessió s’ha arrencat l’emulador `Pixel_9` (Android API 35), però no hi
ha Expo Go instal·lat ni cap dispositiu físic connectat. No s’ha executat el flux
visual de Talaia en aquest entorn.

Per completar la revisió amb una sessió iniciada:

1. Engegar l’API i l’app (`npm run api` i `npm run mobile`).
2. Calendari → esdeveniment → «On veure-ho»: comprovar que el botó i els textos
   són accessibles mitjançant desplaçament i que els permisos funcionen.
3. Revisar el rànquing amb previsió, sense previsió, buit i amb error; obrir un
   punt, tornar i recuperar la fitxa de l’esdeveniment amb «Enrere».
4. Plegar el full arrossegant la nansa: ha de quedar **per sobre del menú de
   pestanyes** i ha de permetre arrossegar cap amunt per reobrir-lo.
5. Revisar desplaçament de la llista, gestos curts i ràpids, cancel·lació,
   rotació i canvi de pestanya; repetir amb reducció de moviment i amb
   VoiceOver/TalkBack.
6. Revisar textos llargs, pantalla petita, text ampliat i ca/es/en. Confirmar
   que capçalera, llegenda, botons i full no se superposen ni queden tapats.
7. Comprovar també la cerca original d’Explora. Revisar fluïdesa en dispositiu
   físic en mode de producció.
8. Adjuntar captures o vídeo amb dispositiu, sistema operatiu, idioma, mida de
   text i resultat. Comprovar iOS i Android quan estiguin disponibles.

El Quality Gate de SonarCloud (80 % al codi nou, segons `docs/ci.md`) requereix
una execució remota de CI sobre la PR. La cobertura local i la preparació LCOV
no equivalen a haver superat aquest gate.
