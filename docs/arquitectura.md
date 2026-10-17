# Arquitectura

Principi: **concentrar l'esforç en el que fa únic el producte (l'índex de visibilitat) i delegar la resta a serveis gestionats.** Criteris, per ordre: encaix amb el problema (geografia, tasques periòdiques, dades obertes de Catalunya) → productivitat d'un equip de 6 en un quadrimestre (un sol llenguatge) → requisits de l'assignatura (API pròpia, servidors justificats, dades obertes, CI/CD) → cost zero i sense dependre d'un sol proveïdor al nucli.

## Diagrama físic (v1)

```
                 HTTPS                        HTTPS
 App mòbil (Expo) ─────┐              ┌──── Web admin (React, estàtica)
                       ▼              ▼
              ┌──────────────── VM Ubuntu · Docker Compose ───────────────┐
              │  Nginx :8080 + Let's Encrypt DNS-01 (únic punt d'entrada)  │
              │     ├── API REST Node/Express  /api/v1  (OpenAPI)          │
              │     └── fitxers estàtics de l'admin                        │
              │  Worker índex (cada hora) ── dades estàtiques preprocessades│
              └───────────────┬───────────────────────────┬───────────────┘
                              │ SQL / Auth / Storage       │ HTTPS
                              ▼                            ▼
                Supabase (UE): PostgreSQL+PostGIS,   Open-Meteo · Meteocat XEMA
                Auth (Google/Apple/correu → JWT),    Servei de rutes de l'equip Mobilicat
                Storage (fotos, URL signades)        Expo Push (→ FCM / APNs)

   Equip Aprop ──HTTPS + API key──▶ GET /api/v1/esdeveniments
   App ──deep link──▶ app de mapes del mòbil (navegació)
   Mapa a l'app: MapLibre ◀── tessel·les vectorials + relleu 3D de l'ICGC
```

La VM és la de la FIB (`nattech.fib.upc.edu`, ports 8080–8089) i el nom públic és de DuckDNS: [ADR-0019](decisions/0019-allotjament-i-desplegament.md) i [desplegament.md](desplegament.md).

La imatge oficial del diagrama és a la incepció 2 (Drive).

## Decisions i alternatives descartades

| Peça | Decisió | Descartat |
|---|---|---|
| App mòbil | React Native + TypeScript (Expo) | Flutter, Kotlin + Swift natius, Ionic/Capacitor, PWA |
| Web admin | React + TypeScript | Angular, Vue, panell de Supabase |
| Lògica de negoci | Servidor propi Node.js + TypeScript (Express) | Només Supabase Edge Functions, Python/FastAPI, Java/Spring |
| Dades i auth | Supabase (PostgreSQL + PostGIS, Auth, Storage) | Firebase, Postgres i login propis |
| Índex | Precalculat cada hora | Calculat a cada petició |
| Cartografia | ICGC + MapLibre | Google Maps SDK, Mapbox |
| Rutes | Servei de l'equip Mobilicat + deep link al mapa del mòbil | Navegació pròpia |
| Notificacions | Expo Push | FCM/APNs directes, OneSignal |
| Infra | 1 VM + Docker Compose + Nginx | Kubernetes, microserveis, PaaS (Render, Railway, Heroku) |
| CI/CD | GitHub Actions; EAS Build per a l'app | GitLab CI, Jenkins |

Raons clau:

