---
name: revisa-pr
description: Revisa la PR d'un company contra les convencions del repo i en prepara la revisió en català. No la publica sense l'ok de la persona.
disable-model-invocation: true
argument-hint: <número de PR>
arguments: [pr]
---

Reviso la PR #$pr.

1. **Recull-ho tot sense tocar la branca del company.**
   - `git fetch origin` i `git fetch origin pull/$pr/head:refs/remotes/pr/$pr`.
   - `gh pr view $pr --json title,author,headRefOid,baseRefName,mergeable,reviews,comments`.
   - Els comentaris en línia: `gh api repos/pes2627q1-22-gei-upc/talaia/pulls/$pr/comments`.
   - L'estat de la CI: `gh pr checks $pr`.
   - El diff: `git diff origin/snapshot...pr/$pr`.

   No facis checkout ni push a la branca del company.
2. **Delega la revisió a l'agent `revisor`.** Passa-li el número, el head i les revisions anteriors. En una PR gran, fes-ne un per àrea (API, migracions, app) en paral·lel.
3. **Verifica tu mateix cada troballa important** llegint el codi, abans d'incloure-la. El que no puguis confirmar, o ho treus o ho escrius com una pregunta.
4. **Comprova les revisions anteriors.** Per a cada punt que ja s'havia demanat, mira si està resolt al head actual.
5. **Redacta la revisió en català.**
   - El veredicte: aprova, comenta o demana canvis.
   - Què està ben resolt.
   - Què bloqueja, amb `fitxer:línia`, un cas concret i una proposta.
   - Què no bloqueja.

   Breu i sense repetir el que diu el diff.
6. **Ensenya-la i espera l'ok.** Abans de publicar-la, comprova que el `headRefOid` no ha canviat. Després: `gh pr review $pr --approve|--comment|--request-changes --body-file -`.

No fusionis mai la PR d'un company. Si la seva branca va enrere de `snapshot`, digues-li; no hi fusionis tu `snapshot`.
