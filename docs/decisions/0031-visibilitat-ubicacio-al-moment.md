# ADR-0031: L'índex d'una ubicació qualsevol es calcula al moment a l'API, amb memòria cau, i el càlcul es comparteix amb el worker a `@talaia/index`

**Estat:** Proposada · **Data:** 2026-11-11, revisada el 2026-11-12 amb la revisió de la PR #129 · TG-130, TG-132 (HU05)

## Context

HU05 ([TG-28](https://tree.taiga.io/project/mohamed-dari-pes_22_c_talaia/us/28)) demana tocar qualsevol lloc del mapa dins de Catalunya i veure'n l'índex per a l'hora triada, en menys de 3 s, que una segona consulta del mateix lloc i hora surti de la memòria cau, i un missatge clar fora de Catalunya o sense dades.

L'[ADR-0004](0004-index-precalculat.md) ja ho preveia: el worker precalcula els punts del catàleg i «un punt arbitrari del mapa es calcula al moment i es guarda en memòria cau», amb la fórmula «compartida entre worker i API». Però:

- El client d'Open-Meteo, el càlcul astronòmic i la fórmula v1 eren a `services/worker/src`. L'API no pot importar res d'una altra aplicació del monorepo.
- `@talaia/shared` només té tipus. L'[ADR-0028](0028-notificacions-push.md) hi admet codi pur **sense dependències** (la nit de TG-153), però l'astronomia necessita `astronomy-engine` i el client d'Open-Meteo, `zod`.
- La foscor del cel (SQM) de cada punt surt d'un GeoTIFF que no es versiona ni és al contenidor ([ADR-0020](0020-foscor-sqm-geotiff.md)): l'API només té l'`sqm` dels punts del catàleg.
- La quota d'Open-Meteo (10.000 crides al dia, sense clau) és compartida amb el worker, que en gasta unes 940. Nginx limita a 20 peticions per segon i IP (TG-253), però una consulta d'un lloc nou és una crida a Open-Meteo. L'API no tenia cap límit propi ni llegia l'adreça del client.
- La URL de la consulta porta la ubicació de qui la fa (TG-253: `Cache-Control` privat i registre d'accés sense la query).

## Decisió

### El càlcul, al paquet `packages/index` (`@talaia/index`)

- `openMeteo.ts`, `astronomia.ts` i `formula.ts`, amb els seus tests, passen del worker a `packages/index` amb `git mv` (es conserva l'historial). El worker i l'API els importen de `@talaia/index`. Al worker s'hi queden la planificació, la persistència, la XEMA, el calendari i les CLI de prova.
- Com `@talaia/db`: sense build (`tsx` i `ts-jest` llegeixen el TypeScript), el `tsup` de cada servei l'inclou dins del seu `dist/`, i les dependències (`astronomy-engine`, `zod`) es llegeixen de `node_modules`. Els `Dockerfile` copien `packages/index`, la CI en passa els tests i `deploy-check` s'activa si canvia.
- L'índex v2 (TG-184, [ADR-0027](0027-index-per-objectiu.md)) es farà en aquest paquet, i arribarà alhora als punts del catàleg i a les ubicacions qualssevol.

### `GET /api/v1/visibilitat?lat&lon&hora`

- Pública, com `/punts` i `/recomanacions`. `hora` és opcional (per defecte, ara), un instant ISO 8601 amb zona, i compta l'hora UTC que el conté. Es pot consultar des de l'hora en curs fins a **72 hores** endavant, el que cobreixen sempre els 4 dies de previsió.
- **Resposta** (`VisibilitatUbicacio` a `@talaia/shared`): `lat` i `lon` de la cel·la on s'ha calculat, `sqm` (o `null`), `index` (`IndexHora`, els mateixos factors que la fitxa d'un punt) i `deDia`, com al mapa.
- **Dins de Catalunya:** el **límit oficial de l'ICGC**. `data/scripts/build-contorn-catalunya.ts` descarrega del WFS de les Divisions administratives la capa de províncies 1:50.000 (CC BY 4.0) i en fa la unió: com que la font és topològica, n'hi ha prou de treure els segments que surten en dues províncies i encadenar la resta. El simplifica amb Douglas-Peucker a **200 m**, en treu els illots de menys de 0,02 km² i les dàrsenes de port, i l'escriu com a MultiPolygon versionat a `services/api/src/visibilitat/contornCatalunya.ts` (12 polígons, uns 1.300 vèrtexs). Hi ha l'enclavament de Llívia, i Andorra en queda fora. Com amb l'SQM i l'horitzó ([ADR-0020](0020-foscor-sqm-geotiff.md), [ADR-0022](0022-perfil-horitzo-icgc.md)), la font es descarrega amb un script, i el que es versiona és el resultat, que es pot revisar.
  - Un lloc és dins si és dins del contorn o a **1,5 km** o menys de la ratlla (`MARGE_M`). El marge és més gran que la simplificació, i així cap lloc de Catalunya no queda fora. A l'altra banda de la ratlla, o mar endins, compten com a dins els llocs a menys d'1,3–1,7 km: la costa, els ports, la Guingueta d'Ix.
  - Codi pur i ràpid (uns 4 µs per consulta). Els tests hi passen els 32 punts del catàleg, la costa, el delta de l'Ebre, la Val d'Aran, Llívia i els trossos de Gimenells, el Pla de la Font, Alcarràs, Almacelles, Massalcoreig, Almatret, Riba-roja d'Ebre, Os de Balaguer, Batea i Maçanet de Cabrenys que el primer polígon, traçat a mà, deixava fora. També hi ha llocs d'Andorra, França, l'Aragó i el País Valencià, tots a més de 2 km de la ratlla, que han de quedar fora.
  - Fora: **422 `fora_de_catalunya`**.
- **D'on surt cada dada:**
  - Previsió: Open-Meteo per a la **cel·la**, la ubicació arrodonida a **0,01°** (~1 km, com la malla dels models més fins que fa servir Open-Meteo).
  - Efemèrides: Astronomy Engine a la cel·la i l'hora, sense altitud.
  - Foscor: l'**SQM del punt publicat més proper**, si n'hi ha un a **1 km** o menys, que és la mida de la cel·la del mapa de foscor (PostGIS, `st_dwithin` i ordenat per distància).
    - **Només és mesurada si el punt és a la mateixa cel·la** de 0,01°. Si és d'una cel·la veïna, el valor es fa servir, però `index.foscorEstimada` és `true`: un valor prestat no es presenta mai com a mesurat.
    - Si no hi ha cap punt prou a prop, `sqm` és `null` i la fórmula fa servir la foscor estimada (0,6), com amb els punts sense SQM.
    - La consulta té un **timeout d'1 s** i una memòria cau pròpia. Si la base de dades falla o tarda, la foscor és estimada, no es desa i la petició següent ho torna a provar. Així un pool ocupat (5 connexions) no alenteix un *miss*, i un error no queda desat amb la previsió.
    - Sense `DATABASE_URL`, sempre estimada: l'endpoint no depèn de la base de dades.
  - Horitzó: cap. La v1 no el fa servir; a la v2 (ADR-0027), un lloc sense perfil fa servir 0°.

### Memòria cau

- **En memòria del procés de l'API**, una entrada per cel·la amb la previsió des de l'hora en curs, i una altra memòria cau per a l'SQM de la cel·la. Qualsevol hora d'una cel·la que ja hi és en surt; les efemèrides i la fórmula es calculen a cada petició (menys d'1 ms).
- **Caduca al minut 5 de l'hora següent** (UTC), quan el worker també torna a demanar la previsió ([ADR-0024](0024-planificacio-worker-node-cron.md)). Si l'hora demanada no hi és (la previsió es va demanar fa una hora i 72 h endavant ja en queda fora), es torna a demanar.
- **Com a molt 500 cel·les** (unes 40 KB cadascuna, uns 20 MB). En passar-se'n, surt la que fa més temps que no es fa servir (LRU).
- **Les peticions simultànies de la mateixa cel·la comparteixen una sola crida** a Open-Meteo, com el document del mapa ([ADR-0012](0012-punts-mapa-geojson.md)). Els errors no es desen.
- **Previsió caducada:** si Open-Meteo falla o s'arriba a un dels límits, se serveix la previsió caducada de la cel·la, si en fa menys de **6 hores** i té l'hora demanada. L'LRU no la treu fins que hi ha massa entrades. Una previsió de fa unes hores és millor que un 503, i suavitza el sostre global.
- Capçalera **`X-Cache`**, documentada a l'OpenAPI. És com es comprova el criteri de la segona consulta, i diu si aquesta petició ha cridat Open-Meteo:
  - `MISS`: l'ha cridat.
  - `HIT`: no l'ha cridat, perquè la previsió ja hi era o l'ha portada una petició simultània, com fa el `proxy_cache_lock` de Nginx.
  - `STALE`: és la previsió caducada.
- **`Cache-Control: private, max-age=<fins a la propera hora>`**, com `/recomanacions`, perquè la URL porta la ubicació.

### La quota d'Open-Meteo i els errors

- **Com a molt 250 peticions a Open-Meteo per hora** (UTC) des de l'API: amb 13 variables, unes 325 crides per hora i 7.800 al dia en el pitjor cas, que amb les del worker queden per sota de les 10.000. Passat el sostre, **503 `meteo_unavailable`** fins a l'hora següent; les cel·les que ja són a la memòria cau es continuen servint, i les caducades també.
- **Com a molt 20 consultes noves per client i hora** (UTC). Una consulta nova és una que crida Open-Meteo (`MISS`): les cel·les a la memòria cau i les que porta una altra petició no hi compten, i un 429 no gasta el sostre global. Passat el límit, **429 `too_many_requests`** amb `Retry-After` (els segons que falten per a l'hora següent), o la previsió caducada si n'hi ha.
  - El client és l'adreça IP. L'API posa `trust proxy` a un salt: Nginx és l'únic proxy (ADR-0019) i afegeix l'adreça real al final de `X-Forwarded-For`, de manera que `req.ip` és aquesta i el client no la pot falsejar.
  - Els comptadors són a la memòria, amb una finestra fixa per hora. Com que només es compta quan es crida Open-Meteo, com a molt hi ha 250 adreces per hora.
  - **Risc residual (acceptat):** 13 adreces diferents (13 × 20 = 260) encara poden esgotar el sostre global, i llavors els llocs nous responen 503 fins a l'hora següent per a tothom, però les cel·les desades i les caducades es continuen servint. Al revés, si diversos usuaris surten per la mateixa IP (un CGNAT mòbil, o el NAT de la FIB si no conserva l'adreça, el mateix risc que té el límit de Nginx de TG-253), es reparteixen les 20 consultes. Si passa, les opcions són un límit per usuari amb el JWT (`requireUser`, la ruta deixaria de ser pública) o una clau d'Open-Meteo.
- **Timeout de 5 s** per a Open-Meteo a l'API (15 s al worker). El criteri és menys de 3 s (un *miss* triga uns 0,5 s), però és millor una resposta lenta que un error.
- Errors: 400 `validation_error` (`lat`, `lon` o `hora` mal formats), 422 `fora_de_catalunya`, 422 `hora_sense_previsio` (abans de l'hora en curs, més enllà de 72 h, o una hora que Open-Meteo no ha tornat), 429 `too_many_requests` (el límit del client) i 503 `meteo_unavailable` (Open-Meteo no respon o s'ha arribat al sostre, sense cap previsió caducada per servir). El 422 és el de l'`objectiu_no_suportat` de l'ADR-0027: la petició és ben formada, però no se'n pot donar l'índex. Les coordenades no surten mai al log.

## Alternatives descartades

- **Copiar la fórmula a l'API:** dues implementacions que divergirien a la primera (TG-184).
- **Importar de `services/worker` a l'API:** la imatge de l'API arrossegaria el worker (node-cron, la XEMA) i una app no és una llibreria.
- **Posar-ho a `@talaia/shared`:** el paquet de tipus que llegeix l'app passaria a tenir dependències, cosa que l'ADR-0028 hi exclou.
- **Que el worker calculi les ubicacions qualssevol** (una cua o una crida de l'API al worker): un canal nou entre tots dos per a una operació d'1 ms més una crida HTTP.
- **El GeoTIFF de l'SQM dins de la imatge de l'API:** la foscor seria exacta a tot arreu, però el ràster no es versiona (ADR-0020) i el build dependria d'un preprocés amb descàrrega. Es pot afegir més endavant darrere del mateix port (`sqmProper`).
- **Una caixa (bbox) per a Catalunya:** hi entrarien Andorra, la Franja, el nord del País Valencià, la Catalunya Nord i molt de mar.
- **Un polígon traçat a mà** (la primera versió d'aquest ADR): la revisió hi va trobar trossos de Catalunya fora, com tres quarts del terme de Gimenells i el Pla de la Font. El límit oficial no costa més i es pot regenerar.
- **Fer servir l'SQM d'un punt a 5 km com a mesurat** (la primera versió): Empuriabrava, un nucli il·luminat, prenia el 20,58 del Cortalet, a 3,6 km, quan el mapa de la Generalitat hi dona de 17,4 a 19,1.
- **Un límit per usuari amb el JWT:** més just que per IP, però la ruta deixaria de ser pública, a diferència de `/punts` i `/recomanacions`. Queda com a opció si el límit per IP no n'hi ha prou.
- **La memòria cau per cel·la i hora** (el resultat, no la previsió): una crida a Open-Meteo per cada hora consultada, quan una sola en porta quatre dies.
- **Desar les consultes a la base de dades:** no cal per al criteri, i en reiniciar l'API, la memòria cau es torna a omplir sola.

## Conseqüències

- L'índex d'un lloc qualsevol i el dels punts del catàleg surten de la mateixa fórmula i la mateixa previsió (en una hora, la mateixa generació d'Open-Meteo).
- A **gairebé tots els llocs, la foscor és estimada**: amb 1 km de radi, els 32 punts del catàleg cobreixen menys de l'1 % de Catalunya, i només els que són a la mateixa cel·la compten com a mesurats. Es veu a la resposta (`foscorEstimada`) i l'app ho pot dir. Portar el ràster de la Generalitat a l'API ho resoldria a tot arreu.
- A menys d'1,5 km de la ratlla, a l'altra banda, també es calcula l'índex (la costa, els ports, els pobles de la frontera). Quan l'ICGC canviï els límits, es torna a executar `build-contorn-catalunya.ts` i el canvi queda al diff.
- Si mai hi ha més d'una instància de l'API, no compartiran la memòria cau, el sostre de peticions ni els comptadors per client.
- L'API llegeix `OPEN_METEO_BASE_URL` (opcional, amb la URL pública per defecte), també al `compose.yaml`.
- L'app (TG-131, mockup 04) mostra un missatge per a cada codi: `fora_de_catalunya`, `hora_sense_previsio`, `too_many_requests` i `meteo_unavailable`.
- **Per validar amb l'equip:**
  - El radi d'1 km per a l'SQM, o portar el ràster a l'API.
  - El sostre de 250 peticions per hora, el límit de 20 per client i el risc residual que comporten.
  - Les 6 hores de previsió caducada.
  - La cel·la de 0,01° i el marge d'1,5 km.
  - Que la ruta sigui pública, com la resta de lectures.
