# Talaia

**On i quan observar el cel a Catalunya.** Talaia recomana el millor lloc i moment per veure la posta de sol, la Lluna, una pluja d'estels o una constel·lació, amb un índex de visibilitat que creua meteorologia, contaminació lumínica, càlcul astronòmic i relleu.

Projecte de l'assignatura PES (Projecte d'Enginyeria del Software) · FIB-UPC · 2026-27 Q1 · grup 22 · equip C.

## Comença aquí

Ets nou a l'equip? Segueix la **[guia d'onboarding](docs/onboarding.md)**: en mitja hora tens l'app i l'API funcionant i saps com entregar una tasca.

## Estructura

| Carpeta | Contingut |
|---|---|
| `apps/mobile` | App React Native + TypeScript (Expo), MVVM |
| `apps/admin` | Web d'administració (React) |
| `services/api` | API REST Node.js + Express (`/api/v1`, OpenAPI) |
| `services/worker` | Càlcul horari de l'índex de visibilitat |
| `packages/shared` | Tipus i models compartits |
| `packages/db` | Accés a la base de dades (Kysely + PostGIS) |
| `data` | Scripts de preprocés de dades obertes |
| `docs` | Producte, arquitectura, decisions, sprint, flux de Git |

## Documentació

- [Producte i abast](docs/producte.md)
- [Arquitectura](docs/arquitectura.md) · [Decisions (ADR)](docs/decisions/README.md) · [Decisions pendents](docs/decisions/pendents.md)
- [Sprint 1](docs/sprint-1.md) · [Product backlog](docs/backlog.md)
- [Flux de Git](docs/git-workflow.md) · [Com contribuir](CONTRIBUTING.md)
- [Design system](docs/design-system.md) · [Serveis entre equips](docs/serveis-externs.md)
- [Equip](docs/equip.md)
- [Guia d'onboarding](docs/onboarding.md) · Context per a agents: [CLAUDE.md](CLAUDE.md)

## Posada en marxa

Requisits: Git, Node 22 amb nvm (`.nvmrc`) i Expo Go al mòbil. Pas a pas, per a macOS, Windows i Linux: [docs/onboarding.md](docs/onboarding.md).

```bash
nvm use && npm install                             # instal·la app, API i shared, i activa els hooks
npm run lint && npm run typecheck && npm test      # tot ha de passar
npm run api                                        # API: http://localhost:3000/api/v1/docs
npm run mobile                                     # app amb Expo (escaneja el QR amb Expo Go)
```

| Part | On | Estat |
|---|---|---|
| App mòbil | `apps/mobile` | Funciona amb Expo Go (MapLibre, a TG-89, demanarà un *development build*) |
| API | `services/api` | `/api/v1/health` i documentació OpenAPI a `/api/v1/docs` |
| Tipus compartits | `packages/shared` | Tipus de domini (`import type`) |
| Base de dades | `supabase/` | Postgres + PostGIS amb migracions del CLI de Supabase (arriba amb TG-69) |

Els secrets van als fitxers `.env` (vegeu `.env.example` i `apps/mobile/.env.example`), mai al repo.

## Gestió

- Codi: [pes2627q1-22-gei-upc/talaia](https://github.com/pes2627q1-22-gei-upc/talaia) (organització de l'assignatura)
- Backlog i sprints: [Taiga](https://tree.taiga.io/project/mohamed-dari-pes_22_c_talaia)
- Lliurables de l'assignatura: Google Drive de l'equip (`PES_22_C_TALAIA`)
