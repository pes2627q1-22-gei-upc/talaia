# ADR-0028: Notificacions push amb Expo Push Service, enviades pel worker; development build per provar-les a Android

**Estat:** Proposada · **Data:** 2026-11-10 · TG-151

## Context

La HU17 demana una notificació push quan, després d'un recàlcul, un punt dins de la zona d'una alerta activa supera l'índex mínim. Com a molt n'hi pot haver una per alerta i nit, i en tocar-la s'ha d'obrir la fitxa del punt. Sense permís de notificacions, l'app ha de continuar funcionant. Les alertes (`public.alertes`: `perfil_id`, `objectiu`, `origen`, `distancia_max_km`, `index_minim`, `activa`) són de la TG-145. La feina es reparteix així: la TG-152 fa el permís i el registre del token, la TG-153 avalua les alertes al worker, la TG-154 envia les notificacions i obre la fitxa, i la TG-155 en fa els tests.

Què es va comprovar a la documentació d'Expo de l'SDK 58 (`expo-notifications` ~58.1.8, encara no instal·lat a `apps/mobile`):

- **Expo Go no rep push remotes a Android des de l'SDK 53.** Les notificacions locals sí que hi funcionen. La referència del mòdul només parla d'Android, però les FAQ de push diuen que, des de l'SDK 53, Expo Go no en suporta a cap plataforma i que cal un *development build*. Per tant, no ens podem refiar d'Expo Go a iOS.
- `getExpoPushTokenAsync()` necessita el `projectId` d'EAS. El pren de `Constants.easConfig.projectId` o de `expo.extra.eas.projectId`, que ja és a `app.json`. Si no el troba, falla amb `ERR_NOTIFICATIONS_NO_EXPERIENCE_ID`. Com que fa una petició als servidors d'Expo, pot fallar sense xarxa.
- A Android 13 o posterior, el diàleg de permís no surt fins que existeix algun canal (`setNotificationChannelAsync`). El canal s'ha de crear abans de demanar el token. A iOS, l'estat del permís es mira a `ios.status`.
- El token d'Expo no caduca. Es manté si s'actualitza l'app, però a Android pot canviar si es reinstal·la. Si l'app es desinstal·la, l'enviament torna `DeviceNotRegistered`.
- Per enviar: `POST https://exp.host/--/api/v2/push/send`, amb un màxim de 100 missatges per petició, 600 notificacions per segon i projecte i 4 KiB de *payload*. El *ticket* només diu que Expo ha rebut el missatge. El *receipt* (`/push/getReceipts`) es demana uns 15 minuts després i desapareix al cap de 24 hores. La llibreria oficial és `expo-server-sdk` 8.0.0, en ESM i per a Node ≥ 22.12, que agrupa, limita la concurrència i reintenta.
- Credencials. Android necessita una clau de compte de servei de FCM V1, que es puja a EAS i mai al repositori. iOS necessita una clau d'APNs, que EAS genera amb el compte d'Apple Developer de pagament que el projecte ja té ([ADR-0016](0016-sign-in-with-apple-ios.md)).

## Decisió

### Servei: Expo Push Service

- A l'app, **`expo-notifications`** (`npx expo install expo-notifications`, amb el seu *config plugin* a `app.json`). Al worker, **`expo-server-sdk`**.
- Es desa l'**Expo push token** (`ExponentPushToken[…]`), no el token natiu del dispositiu. Expo l'envia a FCM o a APNs segons la plataforma.

### Token: taula `dispositius_push` i endpoint de l'API

Proposta, perquè la concreti la TG-152:

- **Migració:** `public.dispositius_push`, amb `id`, `perfil_id` (FK a `perfils`, `on delete cascade`), `token text not null unique`, `plataforma` (`ios` o `android`), `data_creacio` i `data_actualitzacio`. Té RLS sense polítiques, com la resta ([ADR-0013](0013-acces-bd-kysely.md)). Un perfil pot tenir diversos dispositius, i un token només pot ser d'un perfil: si al mateix mòbil hi entra una altra persona, la fila passa al perfil nou (`on conflict (token) do update set perfil_id = …`).
- **Endpoints**, amb JWT ([ADR-0023](0023-validacio-jwt-jwks.md)) i el `requireUser` de l'[ADR-0029](0029-rol-admin-i-bloqueig.md) (un compte bloquejat rep un 403 `account_blocked`). Es documenten a l'OpenAPI:
  - `PUT /api/v1/perfil/dispositius` amb `{ token, plataforma }`, validat amb zod (el token ha de tenir el format `ExponentPushToken[…]`). És un *upsert* idempotent i respon `204`.
  - `DELETE /api/v1/perfil/dispositius/{token}` (el token, amb `encodeURIComponent`). Treu el token del perfil que fa la petició i respon `204`, també si ja no hi era. El token queda als logs d'accés de Nginx. S'accepta, perquè amb la seguretat reforçada (vegeu «Credencials») el token sol no permet enviar res. Si es vol evitar, es pot esborrar pel camp `id` del dispositiu.
