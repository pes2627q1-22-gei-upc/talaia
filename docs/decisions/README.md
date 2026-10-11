# Registre de decisions (ADR)

Cada decisió tècnica rellevant es registra aquí perquè ningú (persona o agent) l'hagi de reobrir sense motiu. Per canviar-ne una, s'afegeix una ADR nova que la substitueix; no s'esborra l'antiga.

Format: **Context → Decisió → Conseqüències**. Estat: `Acceptada`, `Proposada`, `Substituïda per ADR-xxxx`.

| ADR | Decisió | Estat |
|---|---|---|
| [0001](0001-app-react-native-expo.md) | App mòbil amb React Native + TypeScript + Expo, patró MVVM | Acceptada |
| [0002](0002-api-node-express.md) | API i worker propis amb Node.js + TypeScript + Express | Acceptada |
| [0003](0003-supabase.md) | Supabase (PostgreSQL + PostGIS, Auth, Storage) a la UE | Acceptada |
| [0004](0004-index-precalculat.md) | Índex de visibilitat precalculat cada hora | Acceptada |
| [0005](0005-mapa-icgc-maplibre.md) | Mapa amb MapLibre i tessel·les de l'ICGC; rutes via Mobilicat + deep link | Acceptada (el motor: 0015) |
| [0006](0006-infra-vm-docker.md) | Una VM amb Docker Compose + Nginx + Let's Encrypt | Acceptada |
| [0007](0007-git-snapshot-stable-prod.md) | Branques snapshot / stable / prod amb PR obligatòria | Substituïda per 0009 |
| [0008](0008-monorepo.md) | Monorepo amb apps/, services/, packages/shared | Acceptada |
| [0009](0009-gitflow.md) | Gitflow amb snapshot (develop) / stable (main) / prod, i Conventional Commits 1.0.0 | Acceptada |
| [0010](0010-eines-app.md) | npm workspaces, Expo Router, TanStack Query, Jest, Node 22 i eines de qualitat (ESLint, Prettier, commitlint) | Acceptada |
| [0011](0011-validacio-openapi-zod.md) | Validació amb zod i OpenAPI generat amb zod-to-openapi a l'API | Acceptada |
| [0012](0012-punts-mapa-geojson.md) | Els punts del mapa se serveixen com un sol GeoJSON en memòria cau (`ETag`), no amb consultes per bbox | Acceptada |
| [0013](0013-acces-bd-kysely.md) | Accés a la base de dades amb Kysely (`@talaia/db`) sobre migracions SQL de Supabase; RLS activat sense polítiques | Acceptada |
| [0014](0014-identificador-app-expo-go.md) | Identificador `cat.talaia.app` (P22) i Expo Go per provar en dispositius | Acceptada |
| [0015](0015-mapa-dom-component.md) | Mapa amb MapLibre GL JS en una DOM component d'Expo: Expo Go i terreny 3D | Acceptada |

Decisions encara obertes: [pendents.md](pendents.md).