- **React Native vs Flutter:** un sol llenguatge (TypeScript) a app, API, worker i admin → tipus compartits (`packages/shared`); l'equip ja coneix JS; llibreries madures (MapLibre, supabase-js, Astronomy Engine, i18next); Expo resol compilació al núvol (iOS sense Mac), push i distribució; el mapa el dibuixa MapLibre en natiu, així que el rendiment de Flutter no aportaria res.
- **Servidor propi i no només Supabase:** el càlcul horari és pesat i periòdic (Edge Functions tenen límits de temps/memòria), els ràsters GeoTIFF es processen millor en un servidor, l'assignatura demana API pròpia, i la lògica queda fora del proveïdor.
- **Node i no Python:** Python seria millor per a ràsters, però afegeix un segon llenguatge; el ràster es preprocessa una vegada i el càlcul horari és aritmètica simple.
- **Precalcular l'índex:** resposta immediata, quotes d'API externes independents del nombre d'usuaris, les alertes necessiten l'índex abans que l'usuari obri l'app, i coherència entre usuaris. Excepció: punt arbitrari del mapa → càlcul al moment + memòria cau.
- **Punts del mapa en un sol GeoJSON:** `GET /api/v1/punts` retorna tots els punts amb l'índex actual en una `FeatureCollection` amb `ETag`; l'app la descarrega com a molt un cop per hora, la dibuixa amb el clustering de MapLibre i cerca en local. Moure el mapa no consulta la base de dades ([ADR-0012](decisions/0012-punts-mapa-geojson.md)).
- **Kysely sobre migracions SQL:** l'esquema només canvia amb migracions del CLI de Supabase, i l'API i el worker hi accedeixen amb Kysely (`@talaia/db`), amb tipus generats de la base de dades i PostGIS en SQL explícit. Totes les taules tenen RLS sense polítiques: les dades només passen per la nostra API ([ADR-0013](decisions/0013-acces-bd-kysely.md)).
- **Astronomy Engine dins del servidor:** exacte, previsible, sense límits de crides.
- **ICGC + MapLibre:** cartografia oficial, vectorial, gratuïta, sense clau, CC BY; l'estil JSON es recoloreix amb la paleta de Talaia (mapa nocturn). Fora de Catalunya el mateix servei completa amb OSM (cal atribució).
- **Supabase a la regió UE:** PostGIS per a consultes geogràfiques amb índexs espacials, Auth sense guardar contrasenyes, Storage amb URL signades per a fotos privades. És Postgres estàndard: migrable.

## Fonts de dades obertes

| Dada | Font triada | Descartat | Com s'usa |
|---|---|---|---|
| Previsió meteorològica | Open-Meteo | OpenWeather, AEMET | Worker, cada hora, agrupant punts propers |
| Observació real | Meteocat (XEMA) | — | Contrastar i ajustar l'índex (sprints posteriors) |
| Brillantor del cel | Mapa de contaminació lumínica de Catalunya (Generalitat, 2025) | World Atlas, VIIRS | GeoTIFF 1 km, preprocés únic → valor per punt |
| Relleu i horitzó | Model d'elevacions ICGC (5 m) | SRTM, Copernicus | Preprocés únic → perfil d'horitzó per punt |
| Fenòmens | Calendaris IMO i NASA + càlcul propi | API de tercers | Càrrega per temporada |

Només la previsió és dependència en temps real; si una font estàtica cau, Talaia continua funcionant.

## Integració amb altres equips

Veure `serveis-externs.md`:

- **Consumim** el servei de rutes de l'equip **Mobilicat** (distància i temps fins al punt).
- **Oferim** a l'equip **Aprop** `GET /api/v1/esdeveniments?des_de&fins_a&tipus` amb API key.

## Riscos coneguts

| Risc | Mitigació |
|---|---|
| Supabase (pla gratuït) pausa projectes inactius | El worker hi escriu cada hora |
| Límits d'Open-Meteo si creixen els punts | Agrupar punts propers, memòria cau |
| Una sola VM = punt únic de fallada | Còpies a Supabase, desplegament reproduïble amb Docker |
| Dependència d'Expo | Es pot exportar el projecte natiu; el servidor pot parlar amb FCM/APNs directament |
| Serveis d'altres equips no definits | Contractes OpenAPI acordats (TG-109) |

L'arquitectura es revisa al final de cada sprint i el diagrama s'actualitza (requisit de la metodologia).
