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
3. Té interès divulgatiu o observacional, encara que la taxa sigui baixa, i el dataset pot
   explicar-ne honestament la dificultat i les condicions.

No s'inclouen fonts diürnes detectables principalment per ràdio, radiants pràcticament
inobservables des de Catalunya ni totes les pluges menors de la llista de treball. S'hi inclouen
les pluges secundàries que poden oferir meteors brillants o esclats i s'etiqueten com a tals per
no crear falses expectatives. La ZHR és una
taxa ideal amb cel fosc i el radiant al zenit: no és una promesa de meteors visibles per hora.

## Pluges seleccionades

Les hores indicades són UTC. `Dia` vol dir que l'edició consultada no fixa un instant prou
precís per representar-lo com una hora oficial.

| Codi de fenomen | Edició | Activitat | Màxim | ZHR | Precisió del màxim | Motiu |
|---|---:|---|---|---:|---|---|
| `draconids` | 2026 | 06/10--10/10 | 09/10 | 5 | Dia | Taxa habitual baixa, però amb valor divulgatiu i possibles esclats en altres edicions. |
| `orionids` | 2026 | 02/10--07/11 | 21/10 | 20+ | Dia | Pluja principal i radiant visible des de Catalunya. |
| `southern-taurids` | 2026 | 20/09--20/11 | 05/11 | 7 | Dia | Taxa baixa, però possibilitat de meteors especialment brillants. |
| `northern-taurids` | 2026 | 20/10--10/12 | 12/11 | 5 | Dia | Taxa baixa i màxim ample, amb possibilitat de meteors brillants. |
| `leonids` | 2026 | 06/11--30/11 | 17/11 23:45 | ~15 | Minut | Pluja principal amb possibles variacions anuals. |
| `geminids` | 2026 | 04/12--20/12 | 14/12 14:00 | 150 | Hora | Una de les pluges anuals més fortes i fiables. |
| `ursids` | 2026 | 17/12--26/12 | 22/12 | 10 | Dia | Font boreal especialment adequada a l'hemisferi nord. |
| `quadrantids` | 2027 | 28/12--12/01 | 04/01 03:25 | 80+ | Minut | Pluja anual principal; radiant boreal. |
| `lirids` | 2027 | 14/04--30/04 | 23/04 01:40 | 18 | Minut | Pluja anual principal visible a latituds mitjanes nord. |
| `eta-aquariids` | 2027 | 19/04--28/05 | 06/05 09:00 | 50 | Hora | Activitat alta, però finestra baixa i curta abans de l'alba a Catalunya. |
| `alpha-capricornids` | 2027 | 03/07--15/08 | 31/07 | 5 | Dia | Taxa baixa, però pot produir bòlids vistosos. |
| `southern-delta-aquariids` | 2027 | 12/07--23/08 | 31/07 | 25 | Dia | Visible des de Catalunya amb el radiant relativament baix. |
| `perseids` | 2027 | 17/07--24/08 | 13/08 08:00--10:00 | 110+ | Interval d'hores | Pluja principal, molt favorable a latituds mitjanes nord. |
| `draconids` | 2027 | 06/10--10/10 | 09/10 | 5 | Dia | Observable al vespre, tot i la baixa taxa i la interferència lunar. |
| `orionids` | 2027 | 02/10--07/11 | 22/10 | 20 | Dia | Pluja principal; el màxim és ample, d'aproximadament un dia. |
| `southern-taurids` | 2027 | 20/09--20/11 | 06/11 | 7 | Dia | Taxa baixa i període llarg, però amb meteors brillants ocasionals. |
| `northern-taurids` | 2027 | 20/10--10/12 | 13/11 | 5 | Dia | Taxa baixa i màxim ample, però observable des de Catalunya. |
| `leonids` | 2027 | 06/11--30/11 | 18/11 06:00 | 15+ | Hora | Pluja principal amb possibles passos per traces de pols. |
| `geminids` | 2027 | 04/12--20/12 | 14/12 20:00 | 150 | Hora | Molt activa, tot i que la Lluna plena perjudicarà l'observació de 2027. |
| `ursids` | 2027 | 17/12--26/12 | 23/12 04:00 | 10 | Hora | Font boreal; IMO no preveu activitat reforçada el 2027. |

La selecció representa **tretze fenòmens** i **vint ocurrències**. La Lluna o una previsió
meteorològica desfavorable no eliminen l'esdeveniment: es tindran en compte quan Talaia
calculi la qualitat d'observació.

## Eclipsis seleccionats

No hi ha cap eclipsi entre octubre i desembre de 2026. Dels cinc eclipsis mundials de 2027,
dos són visibles des de Catalunya segons les regions de visibilitat de NASA:

| Codi provisional | Tipus | Interval global publicat | Màxim global | Visibilitat a Catalunya |
|---|---|---|---|---|
| `eclipsi-lunar-penumbral-2027-02-20` | `eclipsi_llunar` | 20/02 21:12 -- 21/02 01:13 UTC | 20/02 23:13 UTC | Visible; NASA inclou Europa a la regió de visibilitat. |
| `eclipsi-solar-total-2027-08-02` | `eclipsi_solar` | 02/08 07:30 -- 12:43 UTC | 02/08 10:07 UTC | Parcial a Catalunya; la franja de totalitat travessa altres zones d'Espanya. |

El nom del segon manté `total` perquè descriu la classe astronòmica global. La resposta de
l'API haurà d'explicar que l'observació des de Catalunya és parcial.

## Eclipsis descartats per falta de visibilitat a Catalunya

| Data | Tipus global | Regió de visibilitat segons NASA |
|---|---|---|
| 06/02/2027 | Solar anular | Sud-amèrica, Antàrtida i oest/sud d'Àfrica. |
| 18/07/2027 | Lunar penumbral | Est d'Àfrica, Àsia, Austràlia i Pacífic. |
| 17/08/2027 | Lunar penumbral | Pacífic i Amèriques. |

## Pluges secundàries incloses

Les Dracònids, les Tàurids del nord i del sud i les Alfa Capricòrnids formen part del dataset.
No es presenten com a pluges intenses: cada ocurrència porta `rellevancia: "secundari"`, la ZHR,
la dificultat i una nota que n'explica les expectatives realistes. Això permet que tant persones
principiants com aficionades amb més experiència les descobreixin sense amagar-ne les limitacions.

## Resultat de la normalització

La selecció queda plasmada a `calendaris-2026-2027.json`: **quinze fenòmens** en total
(tretze pluges i dos tipus d'eclipsi) i **vint-i-dos esdeveniments**. Els màxims coneguts només
per dia utilitzen les 12:00 UTC com a marcador neutre i conserven `precisio.maxim: "dia"`.
