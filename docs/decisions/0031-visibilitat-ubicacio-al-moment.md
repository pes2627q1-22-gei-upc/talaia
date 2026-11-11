# ADR-0031: L'índex d'una ubicació qualsevol es calcula al moment a l'API, amb memòria cau, i el càlcul es comparteix amb el worker a `@talaia/index`

**Estat:** Proposada · **Data:** 2026-11-11 · TG-130, TG-132 (HU05)

## Context

HU05 ([TG-28](https://tree.taiga.io/project/mohamed-dari-pes_22_c_talaia/us/28)) demana tocar qualsevol lloc del mapa dins de Catalunya i veure'n l'índex per a l'hora triada, en menys de 3 s, que una segona consulta del mateix lloc i hora surti de la memòria cau, i un missatge clar fora de Catalunya o sense dades.

L'[ADR-0004](0004-index-precalculat.md) ja ho preveia: el worker precalcula els punts del catàleg i «un punt arbitrari del mapa es calcula al moment i es guarda en memòria cau», amb la fórmula «compartida entre worker i API». Però:

- El client d'Open-Meteo, el càlcul astronòmic i la fórmula v1 eren a `services/worker/src`. L'API no pot importar res d'una altra aplicació del monorepo.
- `@talaia/shared` només té tipus. L'[ADR-0028](0028-notificacions-push.md) hi admet codi pur **sense dependències** (la nit de TG-153), però l'astronomia necessita `astronomy-engine` i el client d'Open-Meteo, `zod`.
- La foscor del cel (SQM) de cada punt surt d'un GeoTIFF que no es versiona ni és al contenidor ([ADR-0020](0020-foscor-sqm-geotiff.md)): l'API només té l'`sqm` dels punts del catàleg.
- La quota d'Open-Meteo (10.000 crides al dia, sense clau) és compartida amb el worker, que en gasta unes 940. Nginx limita a 20 peticions per segon i IP (TG-253), però una consulta d'un lloc nou és una crida a Open-Meteo.
- La URL de la consulta porta la ubicació de qui la fa (TG-253: `Cache-Control` privat i registre d'accés sense la query).

## Decisió

### El càlcul, al paquet `packages/index` (`@talaia/index`)

- `openMeteo.ts`, `astronomia.ts` i `formula.ts`, amb els seus tests, passen del worker a `packages/index` amb `git mv` (es conserva l'historial). El worker i l'API els importen de `@talaia/index`. Al worker s'hi queden la planificació, la persistència, la XEMA, el calendari i les CLI de prova.
- Com `@talaia/db`: sense build (`tsx` i `ts-jest` llegeixen el TypeScript), el `tsup` de cada servei l'inclou dins del seu `dist/`, i les dependències (`astronomy-engine`, `zod`) es llegeixen de `node_modules`. Els `Dockerfile` copien `packages/index`, la CI en passa els tests i `deploy-check` s'activa si canvia.
- L'índex v2 (TG-184, [ADR-0027](0027-index-per-objectiu.md)) es farà en aquest paquet, i arribarà alhora als punts del catàleg i a les ubicacions qualssevol.

### `GET /api/v1/visibilitat?lat&lon&hora`

- Pública, com `/punts` i `/recomanacions`. `hora` és opcional (per defecte, ara), un instant ISO 8601 amb zona, i compta l'hora UTC que el conté. Es pot consultar des de l'hora en curs fins a **72 hores** endavant, el que cobreixen sempre els 4 dies de previsió.
- **Resposta** (`VisibilitatUbicacio` a `@talaia/shared`): `lat` i `lon` de la cel·la on s'ha calculat, `sqm` (o `null`), `index` (`IndexHora`, els mateixos factors que la fitxa d'un punt) i `deDia`, com al mapa.
- **Dins de Catalunya:** un polígon simplificat d'uns 70 vèrtexs, traçat a mà a partir de pobles, cims i caps de la frontera, amb un marge d'1 a 3 km cap enfora per terra i de 5 a 25 km mar endins, i sense Andorra (`services/api/src/visibilitat/catalunya.ts`, codi pur amb tests als dos costats de cada frontera i amb els 32 punts del catàleg). Fora: **422 `fora_de_catalunya`**.
- **D'on surt cada dada:**
  - Previsió: Open-Meteo per a la **cel·la**, la ubicació arrodonida a **0,01°** (~1 km, com la malla dels models més fins que fa servir Open-Meteo).
  - Efemèrides: Astronomy Engine a la cel·la i l'hora, sense altitud.
  - Foscor: l'**SQM del punt publicat més proper**, si n'hi ha un a **5 km** o menys (PostGIS, `st_dwithin` i ordenat per distància). Si no, `null`, i la fórmula fa servir la foscor estimada (0,6) amb `foscorEstimada: true`, com ja fa amb els punts sense SQM. Sense `DATABASE_URL`, o si la base de dades falla, també `null`: l'endpoint no depèn de la base de dades.
  - Horitzó: cap. La v1 no el fa servir; a la v2 (ADR-0027), un lloc sense perfil fa servir 0°.

### Memòria cau

- **En memòria del procés de l'API**, una entrada per cel·la: la previsió des de l'hora en curs i l'SQM. Qualsevol hora d'una cel·la que ja hi és en surt; les efemèrides i la fórmula es calculen a cada petició (menys d'1 ms).
- **Caduca al minut 5 de l'hora següent** (UTC), quan el worker també torna a demanar la previsió ([ADR-0024](0024-planificacio-worker-node-cron.md)). Si l'hora demanada no hi és (la previsió es va demanar fa una hora i 72 h endavant ja en queda fora), es torna a demanar.
- **Com a molt 500 cel·les** (unes 40 KB cadascuna, uns 20 MB). En passar-se'n, surt la que fa més temps que no es fa servir (LRU).
- **Les peticions simultànies de la mateixa cel·la comparteixen una sola crida** a Open-Meteo, com el document del mapa ([ADR-0012](0012-punts-mapa-geojson.md)). Els errors no es desen.
- Capçalera **`X-Cache: HIT | MISS`** (`HIT`: la previsió ja hi era), documentada a l'OpenAPI: és com es comprova el criteri de la segona consulta. **`Cache-Control: private, max-age=<fins a la propera hora>`**, com `/recomanacions`, perquè la URL porta la ubicació.

### La quota d'Open-Meteo i els errors

- **Com a molt 250 peticions a Open-Meteo per hora** (UTC) des de l'API: amb 13 variables, unes 325 crides per hora i 7.800 al dia en el pitjor cas, que amb les del worker queden per sota de les 10.000. Passat el sostre, **503 `meteo_unavailable`** fins a l'hora següent; les cel·les que ja són a la memòria cau es continuen servint.
- **Timeout de 5 s** per a Open-Meteo a l'API (15 s al worker). El criteri és menys de 3 s (un *miss* triga uns 0,5 s), però és millor una resposta lenta que un error.
- Errors: 400 `validation_error` (`lat`, `lon` o `hora` mal formats), 422 `fora_de_catalunya`, 422 `hora_sense_previsio` (abans de l'hora en curs, més enllà de 72 h, o una hora que Open-Meteo no ha tornat) i 503 `meteo_unavailable` (Open-Meteo no respon o s'ha arribat al sostre). El 422 és el de l'`objectiu_no_suportat` de l'ADR-0027: la petició és ben formada, però no se'n pot donar l'índex. Les coordenades no surten mai al log.

## Alternatives descartades

- **Copiar la fórmula a l'API:** dues implementacions que divergirien a la primera (TG-184).
- **Importar de `services/worker` a l'API:** la imatge de l'API arrossegaria el worker (node-cron, la XEMA) i una app no és una llibreria.
- **Posar-ho a `@talaia/shared`:** el paquet de tipus que llegeix l'app passaria a tenir dependències, cosa que l'ADR-0028 hi exclou.
- **Que el worker calculi les ubicacions qualssevol** (una cua o una crida de l'API al worker): un canal nou entre tots dos per a una operació d'1 ms més una crida HTTP.
- **El GeoTIFF de l'SQM dins de la imatge de l'API:** la foscor seria exacta a tot arreu, però el ràster no es versiona (ADR-0020) i el build dependria d'un preprocés amb descàrrega. Es pot afegir més endavant darrere del mateix port (`sqmProper`).
- **Una caixa (bbox) per a Catalunya:** hi entrarien Andorra, la Franja, el nord del País Valencià, la Catalunya Nord i molt de mar.
- **La memòria cau per cel·la i hora** (el resultat, no la previsió): una crida a Open-Meteo per cada hora consultada, quan una sola en porta quatre dies.
- **Desar les consultes a la base de dades:** no cal per al criteri, i en reiniciar l'API, la memòria cau es torna a omplir sola.

## Conseqüències

- L'índex d'un lloc qualsevol i el dels punts del catàleg surten de la mateixa fórmula i la mateixa previsió (en una hora, la mateixa generació d'Open-Meteo).
- A **la majoria de llocs, la foscor és estimada**: els 32 punts del catàleg, amb 5 km de radi, cobreixen menys del 8 % de Catalunya. Es veu a la resposta (`foscorEstimada`) i l'app ho pot dir.
- El polígon és aproximat a menys de 2 km de la frontera: un poble de la ratlla pot caure al costat que no és.
- Si mai hi ha més d'una instància de l'API, no compartiran la memòria cau ni el sostre de peticions.
- L'API llegeix `OPEN_METEO_BASE_URL` (opcional, amb la URL pública per defecte), també al `compose.yaml`.
- L'app (TG-131, mockup 04) mostra un missatge per a cada codi: `fora_de_catalunya`, `hora_sense_previsio` i `meteo_unavailable`.
- **Per validar amb l'equip:** el radi de 5 km per a l'SQM (o portar el ràster a l'API), el sostre de 250 peticions per hora, la cel·la de 0,01°, el marge del polígon i que la ruta sigui pública com la resta de lectures.
