# ADR-0033: Avaluació de les alertes al worker: una consulta, una decisió pura i una notificació per alerta i nit

**Estat:** Proposada · **Data:** 2026-11-11 · TG-153, TG-155 · Concreta l'[ADR-0028](0028-notificacions-push.md)

## Context

La HU17 demana que, quan després d'un recàlcul un punt dins de la zona d'una alerta activa supera l'índex mínim, l'usuari rebi una notificació push, com a molt una per alerta i nit, i que en tocar-la s'obri la fitxa del punt. Les alertes (`public.alertes`: `perfil_id`, `objectiu`, `origen`, `distancia_max_km`, `index_minim`, `activa`) són de la TG-145.

L'[ADR-0028](0028-notificacions-push.md) ja va decidir qui envia (el worker, després del recàlcul), la taula `notificacions_alertes` amb clau primària `(alerta_id, nit)`, que la nit de 12:00 a 12:00 es comparteix des de `@talaia/shared` i que només compten les hores de la nit que encara no han passat. Quedava per decidir, per a la TG-153:

- En quin moment exacte de l'execució s'avaluen les alertes i què passa si alguna cosa falla.
- Què vol dir «supera l'índex mínim» i quin punt es tria si n'hi ha diversos.
- Com fer-ho sense una consulta per alerta i punt cada hora.
- Què rep la TG-154, que envia les notificacions, i com s'hi connecta.

L'índex v1 és el mateix per a tots els objectius ([ADR-0018](0018-formula-index-v1.md)); l'índex per objectiu ([ADR-0027](0027-index-per-objectiu.md)) encara és una proposta.

## Decisió

### Quan: dins de cada execució, amb l'índex ja desat

