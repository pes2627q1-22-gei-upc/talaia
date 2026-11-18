---
paths:
  - "services/**"
  - "packages/**"
---

# API, worker i paquets

- **Rutes d'usuari.** Fes servir el `requireUser` de `routes/index.ts`, que respon 403 `account_blocked` (ADR-0029), i mai un `requireAuth` propi. Les d'administració porten `requireUser, requireAdmin`.
- **OpenAPI.** Reaprofita `ERRORS_AUTH` i `errorResponse` de `routes/auth.ts`. Tota ruta nova es documenta a l'OpenAPI i a `services/api/README.md` a la mateixa PR.
- **Recursos que crea l'usuari** (alertes, plans, tokens): un màxim per perfil, i els duplicats es protegeixen a la base de dades (índex únic), no només al codi.
- **Hores i nits** a l'hora de Catalunya (`Europe/Madrid`), amb els helpers de nit de `packages/shared`. Els cron del worker van en UTC (ADR-0024).
- **Tipus de domini.** S'escriuen una sola vegada a `packages/shared` i es fan servir amb `import type`.
