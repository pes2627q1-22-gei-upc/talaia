# CLAUDE.md — Context per a Claude Code

Aquest fitxer és el punt d'entrada per a qualsevol agent (Claude Code) que treballi en aquest repositori. Llegeix-lo sencer abans de començar una tasca. Els detalls viuen a `docs/`.

## Què és Talaia

App mòbil que recomana **on i quan** observar o fotografiar el cel a **Catalunya**: postes de sol, la Lluna, pluges d'estels, eclipsis, constel·lacions. El nucli és un **índex de visibilitat (0–100)** que creua:

1. Meteorologia (núvols per capes, humitat, visibilitat) — Open-Meteo, contrastat amb Meteocat (XEMA).
2. Contaminació lumínica — mapa de la Generalitat (GeoTIFF, 1 km).
3. Càlcul astronòmic — Astronomy Engine (Sol, Lluna, fases, alçades, crepuscles).
4. Perfil d'horitzó — model d'elevacions de l'ICGC (5 m).

Projecte de l'assignatura **PES (Projecte d'Enginyeria del Software), FIB-UPC**, curs 2026-27 Q1, grup 22, equip C. Sis persones, tres sprints de desenvolupament. Tot el producte és en **català** (amb castellà i anglès com a idiomes de l'app).

Més context: `docs/producte.md` (abast, MVP, NOT list), `docs/arquitectura.md`, `docs/decisions/`.

## Estat actual

- **Sprint 1: 05/10/2026 – 28/10/2026.** Objectiu: base tècnica operativa + primer flux del MVP (login → mapa de punts amb índex v1 → recomanacions → fitxa del punt amb desglossament → calendari de fenòmens). Veure `docs/sprint-1.md`.
- **Sprint 2: 09/11/2026 – 27/11/2026** (sprint master: Hugo) i **Sprint 3: 30/11/2026 – 18/12/2026** (sprint master: Martina). Veure `docs/sprint-2.md` i `docs/sprint-3.md`.
- Les branques `snapshot`, `stable` i `prod` estan protegides (ruleset de GitHub).
- **App:** scaffold fet (TG-66): Expo SDK 57 + Expo Router + MVVM + i18n + TanStack Query + Jest a `apps/mobile` (vegeu el seu `README.md` i `AGENTS.md`). Eines: ADR-0010.
- **Qualitat:** ESLint, Prettier, `tsconfig.base.json` i hooks de commit (husky + lint-staged + commitlint) a l'arrel (TG-67, ADR-0010).
- **API:** scaffold fet (TG-68): Express 5 a `services/api` amb `/api/v1/health`, errors uniformes, entorn validat i OpenAPI generat amb zod + zod-to-openapi (`/api/v1/openapi.json`, `/api/v1/docs`; ADR-0011). Vegeu `services/api/README.md`.
- **Supabase** (TG-69): `supabase/` amb la configuració del CLI (Postgres 17) i les migracions; la primera activa PostGIS a l'esquema `extensions`. Flux de migracions: `docs/onboarding.md` → secció 5.
- **Endpoint de punts** (TG-88): `GET /api/v1/punts`, un sol GeoJSON en memòria amb `ETag`, 304 i `?bbox=` (ADR-0012). `index` és el de l'hora en curs (worker, TG-99) o `null`, i el document es regenera quan el worker acaba una execució. `DATABASE_URL` és opcional: sense ella, `/punts` respon 503. **Fitxa** (TG-92): `GET /api/v1/punts/{id}` amb les metadades, la foscor (`sqm`) i l'índex de l'hora en curs i de les `?hores=` següents (1–48, per defecte 24); tipus `PuntFitxa`. Vegeu `services/api/README.md`.
- **Recomanacions** (TG-100): `GET /api/v1/recomanacions` amb la consulta de «Què vols veure?» (`ConsultaRecomanacions` → `RecomanacionsResposta`): punts publicats dins del radi (temps en cotxe a 60 km/h amb desviament ×1,3, fins que hi hagi Mobilicat) ordenats per la millor hora de l'índex a la franja, la mitjana i la distància (`limit`, per defecte 20). La nit va de les 12:00 de `data` a les 12:00 de l'endemà, com a TG-104. L'índex v1 és el mateix per a tots els objectius (ADR-0018). **«A prop meu»** (TG-133): només `lat`/`lon` són obligatoris; per defecte, la nit que toca (a partir de les 06:00, la que ve; `upcomingNight`) sencera des de l'hora actual, 60 minuts en cotxe i `cel_estrellat` (`ParametresRecomanacions`, `resolConsulta`). **«On veure-ho»** (TG-140, HU11): amb `esdevenimentId` (el `codi` de `/esdeveniments/{id}`; no va amb `data`, `desDe` ni `finsA`), la franja és la finestra de l'esdeveniment (`recomanacions/finestra.ts`): `[inici, fi]` si les hores són conegudes; amb precisió de dia, la nit del màxim o, si ja ha passat i encara dura, la nit que toca retallada a `[inici, fi]`. La resposta porta `esdeveniment` i, sense índex a la finestra, `avis: 'sense_previsio'`; inexistent → 404 `event_not_found`.
- **Visibilitat d'una ubicació** (TG-130, ADR-0031): `GET /api/v1/visibilitat?lat&lon&hora` calcula al moment l'índex v1 de qualsevol lloc de Catalunya (límit oficial de l'ICGC amb 1,5 km de marge, generat per `data/scripts/build-contorn-catalunya.ts`; fora, 422 `fora_de_catalunya`) per a l'hora en curs o fins a 72 h endavant, amb el codi de `@talaia/index` (`packages/index`: Open-Meteo, Astronomy Engine i fórmula, compartit amb el worker). La previsió de cada cel·la de 0,01° es guarda en una memòria cau LRU fins al minut 5 de l'hora següent (`X-Cache: HIT|MISS|STALE`; si Open-Meteo falla, la caducada de fins a 6 h), amb 20 consultes noves per client (429 `too_many_requests`) i 250 en total (503 `meteo_unavailable`) per hora; la foscor és l'SQM del punt publicat a 1 km o menys, mesurada només si és de la mateixa cel·la. Tipus `VisibilitatUbicacio`.
- **Base de dades** (TG-86): taula `punts_observacio` (PostGIS, RLS sense polítiques) i paquet `packages/db` (`@talaia/db`): `createDb`, tipus generats amb `npm run db:types` i helpers de PostGIS. L'API compila amb tsup. `supabase db reset` carrega els seeds de `supabase/seeds/`. Vegeu `packages/db/README.md`.
- **Commit inicial** (TG-112): `packages/shared` amb els tipus de domini, i mòdul MVVM de referència a `apps/mobile/src/features/apiStatus` (guia «Afegir una pantalla nova» a `apps/mobile/README.md`). A `stable` s'hi arriba amb `release/0.1.0` al final del sprint (ADR-0009).
- **Design system** (TG-113): tokens del Figma (colors, tipografia, moviment) i components base a `apps/mobile/src/shared/ui`. Taula i regles: `docs/design-system.md`.
- **Worker · meteo** (TG-95, TG-114): `services/worker` amb la ingesta de la previsió d'Open-Meteo per punt (núvols per capes, humitat, visibilitat, temperatura, punt de rosada, precipitació i vent; tipus `PrevisioMeteoHora` a `@talaia/shared`). Prova manual: `npm run meteo -w services/worker -- lat,lon`. La persistència amb `@talaia/db` (taula de previsions) encara no hi és. Vegeu `services/worker/README.md`.
- **Worker · observacions** (TG-115): `services/worker/src/meteocat` amb el client de la XEMA de Meteocat (`METEOCAT_API_KEY`, opcional), les taules `estacions_xema` i `lectures_xema` i l'estació més propera a cada punt (`punts_observacio.estacio_xema`). El procés horari (`meteocat/planificacio.ts`) hi baixa cada dia a les 06:15 UTC (i en arrencar) les lectures dels dies que falten fins ahir, com a molt 4, i actualitza les estacions el dia 1 de cada mes i en arrencar si no n'hi ha cap (ADR-0025); sense la clau, no planifica res i ho avisa al log. L'ajust de l'índex és TG-184. Prova: `npm run xema -w services/worker -- CC [YYYY-MM-DD]`.
- **Worker · astronomia** (TG-96): `packages/index/src/astronomia.ts` (`@talaia/index`, ADR-0031) amb Astronomy Engine (sense API externa, ADR-0004): posició del Sol i de la Lluna, fase, franja de crepuscle per hora (`efemeridesHores`, alineable amb la previsió) i esdeveniments d'una nit (`nitAstronomica`: posta i sortida del Sol, crepuscles civil/nàutic/astronòmic, sortida i posta de la Lluna). Tipus `EfemeridesHora` i `NitAstronomica` a `@talaia/shared`. Prova manual: `npm run astro -w services/worker -- lat,lon [YYYY-MM-DD]`.
- **Worker · horari** (TG-99): `services/worker/src/main.ts` recalcula l'índex de tots els punts en arrencar i cada hora amb node-cron (ADR-0024) i deixa cada execució a `execucions_worker`, que l'API fa servir com a versió del mapa (ADR-0012). Prova: `npm run start -w services/worker` amb `DATABASE_URL`.
- **Worker · alertes** (TG-153, HU17, ADR-0033): després de desar l'índex, cada execució avalua les alertes actives de comptes no bloquejats (punts publicats dins del radi, hores que queden de la nit en curs, índex ≥ mínim; les de `hora_avis`, només a l'execució d'aquella hora local i amb la nit d'avui) i desa a `notificacions_alertes` el millor punt, hora i índex, com a molt un per alerta i nit (clau `(alerta_id, nit)`). Un error no fa fallar el recàlcul (`execucions_worker.error_alertes`). La nit és a `@talaia/shared` (`nit.ts`), que ara admet codi pur (ADR-0028). **Enviament** (TG-154): a cada execució, les files sense `enviada_el` amb la millor hora encara per passar i l'índex actual encara per sobre del mínim es **reserven** (`update … where enviada_el is null returning`, sense duplicats entre execucions) i s'envien per l'Expo Push Service (`fetch`, `alertes/expoPush.ts`) a tots els tokens de `dispositius_push` del perfil, amb `data: { puntId }`; si Expo n'accepta alguna, es desen els `ticket_ids`, si no, es desfà la reserva i es reintenta a l'execució següent; `DeviceNotRegistered` esborra el token. Només envia amb `ENVIA_PUSH=true` (el compose de la VM l'activa; un worker local, no). `EXPO_ACCESS_TOKEN` és opcional. A l'app, `useOpenNotifiedPoint` obre la fitxa en tocar-la (només amb sessió). Codi a `services/worker/src/alertes/`.
- **Worker · índex** (TG-98): fórmula de l'índex v1 a `packages/index/src/formula.ts` (`@talaia/index`, codi pur compartit amb l'API, ADR-0031; ADR-0018: els núvols i el Sol multipliquen, la foscor i la Lluna es ponderen; franges 0–39/40–69/70–100) i taula `index_visibilitat` (una fila per punt i hora, amb els factors). La foscor és provisional (0,6) fins a TG-97. Prova manual: `npm run index -w services/worker -- lat,lon [sqm]`.
- **Índex v2** (TG-184, ADR-0037): la Lluna amagada pel relleu (perfil `punts_observacio.horitzo`) fa la meitat de llum, i la humitat a partir del 85 % baixa el cel fins a 0,7 (`FORMULA_V2` a `packages/index`). `index_visibilitat.versio` = 2 i `humitat_corregida`. `meteocat/ajust.ts` calcula cada dia el biaix de la humitat per estació (XEMA menys Open-Meteo de nit, 14 dies, 48 parelles com a mínim) i el recàlcul l'aplica als punts a menys de 25 km i 350 m d'altitud, durant 7 dies com a màxim.
- **Foscor del cel** (TG-97): la Generalitat serveix el mapa de contaminació lumínica (brillantor del cel al zenit, SQM en mag/arcsec², malla d'1 km) com a capa WFS, no com a fitxer. `data/scripts/build-mapa-foscor.ts` la descarrega i la rasteritza a GeoTIFF amb geotiff.js (`data/raw/`, no versionat) i `fill-sqm.ts` omple l'`sqm` de cada punt al GeoJSON, d'on surt el seed i la columna `punts_observacio.sqm` (ADR-0020). És el valor que `calculaIndexHores` rep com a `sqm`; `null` = fora del mapa (foscor estimada). `data/` és un workspace: `npm test -w data`.
- **Desglossament de l'índex** (TG-104): `GET /api/v1/punts/{id}/index?nit=YYYY-MM-DD` retorna l'índex d'un punt una nit hora a hora amb els factors (`DesglossamentIndex` a `@talaia/shared`), llegit de la taula `index_visibilitat`. Una nit va de les 12:00 locals del dia al migdia de l'endemà (`packages/shared/src/nit.ts`, que també fa servir el worker). És el que consumeix el component de HU04 (TG-105).
- **CI** (TG-70): lint, typecheck i tests de l'app, de l'API, del worker, de `@talaia/db` i de `@talaia/index` a cada PR; SonarCloud preparat (`docs/ci.md`).
- **RNF** (TG-182): primera mesura (11/11) a `docs/rnf.md`, amb com repetir-la: `npm run rnf:api` per al p95 de l'API (RNF02) i els tests d'accessibilitat i de contrast de l'app (RNF05).
- **Inici de sessió** (TG-249): sense sessió l'app obre la benvinguda (`useSessionGate`). Google pel navegador (PKCE, `expo-web-browser`), Apple a iOS (ADR-0016): natiu (`expo-apple-authentication`) als builds natius i pel navegador a Expo Go, que no porta el mòdul (Services ID `cat.talaia.web`, secret que caduca el 2027-04-20) i correu a `/benvinguda-correu`, amb codi de 6 xifres o amb l'enllaç (`auth/correu`, PKCE); després de cada login, `POST /api/v1/perfil` (i `GET`/`PATCH /perfil` per llegir-lo i editar-ne el nom, TG-165; `DELETE /perfil` elimina el compte i, en cascada, totes les dades, TG-167). Supabase rebutja redirects amb IP: a Expo Go, `REACT_NATIVE_PACKAGER_HOSTNAME=<ip>.nip.io`. Un 403 `account_blocked` (compte bloquejat) mostra l'avís de `AccountBlockedScreen` fins que es tanca la sessió (TG-179). Vegeu `apps/mobile/README.md`. **Correu** (TG-252, P21): el codi s'envia pel Gmail de l'equip; `npm run supabase:correu` aplica al projecte del núvol l'SMTP, les plantilles de `supabase/templates/` i el límit de correus (`docs/onboarding.md` → secció 5).
- **Token de notificacions** (TG-152, ADR-0028): taula `dispositius_push` (un perfil, diversos dispositius; token únic) i `PUT`/`DELETE /api/v1/perfil/dispositius` (`DispositiuPush` a `@talaia/shared`). A l'app, `expo-notifications`: amb sessió i permís, `usePushRegistration` registra l'Expo push token, i el treu en tancar la sessió; `usePushPermission()` dona l'estat del permís a la pantalla d'alertes. A Expo Go i al simulador no hi ha token: les push es proven amb el development build d'Android (`expo-dev-client`, `eas.json`). Vegeu `apps/mobile/README.md`.
- **Admin i bloqueig** (TG-177, ADR-0029): `perfils.rol` (`usuari`|`admin`, es canvia amb SQL) i `perfils.bloquejat`. Totes les rutes d'usuari fan servir el `requireUser` de `services/api/src/routes/index.ts`, que respon 403 `account_blocked` als comptes bloquejats; les d'admin, a més, `requireAdmin` (403 `forbidden`). `GET /api/v1/admin/usuaris` i `PATCH /api/v1/admin/usuaris/{id}` amb `{ bloquejat }`. **Punts** (TG-174, HU39): `GET`/`POST /api/v1/admin/punts` i `GET`/`PATCH /api/v1/admin/punts/{id}` (`PuntAdmin`, `PuntAdminNou` i `PuntAdminCanvis` a `@talaia/shared`). Retirar és `PATCH` amb `{ "estat": "DESACTIVAT" }`: no s'esborra mai cap punt. Cada canvi descarta el document de `/punts` (`MapDocumentCache.invalidate()`), i la fitxa, `/recomanacions` i el worker ja només llegeixen els `PUBLICAT`. Només passen de `PUBLICAT` a `DESACTIVAT` i al revés (els `PENDENT` i `REBUTJAT` són de la moderació, 409 `moderation_required`), i el punt de referència d'Aprop no es pot retirar. Un punt nou no té `sqm` ni `horitzo` (foscor estimada); moure'l més de 10 m n'esborra l'índex, l'`horitzo` i l'`sqm` antic, i l'estació XEMA més propera s'assigna al moment (`estacioXemaMesPropera` de `@talaia/db`, la mateixa del worker). Vegeu `services/api/README.md`.
- **Alertes** (TG-145, HU16): taula `alertes` (objectiu, origen PostGIS, `distancia_max_km` 1–200, `index_minim` 0–100, quan avisa amb `avisa_en_arribar` i/o `hora_avis` 0–23 (almenys un, TG-146), `activa`; `perfil_id` amb `on delete cascade`) i `POST`/`GET /api/v1/alertes` i `PATCH /api/v1/alertes/{id}` (activar o desactivar i editar, TG-147) i `DELETE /api/v1/alertes/{id}` (204; 404 si no és seva, TG-150) amb el `requireUser` comú (403 `account_blocked`): el perfil surt sempre del token i cadascú només veu les seves. Com a molt 20 alertes per usuari (409 `alert_limit_reached`). Tipus `Alerta`, `AlertaNova` i `AlertaCanvis` a `@talaia/shared`. Vegeu `services/api/README.md`.
- **Favorits** (TG-169, HU25–HU27): taula `favorits` (clau `(perfil_id, punt_id)`, `on delete cascade` des de `perfils` i `punts_observacio`) i `POST`/`GET /api/v1/favorits` i `DELETE /api/v1/favorits/{puntId}` amb `requireUser`: el perfil surt del JWT i cadascú només veu els seus. `POST` i `DELETE` són idempotents; `GET` només llista els punts publicats, amb l'índex de l'hora en curs (l'app hi mira si un punt és favorit). Tipus `Favorit` i `FavoritNou` a `@talaia/shared`. Vegeu `services/api/README.md`.
- **Plans** (TG-156, HU12): taula `plans` (punt, `esdeveniment_id` opcional = el `codi` de `/esdeveniments/{id}`, `data_hora_inici`, `data_hora_fi` opcional i posterior, `calendari_event_id`, `notes`; `perfil_id` amb `on delete cascade`) i `POST`/`GET /api/v1/plans` (`?quan=futurs|passats`) i `GET /api/v1/plans/{id}` amb `requireUser`: el perfil surt del JWT i un pla d'un altre usuari és un 404 `plan_not_found`. El `POST` només accepta punts publicats i esdeveniments públics (422 `punt_not_found`/`event_not_found`), com a molt 20 plans pendents (409 `plan_limit_reached`) i un per punt i hora (409 `plan_already_exists`), i retorna el mateix `Pla` que el `GET`; sense `data_hora_fi`, un pla dura fins al final de la nit de l'inici (`?quan=`); el pla d'un punt retirat després continua sortint amb `punt.publicat: false`. Tipus `Pla`, `PlaNou` i `QuanPlans` a `@talaia/shared`. Vegeu `services/api/README.md`.
- **Pla d'observació** (TG-157, mockup 06): «Crea un pla» de la fitxa obre `/pla/nou` amb el punt i, si n'hi ha, la millor franja de la nit (`inici` i `fi`, ISO): l'inici és l'hora de sortida i el final s'envia com a `dataHoraFi`, amb la mateixa durada si es mou la sortida. Dia, hora de sortida (hora del mòbil → UTC amb `localToIso`; els tests de l'app corren amb `TZ=Europe/Madrid`, `jest.timezone.js`), fenomen opcional dels de `/esdeveniments` del dia ± 1 (es treu si el dia canvia i hi queda fora) i notes; `POST /plans` i, si l'usuari ho demana, afegeix l'esdeveniment al calendari natiu (`expo-calendar`, ADR-0036; la funció requereix una build compatible, no Expo Go, i sense hora final el calendari reserva dues hores). Codi a `apps/mobile/src/features/plans/`.
- **Els meus plans** (TG-160, HU13, mockup 13): fila «Els meus plans» a Perfil (només amb sessió) → `/plans` (`app/plans/index.tsx`, a la pila arrel). Pastilles «Propers» i «Passats» amb `GET /plans?quan=` (`usePlansQuery`, `queryKey: [...PLANS_KEY, quan, idioma]`: el `invalidateQueries({ queryKey: PLANS_KEY })` de «Crea un pla» refresca les dues); els passats es demanen en obrir-los. Cada fila: dia i mes, el nom del fenomen (una sola crida a `/esdeveniments` per llista, `planEventsRange`) o «Cel estrellat» amb el municipi, i la sortida en hora del mòbil; obre la fitxa del punt, si no s'ha retirat. Sense l'índex de cada pla ni «Veure'ls al calendari» (TG-158). Codi a `apps/mobile/src/features/plans/`.
- **Explora** (TG-101): la pestanya d'inici és «Què vols veure?» (mockup 02): què, des d'on (ubicació actual amb `expo-location`), quan i fins a quant temps en cotxe. «Troba el millor lloc» obre el mapa a `/recomanacions` amb la consulta (`ConsultaRecomanacions` a `@talaia/shared`) com a paràmetres de la ruta.
- **Rànquing sobre el mapa** (TG-102, mockup 03): amb una cerca, `/recomanacions` crida `GET /api/v1/recomanacions` i ensenya la cerca a dalt, només els punts del rànquing al mapa (amb l'índex de la millor hora) i els millors punts en un full fix a baix; cada fila obre la fitxa. Sense cerca («Mostra el mapa»), tot el catàleg amb l'índex de l'hora en curs; de dia (`index.deDia`), els punts surten en gris amb un avís. Codi a `apps/mobile/src/features/recommendations/`.
- **Nova alerta** (TG-146, mockup 11): la pestanya Alertes és una pila (`(tabs)/(alertes)`) i el botó «Nova alerta» obre `/nova-alerta`: fenomen, origen (ubicació actual amb `useOriginField`, compartit amb Explora, o una zona triada movent un mapa sota una agulla, `ZonePickerMap`), distància en temps de cotxe (es desa en km a 60 km/h ×1,3, com `/recomanacions`), índex mínim amb la barra pintada per franges i quan avisar (en arribar-hi i/o a una hora). `POST /api/v1/alertes` (TG-145) amb `avisaEnArribar` i `horaAvis` (almenys un). Codi a `apps/mobile/src/features/alerts/`. La pestanya Alertes (TG-148, mockup 10) llista les alertes (`GET /alertes`) amb un interruptor (`Toggle`) que fa `PATCH /alertes/{id}` amb `{ activa }` (TG-147) de forma optimista. **Editar una alerta** (TG-149, HU18): prémer una alerta de la llista obre `/alerta/[id]`, la mateixa pantalla amb els valors desats (`useNewAlertViewModel(alerta)`; l'alerta surt de la llista ja carregada); l'origen hi surt com a zona i el `PATCH` envia només els camps canviats (`alertChanges`).
- **Mapa** (TG-89): MapLibre GL JS 6 en una DOM component d'Expo (el *worker* es carrega d'un Blob, `apps/mobile/src/core/map/maplibreWorker.ts`), amb l'estil nocturn de l'ICGC, terreny 3D i cel de nit (ADR-0015). Tota l'app es prova a **Expo Go**; cap mòdul natiu que Expo Go no porti sense ADR (ADR-0014). Identificador: `cat.talaia.app`.
- **Web d'administració a la VM** (TG-176): `/admin/` (`base` de Vite), compilada a la imatge de Nginx (`deploy/nginx/Dockerfile`, multi-stage) amb `SUPABASE_URL` i `SUPABASE_ANON_KEY` (pública, obligatòria al compose) com a `VITE_*`. Fallback a l'`index.html` per a les rutes internes, 404 als recursos que no existeixen, `index.html` sense cache i `/admin/assets/` `immutable`, CSP pròpia (`connect-src 'self'` + Supabase) i capçaleres comunes a `deploy/nginx/snippets/seguretat.conf`. Vegeu `docs/desplegament.md` → «Web d'administració».
- **Desplegament** (TG-71): `deploy/compose.yaml` (Nginx + API + acme.sh; worker horari inclòs) a la VM de la FIB, HTTPS al 8080 amb DuckDNS + Let's Encrypt DNS-01, i deploy de `stable` per pull: un cron de la VM executa `deploy/scripts/desplega.sh` cada 5 minuts, sense runner (ADR-0021). Secrets a `/opt/talaia/.env` a la VM. Si un deploy falla, `deploy/scripts/avisa.sh` envia un correu des del Gmail de l'equip (un per fallada i un quan es recupera; variables `ALERT_*`, sense elles no fa res; TG-180, ADR-0035). Vegeu `docs/desplegament.md` i ADR-0019.

## Stack (decidit, no reobrir sense ADR)

| Capa | Tecnologia |
|---|---|
| App mòbil | React Native + TypeScript amb **Expo** (EAS Build, Expo Push), arquitectura **MVVM** |
| Mapa | **MapLibre GL JS** en una DOM component d'Expo + tessel·les vectorials i relleu 3D de l'**ICGC** (estil nocturn propi; ADR-0015) |
| Web d'administració | Vite + React + TypeScript (estàtica, servida per Nginx; ADR-0030) |
| API | **Node.js + TypeScript + Express**, REST a `/api/v1`, documentada amb **OpenAPI** |
| Worker | Procés Node.js que recalcula l'índex **cada hora** (índex precalculat, no a cada petició) |
| Dades | **Supabase**: PostgreSQL + **PostGIS**, Auth (Google, Apple, correu → JWT), Storage |
| Accés a dades | Migracions SQL del CLI de Supabase + **Kysely** a `packages/db` (tipus amb `kysely-codegen`, RLS sense polítiques; ADR-0013) |
| Infra | VM Ubuntu amb **Docker Compose** (API + worker + Nginx), HTTPS amb Let's Encrypt |
| CI | GitHub Actions: lint + typecheck + tests a cada PR, anàlisi de qualitat (SonarCloud) |
| i18n | i18next (ca per defecte, es, en) |

Per què cada peça i què es va descartar: `docs/arquitectura.md`.

## Ordres

```bash
nvm use && npm install        # a l'arrel (npm workspaces)
npm run mobile                 # Expo Go (tota l'app, mapa inclòs)
npm run api                    # API amb recàrrega (http://localhost:3000/api/v1/docs)
npm run typecheck && npm test  # tots els workspaces
npm run lint                   # ESLint a tot el repo
npm run format                 # Prettier (format:check per comprovar-ho)
npm run db:types               # tipus de Kysely de la base de dades local (després d'una migració)
```

Un workspace nou estén `tsconfig.base.json` de l'arrel i no necessita configuració d'ESLint pròpia.

Dins d'`apps/mobile`, les dependències natives s'afegeixen amb `npx expo install`.

## Estructura del monorepo

```
apps/mobile        App React Native (Expo) — MVVM
apps/admin         Web d'administració (React)
services/api       API REST Express (/api/v1, OpenAPI)
services/worker    Worker horari de l'índex de visibilitat
packages/shared    Tipus i models compartits (PuntObservacio, Esdeveniment, IndexVisibilitat…)
packages/db        Accés a la base de dades amb Kysely: createDb, tipus generats i helpers de PostGIS
packages/index     Càlcul de l'índex compartit pel worker i l'API: client d'Open-Meteo, Astronomy Engine i fórmula
data/              Dades estàtiques i scripts de preprocés (GeoTIFF, seeds) — els fitxers grans NO es versionen
docs/              Context, decisions (ADR), sprint, contractes d'API
```

Regla: un tipus de domini s'escriu **una sola vegada** a `packages/shared` i el consumeixen l'app, l'admin, l'API i el worker, sempre amb `import type` (el paquet no té build; vegeu el seu README).

## Convencions

- **TypeScript strict** a tot arreu. Res de `any` sense comentari que ho justifiqui.
- **Idioma:** identificadors de codi en anglès; textos de l'app sempre via i18n (claus en anglès, valors ca/es/en); documentació, issues i PR en català.
- **MVVM a l'app:** `View` (components, sense lògica) → `ViewModel` (hook `useXxxViewModel`, estat i accions) → `Model`/`Repository` (accés a l'API). Les pantalles no criden l'API directament.
- **Design system:** tots els colors, tipografies i espaiats surten dels tokens (`docs/design-system.md`). Cap color "a mà" a les pantalles.
- **Moviment i fluïdesa:** l'app ha de ser molt estètica i fluida. Animacions amb Reanimated (només `transform`/`opacity`), esquelets en lloc d'spinners, resposta al tacte i 60 fps comprovats al dispositiu: regles a `docs/design-system.md`.
- **API:** REST, recursos en català tal com estan acordats amb altres equips (`/punts`, `/recomanacions`, `/esdeveniments`). Errors amb format uniforme `{ error: { code, message } }`. Tota ruta nova es documenta a l'OpenAPI a la mateixa PR.
- **Tests:** Jest (a la web d'administració, Vitest: ADR-0034). Cada ViewModel i cada servei de domini amb tests. La fórmula de l'índex és codi pur i 100 % testejable.
- **Secrets:** mai al repositori (és **públic**). `.env.example` documenta les variables; els valors reals van a `.env` (ignorat) i als secrets de GitHub.
- **Bugs:** segueix `docs/gestio-bugs.md`. Si detectes un defecte preexistent o fora de l'abast de la tasca, informa'n la persona responsable amb passos per reproduir-lo; no creïs una issue ni n'iniciïs la correcció sense confirmar-ho amb ella. Els errors d'una tasca en curs es resolen dins de la mateixa tasca.

## Flux de Git (obligatori): Gitflow + Conventional Commits 1.0.0

Detalls i receptes: `docs/git-workflow.md` (ADR-0009).

- **Gitflow** amb els noms de l'assignatura: `snapshot` = `develop` (per defecte), `stable` = `main` (una versió etiquetada per sprint, `v0.N.0`), `prod` = versió publicada.
- Branques de suport: `feature/TG-<ref>-descripcio-curta` des de `snapshot` i de tornada a `snapshot`; `release/0.N.0` des de `snapshot` cap a `stable` i `snapshot`; `hotfix/0.N.x` des de `stable` cap a `stable` i `snapshot`. No hi ha altres prefixos (res de `fix/`, `docs/`…: tot el que no és release ni hotfix és una feature).
- Tot entra per **pull request** amb CI en verd i **1 revisió aprovada**, fusionada amb merge commit. Ningú fa push directe a `snapshot`, `stable` ni `prod`.
- **Revisions i conflictes:** un push a una PR descarta les aprovacions (ruleset: `dismiss_stale_reviews_on_push`). Per això, actualitza la branca amb `snapshot` només just abans de demanar la revisió final, mai després d'una aprovació; una PR aprovada i verda es fusiona el mateix dia; i abans d'obrir o fusionar una PR, mira si toca fitxers que ja toquen altres PR obertes (`docs/git-workflow.md` → «Pull requests»).
- **Estat:** `CLAUDE.md` no porta una línia per funcionalitat ni per PR: l'estat va a `docs/sprint-<N>.md` o a Taiga.
- **Commits:** [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/): `<tipus>(<àmbit>): <descripció>` amb el peu **`Refs: TG-<ref>`** obligatori (l'assignatura exigeix lligar cada commit a Taiga). Canvi incompatible: `!` i/o peu `BREAKING CHANGE:`.

  ```
  feat(api): afegeix GET /punts amb filtre per bbox

  Refs: TG-88
  ```

## Definition of Done

Especificada → implementada → provada (tests a la CI) → revisada (PR aprovada) → documentada (OpenAPI / memòria) → integrada a `snapshot`.

## Com ha de treballar Claude Code aquí

1. Identifica la tasca de Taiga (ref `TG-xx`) i llegeix-ne la descripció i els criteris d'acceptació de la història (`docs/sprint-<N>.md` del sprint de la tasca).
2. Crea la branca `feature/TG-<ref>-…` des de `snapshot` actualitzada i, abans d'obrir la PR, comprova que no xoqui amb fitxers de les PR obertes (`/obre-pr` ho fa).
3. Respecta el stack i les convencions; si una decisió no està presa, consulta `docs/decisions/pendents.md` i **pregunta** abans d'inventar-la.
4. Escriu tests i actualitza l'OpenAPI / docs a la mateixa PR.
5. Missatges de commit i descripció de PR seguint la convenció; plantilla a `.github/pull_request_template.md`.
6. L'estat de la tasca a Taiga es canvia a mà (`docs/git-workflow.md` → «Integració Taiga ↔ GitHub»): «In progress» en començar, «Ready for test» en obrir la PR i tancada en fusionar. Els commits no porten etiquetes d'estat (`TG-<ref> #<estat>`): només el peu `Refs: TG-<ref>`.

### Eines del repositori (`.claude/`)

- **Skills:**
  - `/tasca TG-<ref>`: comença una tasca;
  - `/obre-pr`: verifica la branca i obre la PR;
  - `/revisa-pr <núm>`: revisa la PR d'un company, i no la publica sense ok;
  - `/nou-adr <títol>`: ADR nova amb el número lliure següent.
- **Agents:**
  - `revisor`: revisa un diff, només llegint;
  - `verificador`: executa el lint, el typecheck i els tests dels workspaces afectats.
- **Regles per àrea** (`.claude/rules/`): es carreguen soles quan es toca `supabase/`, `apps/mobile/`, `services/` i `packages/`, o `docs/decisions/`. Hi ha les trampes que ja ens han passat.
- **`settings.json`:**
  - permet sense preguntar les ordres que només llegeixen o comproven;
  - pregunta abans d'un `push --force`, d'un `gh pr merge` i d'un `db push`;
  - no deixa llegir els `.env`.

  La configuració personal va a `.claude/settings.local.json` i a `CLAUDE.local.md`, que estan ignorats. Mapa i com afegir-ne: `.claude/README.md`.

## Enllaços

- Repositori: https://github.com/pes2627q1-22-gei-upc/talaia
- Entorn local i flux d'una tasca per a persones: `docs/onboarding.md`
- Taiga: https://tree.taiga.io/project/mohamed-dari-pes_22_c_talaia
- Documentació de l'assignatura i lliurables: Google Drive, carpeta `PES_22_C_TALAIA` (no al repo).