- **Quan el registra l'app:**
  - Després de cada inici de sessió i cada vegada que s'obre amb sessió, si hi ha permís. Hi ha `addPushTokenListener` per si el token canvia.
  - El permís es demana des de la pantalla d'alertes, en crear-ne una, i no en obrir l'app.
  - En tancar la sessió, primer es fa el `DELETE` i després `signOut`. El `DELETE` és *best-effort*: si falla, el `signOut` es fa igualment. Pot fallar per un 403 d'un compte bloquejat, perquè no hi ha xarxa o perquè passa un temps límit curt. Així, el «Tanca la sessió» de la pantalla de compte bloquejat continua funcionant. El token que queda el descarta el worker, que no envia res als comptes bloquejats.
  - Sense permís, no es registra res, i la pantalla d'alertes ho indica (criteri 4).

### Qui envia: el worker, després d'avaluar les alertes

- Dins del procés horari ([ADR-0024](0024-planificacio-worker-node-cron.md)), quan el recàlcul acaba: primer s'avaluen les alertes (TG-153) i després s'envien les notificacions (TG-154), a `services/worker/src/alertes/`. Tant l'avaluació com l'enviament són funcions amb ports injectables, que es proven sense xarxa (TG-155). L'API no envia res: les alertes depenen del recàlcul, que és al worker.
- **Una per alerta i nit.** S'afegeix la taula `notificacions_alertes`, amb `alerta_id` (FK, `on delete cascade`), `nit date`, `punt_id`, `index`, `enviada_el` i els `ticket_ids`, i amb **clau primària `(alerta_id, nit)`**. La `nit` és la de 12:00 a 12:00 local de la TG-104 (`services/api/src/index/night.ts`): el codi s'ha de compartir, no copiar. Abans d'enviar, el worker fa `insert … on conflict do nothing returning`, i només envia si la fila és nova. Així, una execució repetida o solapada no notifica dues vegades. Si l'enviament falla després de la inserció, aquella nit l'alerta es perd: és preferible a enviar-la dues vegades.
- **Contingut:**
  - Un missatge per alerta, adreçat a tots els tokens del perfil.
  - Només compten les alertes `activa = true` de perfils **no bloquejats** (`perfils.bloquejat = false`, ADR-0029). El worker llegeix la BD directament i no passa per `requireUser`, així que el filtre ha de ser a la consulta.
  - Només compten les hores de la nit que **encara no han passat**. El worker recalcula cada hora i la nit va de 12:00 a 12:00, i una execució de les 04:00 no pot anunciar la millor hora de les 23:00. Si no queda cap hora futura que superi el mínim, no s'envia res, i la nit tampoc no queda marcada.
  - El punt és el millor dels que superen el mínim, amb l'hora i l'índex al text.
  - Porta `channelId: 'alertes'` (el canal que crea l'app a Android), `sound: 'default'` i `data: { puntId }`.
  - El text, de moment en català. L'idioma del perfil queda per quan existeixi.
- **Tokens invàlids: els neteja el worker.** Si un *ticket* torna `DeviceNotRegistered`, s'esborra la fila de `dispositius_push` de seguida. Els *receipts* de l'execució anterior (més de 15 minuts i menys de 24 hores) es llegeixen a l'execució horària següent, i els `DeviceNotRegistered` també s'esborren. Els altres errors (`MessageRateExceeded`, `InvalidCredentials`…) queden al log i no esborren res.

### Deep link: `data: { puntId }` obre `/punt/[id]`

- La TG-154 posa un *hook* al `_layout.tsx` arrel, com el `useNotificationObserver` de la guia d'Expo Router. Llegeix `useLastNotificationResponse()` per a l'arrencada en fred i `addNotificationResponseReceivedListener` amb l'app oberta, i fa `router.push({ pathname: '/punt/[id]', params: { id: puntId } })`, igual que el mapa i les recomanacions. Després, l'app esborra la resposta perquè no es torni a obrir. La documentació de l'SDK 58 marca `clearLastNotificationResponse()` com a obsoleta i, alhora, el mateix exemple d'Expo Router la fa servir. L'alternativa és `clearLastNotificationResponseAsync()`, i la TG-154 ha de comprovar quina toca amb els tipus de la versió que s'instal·li.
- La navegació espera que `useSessionGate` hagi resolt i només obre la fitxa si l'usuari té sessió i no està bloquejat. Sense sessió, l'app va a la benvinguda. Amb el compte bloquejat (`'blocked'`), es queda a l'avís. `punt/[id]` és a l'stack arrel, fora de `(tabs)`, i sense aquesta comprovació la notificació se saltaria l'avís.
- S'envia `puntId` i no una URL: l'app valida el que rep, i la ruta continua sent cosa de l'app.

### Excepció a l'ADR-0014: development build per provar les push

Opcions:

| Opció | A favor | En contra |
|---|---|---|
| **Development build amb EAS** (`expo-dev-client`, perfil `development`, APK de distribució interna) | Rep push reals a Android. Es fa el build un sol cop i després es treballa amb Metro, com a Expo Go. Amb el compte d'Apple també es pot fer per a iOS. | Cal un `eas.json` i `expo-dev-client`. Cada mòdul natiu nou demana un build nou, i el pla gratuït d'EAS té un límit de builds al mes. Les credencials de FCM i d'APNs s'han de configurar a EAS. |
| **Provar a iOS amb Expo Go** | No cal cap build. | La documentació d'Expo diu que l'SDK 53 o posterior no ho suporta. A més, només ho podria provar qui tingui iPhone. |
| **Només notificacions locals a Expo Go** | No cal cap build, funciona a les dues plataformes i prova el *deep link*. | No prova ni el token, ni el registre, ni l'enviament del worker, ni FCM i APNs. |

**Recomanació:**

- El **development build amb EAS per a Android** és l'entorn de proves de les push.
- La resta de l'app continua a Expo Go, i la regla de l'ADR-0014 («cap mòdul natiu que Expo Go no porti») es manté per a tot el que no siguin les push.
- Les **notificacions locals** (`scheduleNotificationAsync`, amb el mateix `data`) serveixen per provar el *deep link* a Expo Go, i l'eina de prova d'Expo (expo.dev/notifications) serveix per enviar a un token sense el worker.
- A Expo Go, l'app **no demana el token**: si `Constants.executionEnvironment === ExecutionEnvironment.StoreClient`, se salta el registre, i la pantalla d'alertes ho indica en lloc de fallar.
- El build d'iOS (*ad hoc*, amb els dispositius registrats al compte d'Apple) només es fa si l'equip el necessita per a la demo.

