# Com contribuir

Primera vegada? Prepara l'entorn amb la **[guia d'onboarding](docs/onboarding.md)**. Hi ha el flux complet d'una tasca amb exemples (secció 6) i els problemes freqüents.

Resum del flux:

1. **Agafa una tasca a Taiga** que tinguis assignada i mou-la a «En curso». Mira'n la *Data d'inici*, la data límit i les hores estimades.
2. **Crea la branca** des de `snapshot`:
   ```bash
   git switch snapshot && git pull
   git switch -c feature/TG-<ref>-descripcio-curta
   ```
3. **Treballa amb commits petits** en format [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/), sempre amb el peu de Taiga:
   ```
   feat(api): afegeix GET /punts amb filtre per bbox

   Refs: TG-88
   ```
   Els hooks (s'activen amb `npm install`) rebutgen el commit si el missatge no compleix el format o si ESLint troba errors.
4. **Abans de la PR:** actualitza la branca amb `snapshot` i passa `npm run lint && npm run typecheck && npm test`.
5. **Obre la PR cap a `snapshot`** amb la plantilla i un títol en format Conventional Commits. Revisor: backend (API, worker, base de dades), Mohamed; la resta, qualsevol company amb permís d'escriptura. Cap PR s'aprova a si mateixa, i no es fusiona sense la CI en verd.
6. **En fusionar** (merge commit): tanca la tasca a Taiga i omple **Hores reals**.

Releases i hotfixos (Gitflow) els fa el sprint master: [docs/git-workflow.md](docs/git-workflow.md).

Normes completes: [docs/git-workflow.md](docs/git-workflow.md). Convencions de codi: [CLAUDE.md](CLAUDE.md#convencions).

## Definition of Done

Especificada → implementada → provada (tests a la CI) → revisada (PR aprovada) → documentada (OpenAPI / memòria) → integrada a `snapshot`.

## Si fas servir Claude Code o una altra IA

Llegeix i fes llegir [CLAUDE.md](CLAUDE.md). La IA ha de seguir el stack i les convencions, no prendre decisions de [docs/decisions/pendents.md](docs/decisions/pendents.md) pel seu compte, i tu ets responsable de revisar tot el que generi abans de la PR.
