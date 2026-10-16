# CI i SonarCloud (TG-70)

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

El deploy de `stable` no és a GitHub Actions: el fa un cron de la VM ([ADR-0020](decisions/0020-deploy-per-pull-des-de-la-vm.md)).

## Activar SonarCloud quan hi hagi accés

La integració està preparada però **desactivada per defecte**. Sense la variable
`SONAR_ENABLED=true`, els passos de Sonar s'ometen i la CI bàsica continua funcionant.

1. Importa o vincula el repositori `talaia` al projecte de SonarCloud de l'equip.
   Comprova que la branca principal del projecte sigui `snapshot`.
2. A SonarCloud, desactiva **Administration → Analysis Method → Automatic Analysis**
   si està activat: utilitzarem l'anàlisi de GitHub Actions per importar cobertura.
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
   i que el Quality Gate retorna un resultat. Acordeu les seves condicions amb
   l'equip; aquesta configuració no crea llindars de qualitat nous.
6. Fes obligatoris `lint`, `typecheck` i `tests` al ruleset de GitHub si encara no
   ho són. Sonar s'executa dins de `tests`: un Quality Gate fallit també fa fallar
   aquest check quan l'anàlisi està activada.

No cal editar el YAML per activar la integració. Si s'activa amb alguna credencial
o clau absent, el workflow falla amb un missatge que indica el nom que falta,
sense mostrar el valor del token.

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

La integració encara s'ha de validar contra el projecte real de SonarCloud.

## Referències

- [Acció oficial de SonarSource](https://github.com/SonarSource/sonarqube-scan-action)
- [Cobertura JavaScript/TypeScript i anàlisi des de CI](https://docs.sonarsource.com/sonarqube-cloud/analyzing-source-code/test-coverage/javascript-typescript-test-coverage)
- [Paràmetres del Quality Gate](https://docs.sonarsource.com/sonarqube-cloud/analyzing-source-code/analysis-parameters/parameters-not-settable-in-ui)