- `recalculaIndex` ([ADR-0024](0024-planificacio-worker-node-cron.md)) té un port opcional, `alertes`. El crida després de desar l'índex de tots els lots i d'esborrar l'antic, i abans de registrar l'execució. `main.ts` hi connecta `createAlertsStep` (`services/worker/src/alertes/`).
- S'avaluen si l'execució ha desat l'índex d'**algun** punt, també si n'ha fallat algun lot: és el mateix criteri que fa servir l'API per renovar el mapa. Si no n'ha desat cap (Open-Meteo caigut), no: l'índex no ha canviat.
- Si el procés s'està aturant (`SIGTERM`), no s'avaluen: ho farà l'execució d'arrencada.
- **Un error de les alertes no fa fallar el recàlcul.** L'`estat` de l'execució continua sent el de l'índex, l'error va al log i a la columna nova `execucions_worker.error_alertes`, i `execucions_worker.notificacions` compta les notificacions noves (`null` si no s'han avaluat). Així es compleix el que demanava l'ADR-0028 («l'error queda al log i a `execucions_worker`») sense barrejar-lo amb l'error de l'índex.

### Quines hores: les que queden de la nit en curs

- La nit en curs és la de l'instant de l'avaluació (`defaultNight`), i la finestra va de l'**hora en curs** (inclosa, com al mapa) fins a les 12:00 locals de l'endemà (`alertsWindow`). Els dies del canvi d'hora la nit dura 23 o 25 hores.
- El codi de la nit **es mou** de `services/api/src/index/night.ts` a `packages/shared/src/nit.ts`, com demanava l'ADR-0028. L'API hi deixa l'esquema zod de `?nit=` i reexporta la resta, de manera que cap ruta ni cap servei de l'API no canvia. `@talaia/shared` passa a tenir `main: src/index.ts`, com `@talaia/db`, i es treu la regla d'ESLint que només hi deixava importar tipus.
- Una execució de les 12:05 ja avalua la nit que comença. Si cap hora no arriba al mínim, no es desa res i la nit queda lliure: una previsió millor a les 20:05 encara pot notificar.

### Què compta: la decisió és una funció pura

`pickNotifications(candidats, finestra)` decideix, per a cada alerta, si hi ha notificació i amb quin punt:

- **Compleix** si l'alerta és activa, el punt és a `distancia_max_km` o menys de l'`origen` (en línia recta, sobre l'esferoide), l'hora és a la finestra i l'índex és **≥ `index_minim` i més gran que 0**. «Supera» es llegeix com «arriba a», igual que el camp `indexMinim` de l'API. Un índex 0 no notifica mai: vol dir que no hi ha res a veure (de dia o amb el cel tapat), i amb un mínim de 0 l'alerta avisaria a migdia.
- **El millor**, si n'hi ha diversos: el de més índex; si empaten, el punt més proper; si encara empaten, l'hora més d'hora. L'identificador del punt desempata la resta, perquè el resultat no depengui de l'ordre de les files.
- **Objectiu:** a la v1 tots fan servir el mateix índex. El candidat porta l'`objectiu` de l'alerta, i l'única peça que canviarà amb l'índex per objectiu (TG-184) és el *join* del repositori amb `index_visibilitat`, on s'afegirà `iv.objectiu = a.objectiu`.

### Com: una consulta i una inserció

- `candidates(finestra)` és **una sola consulta** per a totes les alertes: `alertes` × `punts_observacio` (`st_dwithin` sobre `geography` amb el radi de cada alerta; `dinsRadi` de `@talaia/db` ara accepta un radi que és una expressió) × `index_visibilitat` (per la clau `(punt_id, hora)`). Ja deixa fora les alertes inactives, les que ja tenen notificació aquesta nit (`not exists` sobre la clau primària), les hores fora de la finestra i els índexs per sota del mínim o 0.
- L'SQL només fa de **filtre gruixut**: no deixa fora res que `pickNotifications` acceptaria. La regla (les condicions i els desempats) és a la funció pura, que es prova sense base de dades.
- Volum: alertes actives × punts dins del radi × hores bones que queden. Amb el catàleg de 32 punts i les alertes del curs, uns centenars de files cada hora. Si creix, la consulta es pot reduir amb `distinct on (alerta_id, punt_id)` sense tocar la decisió.
- `saveNotifications` fa **un sol** `insert … on conflict (alerta_id, nit) do nothing returning alerta_id` i torna només les notificacions noves. La clau primària garanteix una per alerta i nit, també si dues execucions coincideixen.

### Taula `notificacions_alertes`

La de l'ADR-0028, amb dues columnes més: `alerta_id` (FK a `alertes`, `on delete cascade`), `nit date`, `punt_id` (FK a `punts_observacio`, `on delete cascade`), **`hora`** (la millor, en UTC), `index`, **`data_creacio`**, `enviada_el` i `ticket_ids`, amb clau primària `(alerta_id, nit)` i RLS sense polítiques. La TG-153 omple les cinc primeres i deixa `enviada_el` i `ticket_ids` a `null` per a la TG-154.

### Lliurament a la TG-154

- `evaluateAlerts(repositori, ara)` torna `{ nit, notificacions }`, **només les noves**. Cadascuna porta `alertaId`, `perfilId` (per buscar els tokens a `dispositius_push`), `objectiu`, `puntId` (el `data: { puntId }` que obre la fitxa), `puntNom`, `hora`, `index` i `distanciaKm`, prou per al text sense cap consulta més.
- La TG-154 només ha de tocar `createAlertsStep`: envia les notificacions que torna `evaluateAlerts` i, en acabar, omple `enviada_el` i `ticket_ids` de cada fila (`where alerta_id = … and nit = …`). Els errors d'enviament poden anar al mateix `error_alertes`. Es manté el que diu l'ADR-0028: només s'envia una fila nova, i si l'enviament falla, aquella nit es perd (la fila queda amb `enviada_el` a `null`, com a rastre).
- **Sense permís de notificacions** (criteri 4 de la HU17): el perfil no té cap token a `dispositius_push`, la notificació es desa igualment i la TG-154 no envia res. L'avaluació no depèn de l'app.
- `pg` llegeix una columna `date` com un `Date` a la mitjanit **local del procés**: per llegir la `nit` de la taula, millor `nit::text`, o la `nit` (text) que ja porta la notificació.

## Alternatives descartades

- **Una consulta per alerta (o per alerta i punt):** N × M viatges a la base de dades cada hora.
- **Tota la decisió a l'SQL** (`distinct on (alerta_id) … order by valor desc, distancia, hora`): menys files, però la regla quedaria només en un lloc que els tests sense base de dades no poden comprovar.
- **Avaluar a `main.ts` o a l'executor, després de `recalculaIndex`:** el recàlcul llança un error si falla un sol lot, i mentre un punt fallés cada hora, ningú no rebria alertes. A més, l'error de les alertes no podria anar a la fila de l'execució.
- **Avaluar només si l'execució és `ok`:** pel mateix motiu.
- **Desar la notificació només en enviar-la (TG-154):** desar-la en avaluar separa les dues tasques, permet provar l'avaluació sola i deixa rastre del que s'ha decidit encara que l'enviament falli.
- **Copiar la nit al worker:** dues definicions que poden divergir. L'ADR-0028 ja demanava compartir-la.

## Conseqüències

- Migració `20261111130000_crea_notificacions_alertes.sql`: la taula i les columnes `notificacions` i `error_alertes` d'`execucions_worker`. S'ha d'aplicar, amb la d'`alertes` (TG-145), abans del deploy que porti aquest worker.
- `notificacions_alertes` creix com a molt una fila per alerta i nit bona. Si molesta, es pot purgar com l'índex antic.
- Tests (TG-155): la finestra (migdia, matinada, estiu i hivern, les nits de 23 i 25 hores i el canvi d'any), la decisió (mínim, 0, radi, alertes inactives, hores passades i de la nit següent, desempats i ordre de les files), la no repetició amb un repositori en memòria que fa de clau primària i amb l'SQL de Kysely, i l'aïllament dels errors dins del recàlcul. Els de l'enviament arriben amb la TG-154.
- **Pendent de validar amb l'equip:**
  1. «Arriba a» (≥) i no «supera» (>), i que un índex 0 no notifica mai.
  2. Notificar tan aviat com una execució troba una hora bona (des de les 12:05 per a la nit que ve), sense franja silenciosa (l'ADR-0028 ja la deixava per a més endavant) i sense tornar a avisar si la previsió canvia.
  3. Els objectius que la v1 no avalua bé (`posta_sol`, `sortida_sol`, `eclipsi`) fan servir l'índex del cel estrellat. L'app els marca «Aviat», però `POST /alertes` els accepta. Si fos el cas, avisarien d'una bona nit estrellada. Es poden deixar fora a `pickNotifications` fins a l'índex per objectiu.
  4. **Perfils bloquejats** ([ADR-0029](0029-rol-admin-i-bloqueig.md)): l'ADR-0028 vol que la consulta no en tingui en compte les alertes. Aquesta branca surt de la TG-145, que encara no porta `perfils.bloquejat`. Quan s'hi integri `snapshot`, la consulta de candidats hi afegeix el *join* amb `perfils` i `not bloquejat`, amb el seu test. Mentrestant, la TG-154 ho ha de filtrar en buscar els tokens (l'ADR-0028 ja diu que el worker no envia res als comptes bloquejats).
