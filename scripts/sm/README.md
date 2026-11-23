# Eines del sprint master

Scripts de Node 22 sense dependències (excepte el generador del planning) que llegeixen Taiga i GitHub, tots dos públics. Tres s'executen sols amb GitHub Actions; la resta, a mà. En començar un sprint, només cal revisar `SPRINTS` a `config.mjs` (dates, id de Taiga, història [GES] i sprint master).

| Eina | Què fa | Quan |
|---|---|---|
| `parte-daily.mjs` | Missatge per al grup de WhatsApp: tasques vençudes, les que tocava començar i segueixen a «New», les que comencen avui, PR que esperen revisió més de 24 h, tasques tancades sense hores reals i estat de la CI de `snapshot`. | Workflow `sm-parte-daily`: dilluns i dimecres a les 8:00, com a comentari a l'issue «Parte de la daily · Sprint N», esmentant el sprint master. A mà: `npm run sm:parte` (el copia al porta-retalls). |
| `recordatori-revisions.mjs` | Comenta les PR que fa més de 24 h que esperen revisió, esmenta els revisors i hi afegeix qui menys revisions porta al sprint (els empats es reparteixen). Un recordatori per PR i dia com a molt. | Workflow `sm-recordatori-revisions`: cada dia feiner a les 8:00. A mà, sense publicar res: `node scripts/sm/recordatori-revisions.mjs`. |
| `foto-sprint.mjs` | Foto de l'estat del sprint: punts pendents i ideals, tasques i hores estimades i reals per persona (JSON i CSV). | Workflow `sm-foto-sprint`: cada nit a les 23:30, com a artefacte de 90 dies. |
| `informe-sprint.mjs` | Dades del report: indicadors, hores per persona i per història, tasques afegides i obertes, PR i revisions per persona, i els gràfics de burndown, velocitat, burndown del producte i PR per dia (SVG i CSV). | En tancar el sprint. |
| `planning/genera-planning.mjs` | El planning del sprint en .docx (i PDF amb l'índex paginat si hi ha LibreOffice), amb el format del planning_1. | El dia de la planning, després d'apuntar les tasques a Taiga. |

Les hores de 8:00 i 23:30 són d'hivern: els `cron` de GitHub van en UTC.

## Report del sprint

```bash
gh run list --workflow sm-foto-sprint.yml                     # les fotos del sprint
gh run download --pattern 'foto-sprint-*' --dir fotos          # baixa-les (90 dies)
GH_TOKEN=$(gh auth token) node scripts/sm/informe-sprint.mjs --sprint 2 --fotos fotos
```

Deixa `informe-sprint-2/` amb `informe.md`, els quatre gràfics i els seus CSV, i `evolucio-hores.csv` si hi ha fotos. Sense `GH_TOKEN`, GitHub només deixa 60 peticions per hora i no n'hi ha prou per a les revisions.

## Planning del sprint

```bash
npm --prefix scripts/sm ci                                     # un cop: instal·la docx
node scripts/sm/planning/genera-planning.mjs --sprint 3 --data 2026-11-30 --sortida ~/Desktop
```

Les tasques, responsables, dates i hores surten de Taiga; l'objectiu, les fites i el text i els criteris de cada història, de `docs/sprint-<N>.md`. Les dependències crítiques s'escriuen a mà al document abans de lliurar-lo.

## Proves

`npm run test:sm` (també a la CI). Les funcions que componen els missatges i les taules són pures i es proven sense xarxa.
