# Fonts i inventari inicial d'esdeveniments

**Data de revisió:** 2026-10-11

**Període del dataset:** 2026-10-01 -- 2027-12-31

Aquest document identifica les fonts oficials i decideix quins esdeveniments són candidats a
la primera càrrega de Talaia. No és encara el dataset importable: els instants i textos definitius
es normalitzaran a `calendaris-2026-2027.json` després de revisar aquesta selecció.

## Fonts oficials

### International Meteor Organization

- [2026 Meteor Shower Calendar](https://www.imo.net/files/meteor-shower/cal2026.pdf),
  IMO.INFO(3-25), editat per Jürgen Rendtel.
- [Pàgina oficial del 2027 Meteor Shower Calendar](https://www.imo.net/meteor-shower-calendar-2027/),
  que enllaça el [PDF de l'edició 2027](https://www.imo.net/meteor-shower-calendar-2027/ShCal27s.pdf),
  IMO.INFO(3-26), editat per Jürgen Rendtel.

La taula de treball d'IMO dona el període d'activitat, la data o instant del màxim, la posició
del radiant i la ZHR. El calendari avisa que és una llista de treball que pot rebre correccions
posteriors; per això cada ocurrència conservarà l'edició concreta que s'ha consultat.

### NASA Goddard Space Flight Center

- [Eclipses During 2027](https://eclipse.gsfc.nasa.gov/OH/OH2027.html): fases i instants en UT.
- [Solar Eclipses: 2021--2030](https://eclipse.gsfc.nasa.gov/SEdecade/SEdecade2021.html):
  regió geogràfica de visibilitat dels eclipsis solars.
- [Lunar Eclipses: 2021--2030](https://eclipse.gsfc.nasa.gov/LEdecade/LEdecade2021.html):
  regió geogràfica de visibilitat dels eclipsis lunars.
- [Mapa interactiu de l'eclipsi solar del 2 d'agost de 2027](https://eclipse.gsfc.nasa.gov/SEgoogle/SEgoogle2001/SE2027Aug02Tgoogle.html):
  recorregut de la totalitat i zona d'eclipsi parcial.

Els instants de NASA s'emmagatzemaran en UTC. La classificació `total` descriu l'eclipsi
global; a Catalunya el del 2 d'agost de 2027 es veurà parcialment. Aquesta circumstància local
s'explicarà a `nota_visibilitat_ca` i no canviarà el tipus global de l'esdeveniment.

## Criteri de selecció de pluges de meteors

La primera càrrega inclou una pluja quan compleix aquests criteris:

1. El màxim cau dins del període del dataset.
2. És una font nocturna observable des de latituds de Catalunya, encara que algunes tinguin una
   finestra baixa o curta.
3. La ZHR habitual és com a mínim 10, o IMO la tracta com una de les pluges anuals principals.

No s'inclouen fonts diürnes detectables principalment per ràdio, radiants pràcticament
inobservables des de Catalunya ni totes les pluges menors de la llista de treball. La ZHR és una
taxa ideal amb cel fosc i el radiant al zenit: no és una promesa de meteors visibles per hora.

## Pluges seleccionades

Les hores indicades són UTC. `Dia` vol dir que l'edició consultada no fixa un instant prou
precís per representar-lo com una hora oficial.

| Codi de fenomen | Edició | Activitat | Màxim | ZHR | Precisió del màxim | Motiu |
|---|---:|---|---|---:|---|---|
| `orionids` | 2026 | 02/10--07/11 | 21/10 | 20+ | Dia | Pluja principal i radiant visible des de Catalunya. |
| `leonids` | 2026 | 06/11--30/11 | 17/11 23:45 | ~15 | Minut | Pluja principal amb possibles variacions anuals. |
| `geminids` | 2026 | 04/12--20/12 | 14/12 14:00 | 150 | Hora | Una de les pluges anuals més fortes i fiables. |
| `ursids` | 2026 | 17/12--26/12 | 22/12 | 10 | Dia | Font boreal especialment adequada a l'hemisferi nord. |
| `quadrantids` | 2027 | 28/12--12/01 | 04/01 03:25 | 80+ | Minut | Pluja anual principal; radiant boreal. |
| `lirids` | 2027 | 14/04--30/04 | 23/04 01:40 | 18 | Minut | Pluja anual principal visible a latituds mitjanes nord. |
| `eta-aquariids` | 2027 | 19/04--28/05 | 06/05 09:00 | 50 | Hora | Activitat alta, però finestra baixa i curta abans de l'alba a Catalunya. |
| `southern-delta-aquariids` | 2027 | 12/07--23/08 | 31/07 | 25 | Dia | Visible des de Catalunya amb el radiant relativament baix. |
| `perseids` | 2027 | 17/07--24/08 | 13/08 08:00--10:00 | 110+ | Interval d'hores | Pluja principal, molt favorable a latituds mitjanes nord. |
| `orionids` | 2027 | 02/10--07/11 | 22/10 | 20 | Dia | Pluja principal; el màxim és ample, d'aproximadament un dia. |
| `leonids` | 2027 | 06/11--30/11 | 18/11 06:00 | 15+ | Hora | Pluja principal amb possibles passos per traces de pols. |
| `geminids` | 2027 | 04/12--20/12 | 14/12 20:00 | 150 | Hora | Molt activa, tot i que la Lluna plena perjudicarà l'observació de 2027. |
| `ursids` | 2027 | 17/12--26/12 | 23/12 04:00 | 10 | Hora | Font boreal; IMO no preveu activitat reforçada el 2027. |

La selecció representa **nou fenòmens** i **tretze ocurrències**. La Lluna o una previsió
meteorològica desfavorable no eliminen l'esdeveniment: es tindran en compte quan Talaia
calculi la qualitat d'observació.

## Eclipsis seleccionats

No hi ha cap eclipsi entre octubre i desembre de 2026. Dels cinc eclipsis mundials de 2027,
dos són visibles des de Catalunya segons les regions de visibilitat de NASA:

| Codi provisional | Tipus | Interval global publicat | Màxim global | Visibilitat a Catalunya |
|---|---|---|---|---|
| `eclipsi-lunar-penumbral-2027-02-20` | `eclipsi_llunar` | 20/02 21:12 -- 21/02 01:13 UTC | 20/02 23:13 UTC | Visible; NASA inclou Europa a la regió de visibilitat. |
| `eclipsi-solar-total-2027-08-02` | `eclipsi_solar` | Pendent de normalitzar els contactes globals | 02/08 10:07 UTC | Parcial a Catalunya; la franja de totalitat travessa altres zones d'Espanya. |

El nom del segon manté `total` perquè descriu la classe astronòmica global. La resposta de
l'API haurà d'explicar que l'observació des de Catalunya és parcial.

## Eclipsis descartats per falta de visibilitat a Catalunya

| Data | Tipus global | Regió de visibilitat segons NASA |
|---|---|---|
| 06/02/2027 | Solar anular | Sud-amèrica, Antàrtida i oest/sud d'Àfrica. |
| 18/07/2027 | Lunar penumbral | Est d'Àfrica, Àsia, Austràlia i Pacífic. |
| 17/08/2027 | Lunar penumbral | Pacífic i Amèriques. |

## Candidats secundaris no inclosos encara

Aquestes pluges són observables des de Catalunya però no compleixen el llindar de la primera
càrrega. Es poden afegir sense canviar l'esquema si l'equip prefereix un calendari més extens:

| Fenomen | Edicions rellevants | ZHR típica | Raó per deixar-lo fora del nucli |
|---|---|---:|---|
| Dracònids | 2026 i 2027 | 5 | Activitat habitual baixa, encara que pot tenir esclats irregulars. |
| Tàurids del sud | 2026 i 2027 | 7 | Taxa baixa; interessants principalment pels meteors brillants. |
| Tàurids del nord | 2026 i 2027 | 5 | Taxa baixa i màxim ample. |
| Alfa Capricòrnids | 2027 | 5 | Taxa baixa, tot i que pot produir bòlids. |

La recomanació per al MVP és mantenir aquests quatre fenòmens fora del JSON inicial. Així el
calendari no queda saturat, però la decisió es pot canviar abans de normalitzar les dades.

## Punts pendents abans de generar el JSON

1. Confirmar la selecció de tretze pluges i dos eclipsis.
2. Decidir si els eclipsis penumbrals, visualment subtils, formen part del calendari del MVP.
3. Extreure els contactes globals de l'eclipsi solar del 2 d'agost de 2027.
4. Redactar els noms i descripcions en català sense copiar extensament els textos de les fonts.
5. Transformar dates de precisió `dia` en límits UTC sense atribuir-los una precisió falsa.