### Credencials: mai al repositori

- El **`projectId`** d'EAS (`ef610e9c-…`, ja a `app.json`) no és secret: identifica el projecte.
- **FCM V1:**
  - La clau del compte de servei (JSON) es puja a EAS amb `eas credentials` (Android → Google Service Account) o des del panell d'Expo. **No es desa mai al repositori, que és públic.** Si s'ha de baixar en local, va a una ruta ignorada per `.gitignore`.
  - El `google-services.json` (`android.googleServicesFile`) només conté identificadors públics. Expo diu que es pot versionar, però el projecte de Firebase ha de ser del compte de l'equip (P20).
- **APNs:** la clau la genera i la guarda EAS amb el compte d'Apple Developer del projecte. No surt d'EAS.
- **Access token d'Expo:** recomanem activar la seguretat reforçada de push al panell d'Expo. Llavors el worker envia amb `EXPO_ACCESS_TOKEN`, un secret de la VM, i ningú que tingui un token d'un usuari pot enviar-li notificacions.

## Conseqüències

- **App (TG-152, TG-154):**
  - S'afegeixen `expo-notifications` i `expo-dev-client`, amb els *config plugins* a `app.json`, i un `eas.json` amb el perfil `development`. Això actualitza la conseqüència de l'ADR-0014 que deia «no hi ha `expo-dev-client` ni `eas.json`».
  - Cal un mòdul MVVM per al permís i el token, amb tests del ViewModel, i textos via i18n.
  - Amb Expo Go s'hi pot continuar treballant: les push només es proven al development build.
  - Amb `expo-dev-client` instal·lat, `npx expo start` obre per defecte el development build, i el QR ja no obre Expo Go. Per això `npm run mobile` (`apps/mobile/scripts/start.mjs`) hi afegeix `--go` per defecte, i `npm run mobile -- --dev-client` obre el build. S'explica a `apps/mobile/README.md` (TG-152).
- **API (TG-152):** la migració de `dispositius_push`, els dos endpoints, l'OpenAPI i els tests.
- **Worker (TG-153, TG-154, TG-155):**
  - La migració de `notificacions_alertes` i la dependència `expo-server-sdk`, que és ESM i demana Node ≥ 22.12. Cal comprovar que tsup l'empaqueta.
  - L'avaluació i l'enviament van després de cada recàlcul. Si fallen, no han de fer fallar l'execució de l'índex: l'error queda al log i a `execucions_worker`.
  - Unes poques alertes per hora queden molt lluny dels límits d'Expo.
- **Desplegament:**
  - `EXPO_ACCESS_TOKEN` va a `.env.example`, sense valor, i a `/opt/talaia/.env` de la VM, i el servei `worker` de `deploy/compose.yaml` el rep.
  - Sense la variable, el worker envia igual mentre la seguretat reforçada estigui desactivada. Si està activada, Expo respon `UNAUTHORIZED`, i queda al log.
  - Cal aplicar les dues migracions abans del deploy que les fa servir.
- **Comptes (P20):**
  - Firebase va al compte de Google de l'equip, i les credencials de FCM i d'APNs, a EAS (`owner: talaia.pes`).
  - Si les credencials es revoquen, els *receipts* tornen `InvalidCredentials`: cal tornar-les a pujar amb `eas credentials`.
- **Per a més endavant:** franja silenciosa (de nit, ara s'envia quan toca el recàlcul), idioma de la notificació segons el perfil i reintent d'un enviament fallit.
