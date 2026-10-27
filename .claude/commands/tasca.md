---
description: Comença una tasca de Taiga seguint el flux de l'equip (ús: /tasca TG-88)
---

Vull començar la tasca de Taiga $ARGUMENTS.

1. Llegeix `CLAUDE.md` i, al `docs/sprint-<N>.md` del sprint on és la tasca, la fila de $ARGUMENTS i els criteris d'acceptació de la seva història.
2. Comprova a `docs/decisions/pendents.md` si la tasca depèn d'alguna decisió oberta. Si és així, para i pregunta'm abans d'escriure codi.
3. Crea la branca Gitflow des de `snapshot` actualitzada: `feature/$ARGUMENTS-<descripcio-curta>` (tot el que no és release ni hotfix és una feature).
4. Proposa'm un pla breu (fitxers a crear o tocar, tests) i espera el meu ok.
5. Implementa amb tests, respecta MVVM, i18n i els tokens del design system, i actualitza l'OpenAPI o la documentació si toca.
6. Fes commits en format Conventional Commits 1.0.0 amb el peu `Refs: $ARGUMENTS` (vegeu `docs/git-workflow.md`) i prepara la PR cap a `snapshot` amb un títol Conventional Commits i la plantilla `.github/pull_request_template.md`.
