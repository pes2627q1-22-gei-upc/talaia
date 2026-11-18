# CI i SonarCloud (TG-70, TG-181, TG-263)

El workflow [ci.yml](../.github/workflows/ci.yml) executa tres checks independents:
`lint`, `typecheck` i `tests`. S'activa en obrir o reobrir una PR, quan s'hi pugen
commits nous i en fer push a `snapshot`, `stable` o `prod`. També permet execució
manual des d'Actions quan el workflow és a la branca per defecte.

Node es configura amb `.nvmrc` i les dependències s'instal·len amb
`npm ci --ignore-scripts`, sense executar scripts automàtics d'instal·lació.
Les ordres explícites de lint, typecheck i tests sí que s'executen. Aquesta
configuració és per a la CI; no canvia la instal·lació local ni els hooks de Git.
Les accions estan fixades al SHA complet del commit, amb la versió en un comentari.
Per actualitzar-les, cal verificar el nou commit al repositori oficial i canviar el SHA.
El check `tests` executa amb cobertura els tests d'`apps/mobile`, `apps/admin`,
`services/api`, `services/worker`, `packages/db` i `packages/index`. Els tests dels altres
workspaces s'executen encara que fallin els de l'app. Els informes es desen durant 7 dies:
`mobile-coverage` per a l'app, `admin-coverage` per a la web d'administració i
`services-coverage` per als serveis i paquets, també si els tests fallen i han generat informes. També s'executen els tests dels scripts
de dades, Supabase, eines del sprint master i preparació de cobertura.
`packages/shared` només té tipus i el cobreix `typecheck`.

## Desplegament

Un workflow més, separat de `ci.yml` (detalls a [desplegament.md](desplegament.md)):

- [deploy-check.yml](../.github/workflows/deploy-check.yml): a les PR que toquen `deploy/`, els `Dockerfile`, `.dockerignore` o `package-lock.json`, valida el compose, construeix les imatges i arrenca el compose amb `.env.example` i un certificat autosignat fins que `/api/v1/health` respon per Nginx.

El deploy de `stable` no és a GitHub Actions: el fa un cron de la VM ([ADR-0021](decisions/0021-deploy-per-pull-des-de-la-vm.md)).

## Estat de la integració

