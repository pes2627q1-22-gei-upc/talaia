# CI i SonarCloud (TG-70, TG-181)

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
El check `tests` executa els tests d'`apps/mobile` amb cobertura i després els de
`services/api`, `services/worker` i `packages/db` (aquests, encara que fallin els de
l'app). La cobertura és només la de l'app: es desa durant 7 dies a l'artefacte
`mobile-coverage`, també si Jest falla
i ha generat informes. `packages/shared` només té tipus i el cobreix `typecheck`.

## Desplegament

Un workflow més, separat de `ci.yml` (detalls a [desplegament.md](desplegament.md)):

- [deploy-check.yml](../.github/workflows/deploy-check.yml): a les PR que toquen `deploy/`, els `Dockerfile`, `.dockerignore` o `package-lock.json`, valida el compose, construeix les imatges i arrenca el compose amb `.env.example` i un certificat autosignat fins que `/api/v1/health` respon per Nginx.

El deploy de `stable` no és a GitHub Actions: el fa un cron de la VM ([ADR-0021](decisions/0021-deploy-per-pull-des-de-la-vm.md)).

## Estat de la integració

La integració amb SonarCloud està **activada** al repositori i importa la cobertura
de l'app mòbil. El projecte utilitza el Quality Gate **Sonar way**, amb un mínim
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
2. Al resum, a **Artifacts**, descarrega `mobile-coverage`. Es conserva durant
   **7 dies**; una execució més antiga pot haver perdut l'artefacte.
3. Descomprimeix el ZIP i obre `lcov-report/index.html` al navegador per consultar
   la cobertura per fitxer. `lcov.info` conté les dades que es preparen per a SonarCloud.
4. A SonarCloud, obre el projecte i **Analysis → Summary → New Code** per veure
   la cobertura del codi nou, el mínim requerit i el resultat del Quality Gate.
   L'enllaç **Sonar way** permet consultar les condicions del gate assignat.
5. A les PR, consulta el comentari de SonarQube Cloud i el seu enllaç als detalls
   de l'anàlisi per veure la cobertura dels canvis.

SonarCloud pot ometre les condicions de cobertura i duplicació en canvis de menys
de 20 línies noves si està activada l'opció **Ignore duplication and coverage on
small changes**. Cal consultar aquesta opció al Quality Gate del projecte;
la validació de la TG-181 no n'ha comprovat l'estat.

### Evidències de validació (TG-181)

Validació del 2026-11-11, a partir de les captures de SonarCloud i GitHub i de la
comprovació de l'artefacte feta per la responsable de la tasca:

- A `snapshot`, SonarCloud mostra **Sonar way**, amb **93,21 %** de cobertura del
  codi nou, mínim requerit del **80 %** i resultat **Passed**.
- La [PR #93](https://github.com/pes2627q1-22-gei-upc/talaia/pull/93) mostra
  **91,9 %** de cobertura del codi nou i **Quality Gate passed**, com a evidència
  de l'anàlisi de cobertura en una PR amb canvis de codi.
- S'ha confirmat la disponibilitat de `mobile-coverage` en una execució recent
  de CI, amb `lcov.info` i l'informe HTML.

Aquestes comprovacions validen la importació de cobertura i l'avaluació del gate.
No s'ha fet una prova controlada amb cobertura inferior al llindar; el comportament
de fallada està configurat al workflow amb `sonar.qualitygate.wait=true`.

## Com funciona l'anàlisi

Després de passar els tests i desar la cobertura, el treball `tests` prepara
l'informe i executa `SonarSource/sonarqube-scan-action`. El checkout inclou tot
l'historial de Git. L'escàner llegeix
[`sonar-project.properties`](../sonar-project.properties) des de l'arrel.

Jest genera `apps/mobile/coverage/lcov.info` amb rutes `src/...`; el workflow
crea `lcov-sonar.info` amb rutes `apps/mobile/src/...` per fer-les coincidir amb
l'arrel de l'anàlisi. L'informe original es conserva.

`sonar.qualitygate.wait=true` espera el resultat del Quality Gate i fa fallar
el treball si no se supera. Si fallen els tests, Sonar no s'executa i el check
ja queda en vermell.

Les PR procedents de forks i les execucions de Dependabot ometen Sonar perquè no
disposen dels secrets habituals. Lint, typecheck i tests continuen executant-se.
Per tant, aquests casos no validen el Quality Gate amb aquest workflow.

## Abast i ampliacions

Actualment l'anàlisi cobreix `apps/mobile/src`, distingint els tests del codi de
producció. Els tests de `services/api` i `services/worker` ja s'executen a la CI, però sense cobertura.
Per portar l'API a Sonar cal afegir-hi `--coverage`, adaptar-ne les rutes de
`lcov.info` com es fa amb les de l'app i ampliar l'abast de
`sonar-project.properties`.

Jest actualment recull cobertura dels fitxers carregats pels tests. El percentatge
local no representa necessàriament tot el codi de l'app; Sonar també analitza
els fitxers de producció dins de l'abast que no apareixen a l'informe.

La integració de l'app està validada contra el projecte real de SonarCloud.
Ampliar-ne l'abast a altres serveis és una millora posterior.

## Referències

- [Acció oficial de SonarSource](https://github.com/SonarSource/sonarqube-scan-action)
- [Cobertura JavaScript/TypeScript i anàlisi des de CI](https://docs.sonarsource.com/sonarqube-cloud/analyzing-source-code/test-coverage/javascript-typescript-test-coverage)
- [Paràmetres del Quality Gate](https://docs.sonarsource.com/sonarqube-cloud/analyzing-source-code/analysis-parameters/parameters-not-settable-in-ui)
- [Quality Gate i excepció per a canvis petits](https://docs.sonarsource.com/sonarqube-cloud/managing-your-projects/project-analysis/changing-quality-gate)
