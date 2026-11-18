---
name: nou-adr
description: Crea una ADR nova a docs/decisions, amb el número lliure següent (mirant snapshot i totes les branques remotes) i la fila a l'índex. Fes-la servir quan una decisió tècnica s'ha de deixar escrita.
argument-hint: "<títol de la decisió>"
---

## Números ja agafats (les cinc últimes, a totes les branques remotes)

!`for b in $(git for-each-ref --format='%(refname:short)' refs/remotes/origin); do git ls-tree --name-only "$b" docs/decisions/ 2>/dev/null; done | grep -oE '[0-9]{4}-[^/]*\.md$' | sort -u | tail -5 || true`

## Passos

1. **Número.** Si fa estona que no s'ha fet, `git fetch origin` i torna a mirar la llista. El número és el més alt + 1.
2. **Fitxer** `docs/decisions/NNNN-titol-en-kebab.md`. Copia el format de l'última ADR:
   - `# ADR-NNNN: <títol>`;
   - `**Estat:** Proposada · **Data:** <AAAA-MM-DD> · TG-<ref>`;
   - Context, Decisió (amb les opcions que s'han considerat i per què se n'ha triat una) i Conseqüències.
3. **Índex.** La fila nova va a `docs/decisions/README.md` en ordre numèric. Si la decisió venia de `pendents.md`, treu-la d'allà.
4. **Commit:** `docs(decisions): proposa l'ADR-NNNN <resum>`, amb el peu `Refs: TG-<ref>`.

L'ADR es valida a la daily. Quan l'equip hi està d'acord, passa a `Acceptada`.
