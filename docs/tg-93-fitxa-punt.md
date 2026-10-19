# TG-93 · Fitxa del punt

Branca `feature/TG-93-fitxa-punt`, amb TG-90 i les seves correccions de revisió integrades. Els marcadors del mapa obren `/punt/[id]` amb l’ID real del punt.

## Contracte de TG-92

El repository consumeix el contracte de la PR #48 (`GET /api/v1/punts/{id}`)
i adapta la resposta al model intern `PuntDetall` de la pantalla. Fins que la
PR entri a `snapshot`, el tipus de resposta viu al repository; després es podrà
substituir pel `PuntFitxa` de `@talaia/shared`.

La resposta conté:

- Els camps de `PuntObservacio`: `id`, `nom`, `municipi`, `lat` i `lon`.
- `descripcio` i `altitud` (metres, nullable), coherents amb el catàleg.
- `accessibilitat: string | null` i `horitzoObert: DireccioHoritzo[] | null`;
  «Vistes obertes» explica les direccions amb paraules i s'amaga si no n'hi ha.
- `sqm: number | null`, que no es mostra fins que el grup decideixi com fer-ho.
- `index.actual: IndexHora | null` i `index.properesHores: IndexHora[]`, amb
  instants ISO 8601 en UTC. Per defecte l'API retorna les 24 hores següents.

El repository extreu `index.actual` i `index.properesHores` i omet `sqm` del
model de presentació. Els factors de `IndexHora` alimenten les quatre barres
de 0 a 100. `foscorEstimada` marca la foscor provisional. Un 400 (UUID invàlid)
i un 404 es mostren com a punt inexistent; errors de xarxa o 503 permeten reintentar.

No hi ha fallback a dades fictícies ni ruta demo a l'app. Les dades de prova viuen
només als tests. La validació amb una resposta real de l'API encara queda pendent.

## Disseny i abast

Referència: frame 05 (Detall del punt) del Figma de Talaia, a partir de la captura
facilitada per la Vinyet. Es conserva la jerarquia de mapa, nom, etiquetes,
índex destacat i barres horàries, amb els tokens i components existents.

TG-93 cobreix nom, altitud, foscor, índex actual, evolució horària i estats de
càrrega, punt inexistent i error de xarxa amb reintent. L'apartat «Informació del punt»
mostra la descripció i l'accessibilitat si hi ha text, i les direccions amb
vistes obertes quan se'n coneixen. Els quatre factors de
l'índex v1 (núvols, sol, foscor i lluna) es mostren en una escala de 0 a 100
a partir dels valors de 0 a 1 de l'API. `sqm` queda fora de la pantalla fins
que el grup decideixi com presentar-lo. El
desglossament dels factors correspon a TG-105. La connexió amb els marcadors
de TG-90 ja està integrada.

El mapa de situació és estàtic i reutilitza l'estil nocturn de l'ICGC.
El botó d'informació té una superfície tàctil de 44 pt i desplega l'atribució a la part superior del mapa.
El marcador de torre segueix el mockup. La navegació enrere és
la de la pila existent. «Com arribar» obre Google Maps amb les coordenades del
punt. «Crea un pla» mostra un avís fins que existeixi el flux de creació de plans.

## Comportament i comprovacions

- La consulta es refresca cada minut quan ja té dades; després d'un error o d'un
  punt inexistent sense dades, espera una acció de reintent. La fitxa mostra la
  data de l'índex retornat.
- Les hores es mostren en `Europe/Madrid`, ordenades per instant UTC. La millor
  finestra agrupa les hores consecutives de la mateixa franja que el màxim
  disponible, sense unir buits de més de 90 minuts. És una interpretació de
  presentació de la previsió horària; no és una finestra retornada per l’API.
  Si el màxim és de la franja `tap`, no es destaca cap millor moment.
- Les barres de la finestra «Millor moment» mantenen el color complet; les altres
  s'atenuen però es poden tocar igualment per consultar l'índex. Les etiquetes
  de les hores conserven el contrast.
- En tocar una barra, apareix el contorn complet del 100% i el valor gran al
  centre, sense pastilla de fons. La part plena conserva la proporció real.
  Tocar-la de nou amaga la selecció; tocar-ne una altra la desplaça.
  Un valor zero es representa amb una petita marca a la base.
  El número adapta el contrast segons si queda sobre la part plena.
- Si falla una actualització, es conserva la fitxa anterior amb un avís i reintent.
- Les dades absents es mostren com a absents, no com a zero. La foscor es presenta
  sobre 100 a partir del factor 0–1 i s'indica quan és estimada.
- El gràfic horari gestiona la selecció localment perquè tocar una barra no torni
  a pintar tota la fitxa ni el mapa DOM.
- Les dimensions del mapa, el marcador, el gràfic i la tipografia del valor horari
  es defineixen als tokens. Es mantenen paleta i components base.

Tests de la feature: `npm test -w apps/mobile -- --runInBand src/features/point`.
Els fixtures són a `features/point/__fixtures__`, només importats pels tests.
Es proven dades, hores, canvi de punt, dades absents, error/404, reintent,
memòria cau i refresc periòdic. El mapa DOM està simulat als tests de pantalla.

**Validació posterior al commit:** contrastar la fitxa amb una resposta real de TG-92 i revisar-la en Expo Go (mides petites, text ampliat, gestos sobre el mapa, atribució i retorn enrere). Aquest commit es basa en el contracte de la PR #48 i en les proves automàtiques.