La integració amb SonarCloud està **activada** al repositori. La configuració amplia
l'anàlisi de l'app a l'admin, l'API, el worker, `packages/db` i `packages/index`,
amb informes de cobertura de tots sis (els de l'admin, des de la TG-263).
La validació remota documentada més avall correspon a l'abast original de l'app;
cal comprovar l'ampliació en una execució de CI i al tauler de SonarCloud.
El projecte utilitza el Quality Gate **Sonar way**, amb un mínim
del **80 % de cobertura al codi nou**. El llindar es configura a SonarCloud;
`sonar.qualitygate.wait=true` fa que la CI esperi el resultat i falli si no se supera.
No és un mínim del 80 % sobre tot el codi existent.

Sense la variable
`SONAR_ENABLED=true`, els passos de Sonar s'ometen i la CI bàsica continua funcionant.

## Configuració de SonarCloud

Els passos següents permeten reproduir la configuració de la integració:

1. Importa o vincula el repositori `talaia` al projecte de SonarCloud de l'equip.
   Comprova que la branca principal del projecte sigui `snapshot`.
2. A SonarCloud, desactiva **Administration → Analysis Method → Automatic Analysis**
   si està activat: utilitzem l'anàlisi de GitHub Actions per importar cobertura.
3. A GitHub, entra a **Settings → Secrets and variables → Actions**. Qui tingui
   permisos de configuració del repositori ha d'afegir aquests valors:

   | Tipus | Nom | Valor |
   | --- | --- | --- |
   | Secret | `SONAR_TOKEN` | Token amb permís d'executar anàlisis al projecte |
   | Variable | `SONAR_PROJECT_KEY` | Clau real del projecte de SonarCloud |
   | Variable | `SONAR_ORGANIZATION` | Clau real de l'organització de SonarCloud |
   | Variable | `SONAR_ENABLED` | `true` (activa-la en últim lloc) |

   No desis el token al repositori ni al xat. Les claus de projecte i organització
   són identificadors; no són els noms visibles necessàriament.
4. Executa primer la CI sobre `snapshot` per disposar d'una anàlisi de referència.
   Després obre o actualitza una PR i comprova el resultat de SonarCloud.
5. Verifica al tauler de Sonar que s'han importat els fitxers i la cobertura,
   i que el Quality Gate assignat és **Sonar way**, amb un mínim del **80 % de
   cobertura al codi nou**. Aquest llindar no es defineix al YAML ni a Jest.
6. Fes obligatoris `lint`, `typecheck` i `tests` al ruleset de GitHub si encara no
   ho són. Sonar s'executa dins de `tests`: un Quality Gate fallit també fa fallar
   aquest check quan l'anàlisi està activada.

No cal editar el YAML per activar la integració. Si s'activa amb alguna credencial
o clau absent, el workflow falla amb un missatge que indica el nom que falta,
sense mostrar el valor del token.

## Consultar els informes i el llindar

1. A GitHub, obre **Actions → CI** i selecciona una execució recent acabada.
2. Al resum, a **Artifacts**, descarrega `mobile-coverage`, `admin-coverage` o `services-coverage`.
   Es conserven durant **7 dies**; una execució més antiga pot haver perdut els artefactes.
3. Descomprimeix el ZIP i obre `lcov-report/index.html` al navegador per consultar
   la cobertura per fitxer. A `services-coverage`, els informes són a
   `<workspace>/coverage/` (per exemple, `services/api/coverage/`). `lcov.info`
   és l'informe original i `lcov-sonar.info`, la còpia amb rutes adaptades a SonarCloud.
   Aquesta còpia només es prepara quan passen els tests; si fallen, encara es
   conserven els informes originals disponibles.
4. A SonarCloud, obre el projecte i **Analysis → Summary → New Code** per veure
   la cobertura del codi nou, el mínim requerit i el resultat del Quality Gate.
   L'enllaç **Sonar way** permet consultar les condicions del gate assignat.
5. A les PR, consulta el comentari de SonarQube Cloud i el seu enllaç als detalls
   de l'anàlisi per veure la cobertura dels canvis.

SonarCloud pot ometre les condicions de cobertura i duplicació en canvis de menys
de 20 línies noves si està activada l'opció **Ignore duplication and coverage on
small changes**. Cal consultar aquesta opció al Quality Gate del projecte;
la validació de la TG-181 no n'ha comprovat l'estat.

### Evidències de validació de l'app (TG-181)

Validació del 2026-11-11, a partir de les captures de SonarCloud i GitHub i de la
comprovació de l'artefacte feta per la responsable de la tasca:

- A `snapshot`, SonarCloud mostra **Sonar way**, amb **93,21 %** de cobertura del
  codi nou, mínim requerit del **80 %** i resultat **Passed**.
- La [PR #93](https://github.com/pes2627q1-22-gei-upc/talaia/pull/93) mostra
  **91,9 %** de cobertura del codi nou i **Quality Gate passed**, com a evidència
  de l'anàlisi de cobertura en una PR amb canvis de codi.
- S'ha confirmat la disponibilitat de `mobile-coverage` en una execució recent
  de CI, amb `lcov.info` i l'informe HTML.

Aquestes comprovacions validen la importació de cobertura i l'avaluació del gate
per a l'app mòbil; no són evidències de l'ampliació als altres mòduls.
No s'ha fet una prova controlada amb cobertura inferior al llindar; el comportament
de fallada està configurat al workflow amb `sonar.qualitygate.wait=true`.

## Com funciona l'anàlisi

Després de passar els tests, el treball `tests` prepara els informes, desa la
cobertura i executa `SonarSource/sonarqube-scan-action`. El checkout inclou tot
l'historial de Git. L'escàner llegeix
[`sonar-project.properties`](../sonar-project.properties) des de l'arrel.

Jest genera `<workspace>/coverage/lcov.info`. El script
[`prepare-sonar-coverage.mjs`](../scripts/ci/prepare-sonar-coverage.mjs) crea
`lcov-sonar.info` a cada workspace amb rutes relatives a l'arrel del repositori:
per exemple, `src/index.ts` passa a `services/api/src/index.ts` a l'informe de
l'API. També resol rutes absolutes i imports relatius a altres workspaces.
Comprova que els informes continguin fitxers i que les rutes existeixin dins del
repositori; si falta un informe o una ruta no es pot resoldre, falla el check.
Els originals es conserven. La preparació també s'executa amb Sonar desactivat,
per validar els informes sense dependre dels secrets.

`sonar.qualitygate.wait=true` espera el resultat del Quality Gate i fa fallar
el treball si no se supera. Si fallen els tests, Sonar no s'executa i el check
ja queda en vermell.

Les PR procedents de forks i les execucions de Dependabot ometen Sonar perquè no
disposen dels secrets habituals. Lint, typecheck i tests continuen executant-se.
Per tant, aquests casos no validen el Quality Gate amb aquest workflow.

## Abast i exclusions

| Mòdul | Anàlisi estàtica | Informe de cobertura |
| --- | --- | --- |
| `apps/mobile/src` | Sí | Jest |
| `apps/admin/src` | Sí | Vitest ([ADR-0034](decisions/0034-tests-admin-vitest.md)) |
| `services/api/src` | Sí | Jest |
| `services/worker/src` | Sí | Jest |
| `packages/db/src` | Sí | Jest |
| `packages/index/src` | Sí | Jest |

Es manté un únic projecte de SonarCloud amb els informes LCOV dels sis workspaces.
`packages/index` conté la fórmula i els càlculs compartits entre l'API i el worker;
analitzar només el worker deixaria aquesta lògica fora de l'abast.

Els tests (`__tests__`, `*.test.ts`, `*.test.tsx`) es classifiquen com a tests,
separats del codi de producció. Les declaracions `*.d.ts`, el fitxer generat
`packages/db/src/schema.ts` i els helpers de tests `services/api/src/testing/`
s'exclouen de l'anàlisi de producció. Builds, dades, migracions i scripts auxiliars
queden fora de les carpetes `src` seleccionades. `packages/shared` només conté tipus.
L'admin és una web Vite i es prova amb Vitest i Testing Library (ADR-0034), simulant
Supabase Auth i l'API. La cobertura inclou tots els fitxers d'`apps/admin/src`, també
els que no carreguen els tests; els helpers de `src/__tests__/` es classifiquen com a tests.

L'API, el worker i els paquets configuren `collectCoverageFrom` per incloure també
fitxers de producció no carregats pels tests, amb les exclusions anteriors.
L'app conserva la seva configuració: Jest recull els fitxers carregats pels tests,
i Sonar també analitza el codi de producció dins de l'abast que no apareix a LCOV.

### Validar l'ampliació en una PR

1. Comprova que passen `lint`, `typecheck` i `tests`, inclosa la preparació dels LCOV.
2. Descarrega els tres artefactes i comprova que cada workspace té el seu informe
   original i l'adaptat amb rutes de repositori.
3. Al tauler de SonarCloud, comprova que apareixen els sis mòduls i que la cobertura
   de l'admin, l'API, el worker i els paquets coincideix amb els fitxers dels informes.
4. Comprova el Quality Gate de la PR i adjunta els enllaços de CI i Sonar a la PR.
   No canviïs el llindar ni afegeixis exclusions per ocultar manca de cobertura.
   Una prova controlada amb cobertura insuficient, en una branca de prova, permet
   verificar que el check falla pel gate; cal tenir en compte l'excepció de canvis petits.

### Validació local de l'ampliació (2026-11-17)

Amb Node 22.23.3 i una instal·lació `npm ci --ignore-scripts`, han passat:

- Tests amb cobertura: app (478), API (525), worker (97), `packages/db` (6)
  i `packages/index` (111).
- Quatre tests de preparació LCOV: distinció entre workspaces, rutes absolutes
  i compartides, preservació dels originals i rebuig d'informes o rutes invàlids.
- Conversió dels cinc informes LCOV reals amb comprovació dels fitxers referenciats.
- `npm run lint`, `npm run typecheck` i validació de sintaxi YAML del workflow.

Queda pendent la validació remota de l'ampliació: execució de GitHub Actions,
importació al tauler de SonarCloud i resultat del Quality Gate de la PR.

## Referències

- [Acció oficial de SonarSource](https://github.com/SonarSource/sonarqube-scan-action)
- [Cobertura JavaScript/TypeScript i anàlisi des de CI](https://docs.sonarsource.com/sonarqube-cloud/analyzing-source-code/test-coverage/javascript-typescript-test-coverage)
- [Paràmetres del Quality Gate](https://docs.sonarsource.com/sonarqube-cloud/analyzing-source-code/analysis-parameters/parameters-not-settable-in-ui)
- [Quality Gate i excepció per a canvis petits](https://docs.sonarsource.com/sonarqube-cloud/managing-your-projects/project-analysis/changing-quality-gate)
