---
name: obre-pr
description: Comprova la branca actual (lint, typecheck i tests), la posa al dia amb snapshot i obre la PR cap a snapshot amb la plantilla de l'equip. Demana l'ok abans de crear-la.
disable-model-invocation: true
argument-hint: "[TG-<ref>]"
---

## Context

- Branca: !`git branch --show-current`
- Commits que no són a `snapshot`: !`git log --oneline origin/snapshot..HEAD 2>/dev/null || true`
- Fitxers canviats: !`git diff --stat origin/snapshot...HEAD 2>/dev/null | tail -25 || true`

## Passos

1. **Comprova la branca i els commits.**
   - La branca ha de ser `feature/TG-<ref>-…`, `release/…` o `hotfix/…`.
   - Cap commit no pot portar `TG-<ref> #<estat>`. Si n'hi ha, avisa: s'han de treure abans que arribin a `snapshot` (`docs/git-workflow.md`).
2. **Posa la branca al dia.** `git fetch origin`. Si va enrere de `snapshot`, fusiona-hi `origin/snapshot`. En una branca publicada, merge, no rebase.
3. **Verifica.** Delega a l'agent `verificador` el lint, el typecheck i els tests dels workspaces tocats. Si alguna cosa falla, para i explica-ho.
4. **Redacta la PR.**
   - **Títol:** en Conventional Commits, de 72 caràcters com a màxim.
   - **Cos:** `.github/pull_request_template.md` omplerta amb dades reals: la tasca, què canvia, com provar-ho (tests i resultats) i, si toca UI, les comprovacions de `docs/testing-ui.md`.
   - **Checklist:** marca només el que és cert.
5. **Espera l'ok.** Ensenya el títol i el cos, i no facis `gh pr create --base snapshot` fins que la persona t'ho digui.
6. **Recorda** posar la tasca a «Ready for test» a Taiga, a mà, i demanar la revisió a qui toqui.
