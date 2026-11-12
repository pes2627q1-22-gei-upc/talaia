# Textos multilingües de l'API (TG-164)

Els textos editorials de fenòmens, esdeveniments i punts s'emmagatzemen en `textos` amb claus
`ca`, `es` i `en`. Els fenòmens importats parteixen de
`data/astronomia/calendaris-2026-2027.json` i `data/astronomia/traduccions-importades.json`;
els calculats els genera `services/worker/src/astronomia/calendari.ts`. Els punts parteixen de
`data/punts_observacio.geojson` i `data/traduccions/punts.json`. Els tres seeds SQL es
regeneren a partir d'aquestes fonts: no s'editen a mà.

La migració de TG-164 afegeix `punts_observacio.textos`. Les columnes catalanes originals
continuen existint per compatibilitat amb l'administració i un trigger manté `textos.ca`
sincronitzat quan s'editen. Els noms oficials de municipis, codis, dates i valors numèrics no es
tradueixen. Els punts creats després de la migració sense traduccions es mostren en català.

L'API llegeix `Accept-Language` en format habitual (`es-ES,es;q=0.9,en;q=0.8`). Només
selecciona ca, es o en; si no hi ha traducció d'un camp, utilitza el català. L'idioma per
defecte és català. Això s'aplica als noms i descripcions d'esdeveniments, la fitxa, el mapa,
la fitxa i les recomanacions de punts i el desglossament de l'índex. El llistat
`GET /api/v1/esdeveniments` amb API key manté el català pactat amb Aprop, encara que el
client enviï `Accept-Language`. Amb JWT sí que segueix la capçalera. No hi ha paràmetre
`?idioma`.

El GeoJSON del mapa té una memòria cau per idioma. Cada variant genera el seu propi ETag i
respon `Vary: Accept-Language`; un `If-None-Match` només dona 304 si correspon al document
de l'idioma demanat. La ruta continua acceptant `bbox`.

Per provar-ho manualment, després d'aplicar la migració i els seeds, arrenqueu l'API amb
`DATABASE_URL` i consulteu `GET /api/v1/punts` amb `Accept-Language: ca`, `es` i `en`.
Compareu `features[0].properties.nom` i l'ETag. Repetiu-ho amb `If-None-Match` de la
resposta catalana: ha de donar 304 en català, però 200 en anglès si el document difereix.
Consulteu també `GET /api/v1/punts/{id}` i, amb un JWT de l'app,
`GET /api/v1/esdeveniments?des_de=2027-08-01&fins_a=2027-08-31`. Amb la clau d'Aprop, el
mateix llistat ha de romandre en català.

La selecció d'idioma a la interfície mòbil i l'enviament sistemàtic d'aquesta capçalera
corresponen a TG-163. Fins que s'integri, la resposta multilingüe es pot verificar amb una
petició HTTP però no pressuposa que el selector de l'app ja la mostri.
