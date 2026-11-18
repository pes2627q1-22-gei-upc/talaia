---
name: tasca
description: Comença una tasca de Taiga seguint el flux de l'equip, des de la branca fins a la PR. Fes-la servir quan algú diu «comença la TG-…» o «fes la tasca TG-…».
argument-hint: TG-<ref>
arguments: [ref]
---

Començo la tasca de Taiga $ref.

1. **Llegeix el context.**
   - `CLAUDE.md`;
   - la fila de $ref al `docs/sprint-<N>.md` del sprint on és la tasca, i els criteris d'acceptació de la seva història;
   - la descripció de Taiga, que es llegeix sense sessió: `curl -s "https://api.taiga.io/api/v1/tasks/by_ref?ref=<número>&project=1806158"`.
2. **Decisions obertes.** Si la tasca en depèn d'alguna de `docs/decisions/pendents.md`, para i pregunta abans d'escriure codi.
3. **Branca** des de `snapshot` actualitzada: `git fetch origin` i `feature/$ref-<descripcio-curta>`. Per no tocar la còpia de treball principal, millor en un worktree: `git worktree add ../talaia-$ref -b feature/$ref-<descripcio> origin/snapshot`.
4. **Recorda a la persona que posi la tasca a «In progress» a Taiga.** Es fa a mà; els commits no porten etiquetes d'estat.
5. **Proposa un pla breu** (fitxers, tests i documentació que tocaràs) i espera l'ok.
6. **Implementa amb tests.** Respecta MVVM, l'i18n i els tokens del design system. Actualitza l'OpenAPI i la documentació si toca. Les regles de cada àrea són a `.claude/rules/` i es carreguen soles quan toques aquells fitxers.
7. **Commits** en Conventional Commits 1.0.0, amb la capçalera de 72 caràcters com a màxim i el peu `Refs: $ref`. Mai `TG-<ref> #<estat>` (`docs/git-workflow.md`).
8. **Quan estigui fet,** `/obre-pr`.
