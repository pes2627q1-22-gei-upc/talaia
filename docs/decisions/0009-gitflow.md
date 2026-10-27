# ADR-0009: Gitflow amb snapshot/stable/prod i Conventional Commits 1.0.0

**Estat:** Acceptada · **Data:** 2026-10-03 · **Substitueix:** ADR-0007

## Context

L'ADR-0007 definia tres branques permanents però no deia com es fan les versions ni els hotfixos, ni quin format exacte tenen els commits. L'equip decideix treballar amb Gitflow (Atlassian) i Conventional Commits 1.0.0, i l'assignatura demana les branques `snapshot`, `stable` i `prod`.

## Decisió

- **Gitflow** amb els noms de l'assignatura: `snapshot` fa de `develop`, `stable` fa de `main` (una versió etiquetada per sprint) i `prod` és la branca de desplegament de la versió publicada.
- Branques de suport: `feature/TG-<ref>-…` (de `snapshot` a `snapshot`), `release/<versió>` (de `snapshot` a `stable` i `snapshot`), `hotfix/<versió>` (de `stable` a `stable` i `snapshot`).
- Fusions amb **merge commit** (`--no-ff`). Versions **SemVer**: sprint N = `v0.N.0`, final = `v1.0.0`.
- Commits **Conventional Commits 1.0.0** amb el peu obligatori `Refs: TG-<ref>`.

Detall i receptes: `docs/git-workflow.md`.

## Conseqüències

- Cada sprint acaba amb una `release/0.N.0` i una etiqueta a `stable`: és exactament el que es lliura i es mostra a la review.
- Els tipus `feat`/`fix`/`!` dels commits indiquen el salt de versió.
- commitlint + husky (TG-67) han de validar el format i el peu `Refs`.
- El ruleset de GitHub protegeix les tres branques permanents; les branques de suport no.
