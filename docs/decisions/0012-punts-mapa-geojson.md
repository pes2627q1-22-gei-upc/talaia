# ADR-0012: Els punts del mapa se serveixen com un sol GeoJSON en memòria cau

**Estat:** Acceptada · **Data:** 2026-10-07 (Sprint 1, a proposta del professor)

## Context

El mapa ha de mostrar tots els punts d'observació amb el color del seu índex. Si l'app demana els punts a l'API cada vegada que l'usuari mou el mapa (filtre per bbox) o fa una cerca, cada gest es converteix en una consulta a la base de dades. Amb molts punts i molts usuaris, això escala malament. El professor ens va recomanar desar els punts en una mena de fitxer, de manera que l'app no hagi de fer una crida de llistat i una altra de cerca.

L'índex ja es precalcula cada hora ([ADR-0004](0004-index-precalculat.md)), així que el que veu el mapa només canvia una vegada per hora.

## Decisió

- **Un sol document per al mapa.** `GET /api/v1/punts` retorna un GeoJSON `FeatureCollection` amb **tots** els punts del catàleg. Cada `Feature` porta la geometria (`Point`, WGS84) i les propietats mínimes per dibuixar-lo i cercar-lo: `id`, `nom`, `municipi` i l'índex actual (`index`, valor 0–100 i franja de color). El tipus es defineix una sola vegada a `packages/shared`.
- **Memòria cau HTTP.** El document es construeix una vegada per cada execució del worker i l'API el guarda en memòria. Es respon amb `ETag` (versió de l'última execució del worker) i `Cache-Control` fins a la propera hora. Si l'app envia `If-None-Match` i no ha canviat, l'API respon `304` sense cos.
- **El filtre per bbox es manté com a opcional.** `?bbox=` retalla la mateixa col·lecció. L'app no el fa servir per al mapa.
- **El worker marca la versió.** Després de recalcular l'índex cada hora, el worker deixa constància de l'execució (marca de temps) perquè l'API sàpiga quan ha de regenerar el document.
- **L'app treballa en local.** Descarrega el document una vegada, el desa amb TanStack Query fins a la propera hora i el passa a MapLibre com a font GeoJSON amb `cluster: true`. La cerca per nom i els filtres simples es fan sobre la col·lecció descarregada, sense cap crida.
- **El detall continua a l'API.** La fitxa d'un punt (`GET /api/v1/punts/{id}`, amb l'índex de les properes hores i el desglossament) i les recomanacions no van al document: són dades més pesades i es demanen sota demanda.

## Alternatives considerades

- **Consulta per bbox a cada moviment del mapa.** Era la idea inicial. Descartada perquè multiplica les consultes a la base de dades sense aportar res: les dades només canvien cada hora.
- **Fitxer estàtic a Supabase Storage o servit per Nginx.** És equivalent i escala encara millor. No es fa ara perquè afegeix una peça més al desplegament. Si cal, el worker pot escriure el mateix JSON com a fitxer i l'app només canvia la URL d'on el descarrega.
- **Tessel·les vectorials (PMTiles, tippecanoe).** Només tenen sentit amb desenes de milers de punts. Queda molt lluny del MVP (≥ 30 punts).

## Conseqüències

- Una sola descàrrega per usuari i hora per pintar el mapa. Moure el mapa o cercar no toca el servidor.
- Mida acotada: amb uns quants milers de punts, el document es manté per sota d'uns pocs centenars de kB (comprimit amb gzip per Nginx). Si el catàleg creix molt més, cal revisar-ho (fitxer estàtic o tessel·les).
- Tasques afectades del Sprint 1, sense canviar-ne el nom ni l'estimació: TG-88 (endpoint en GeoJSON amb `ETag`), TG-91 (tests de `ETag`/`304`), TG-90 (font GeoJSON amb clustering) i TG-99 (el worker marca la versió de cada execució).
