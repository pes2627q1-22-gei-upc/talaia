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
| [0016](0016-sign-in-with-apple-ios.md) | «Continua amb Apple» només a iOS (P15) | Acceptada |
| [0017](0017-cataleg-inicial-punts.md) | Catàleg inicial de 32 punts d'observació en un GeoJSON versionat (`data/`) que genera el seed SQL (P13) | Acceptada |
| [0018](0018-formula-index-v1.md) | Fórmula de l'índex v1: els núvols i el Sol multipliquen, la foscor i la Lluna es ponderen; franges 0–39 / 40–69 / 70–100 (P12) | Acceptada |
| [0019](0019-allotjament-i-desplegament.md) | VM de la FIB (nattech, ports 8080–8089), HTTPS amb DuckDNS + Let's Encrypt DNS-01 i deploy de `stable` amb un runner self-hosted (P16, P17) | Acceptada (el deploy: 0021) |
| [0020](0020-foscor-sqm-geotiff.md) | Foscor del cel per punt: la malla WFS del mapa de contaminació lumínica de la Generalitat es rasteritza a GeoTIFF amb geotiff.js i omple la columna `sqm` de `punts_observacio` (P10) | Acceptada |
| [0021](0021-deploy-per-pull-des-de-la-vm.md) | Deploy de `stable` per pull: un cron de la VM cada 5 minuts, sense runner de GitHub | Acceptada |
| [0022](0022-perfil-horitzo-icgc.md) | Perfil d'horitzó per punt: el model de 5 m de l'ICGC pel WCS, a tres resolucions, omple la columna `horitzo` de `punts_observacio` (360 alçades aparents) | Acceptada |
| [0023](0023-validacio-jwt-jwks.md) | Validació del JWT a l'API amb el JWKS de Supabase i `jose`: 401 només si el token és dolent, 503 si Supabase no respon (P6) | Acceptada |
| [0024](0024-planificacio-worker-node-cron.md) | El worker recalcula l'índex en arrencar i cada hora amb node-cron dins del contenidor; cada execució queda a `execucions_worker`, que l'API fa servir com a versió del mapa (P9) | Acceptada |
| [0025](0025-observacions-xema.md) | Observacions de la XEMA de Meteocat: les lectures d'ahir de l'estació més propera a cada punt, un cop al dia (unes 190 consultes al mes) | Acceptada |
| [0026](0026-contracte-esdeveniments-aprop.md) | Contracte del calendari amb Aprop: sis tipus, dies civils de Catalunya, ubicació general i accés amb API key o JWT (P14) | Acceptada |

Decisions encara obertes: [pendents.md](pendents.md).
