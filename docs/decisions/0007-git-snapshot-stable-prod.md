# ADR-0007: Branques snapshot / stable / prod amb PR obligatòria

**Estat:** Substituïda per ADR-0009 · **Data:** 2026-09 (Incepció 2)

## Context

Sis persones treballant en paral·lel; l'assignatura avalua la gestió del codi i la qualitat mesurable des del principi.

## Decisió

Tres branques permanents: `snapshot` (integració, per defecte), `stable` (sprint validat), `prod` (publicació). Branques de treball `feature/TG-<ref>-…` des de `snapshot`. Tot entra per PR amb 1 aprovació i CI en verd; sense push directe ni force-push a les permanents. Conventional Commits amb la referència de Taiga. Detall a `docs/git-workflow.md`.

## Conseqüències

Historial net i traçable fins a les tasques de Taiga. Cal que la CI (TG-70) existeixi per exigir-la a les regles de protecció.
