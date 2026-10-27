# Producte

## Visió

**Talaia** recomana el millor lloc i moment per observar o fotografiar el cel a Catalunya. No et diu només si farà bo: et diu **on anar i a quina hora** per veure la posta, la Lluna, una pluja d'estels o una constel·lació, i **per què** (núvols, foscor del cel, Lluna, relleu).

Públic: qualsevol persona, aficionada o sense coneixements d'astronomia. Elevator pitch i incepció completa al Drive de l'equip.

## El nucli: índex de visibilitat (0–100)

Per a una ubicació i una hora, el sistema combina:

| Factor | Font | Notes |
|---|---|---|
| Nuvolositat per capes (baixa, mitjana, alta), humitat, visibilitat | Open-Meteo (previsió horària) | Contrastat amb observacions reals de Meteocat (XEMA) |
| Foscor del cel / contaminació lumínica | Mapa de contaminació lumínica de Catalunya (Generalitat, 2025, GeoTIFF 1 km) | Preprocessat una vegada |
| Sol i Lluna: crepuscles, fase i alçada de la Lluna | Astronomy Engine (llibreria, dins el servidor) | Sense API externa |
| Perfil d'horitzó: quina part del cel tapen les muntanyes | Model d'elevacions de l'ICGC (5 m) | Preprocessat una vegada |
| Fenòmens (pluges d'estels, eclipsis…) | Calendaris IMO i NASA + fenòmens calculats | Es carreguen per temporada |

L'índex **no és una caixa negra**: cada recomanació es desglossa en factors amb el seu valor, la puntuació normalitzada i el pes (model conceptual: `Recomanacio` → `FactorRecomanacio`). Es **precalcula cada hora** per a tots els punts del catàleg; només un punt triat lliurement al mapa es calcula al moment (i es guarda en memòria cau una estona).

La fórmula v1 (Sprint 1) combina núvols, foscor i Lluna. El perfil d'horitzó i l'ajust amb observacions reals entren en sprints posteriors.

## MVP (acordat a l'equip)

1. Punts d'observació principals de Catalunya amb el seu índex, i triar un punt qualsevol del mapa per obtenir-ne l'índex.
2. Calendari de fenòmens astronòmics amb informació de cada fenomen.
3. Com arribar al punt.

Decisions de producte preses:

- Els **eclipsis** són al MVP; els **planetes**, més endavant.
- Els **plans** d'observació són **personals** (no compartits).
- Les **valoracions** dels punts són **privades** (registre personal).
- L'usuari pot triar un punt manualment al mapa i obtenir-ne l'índex.
- Pantalles separades per a la llista d'alertes i per crear una alerta.
- Etiqueta «Qualsevol cel ras» per a la consulta genèrica (cel estrellat sense fenomen concret).
- Extra: **constel·lacions** amb curiositats i **mitologia grega**.
- **Cap generació de contingut amb IA** dins el producte.
- Només **Catalunya**.
- App en **català, castellà i anglès**.
- **Navegació:** distància i temps via el servei de rutes de l'equip **Mobilicat**; per navegar, l'app obre el mapa del mòbil (deep link). No fem navegació pròpia.

## NOT list (Incepció 2)

**Dins de l'abast**

- Recomana on i quan observar el cel, per a qualsevol persona.
- Combina i interpreta dades meteorològiques, astronòmiques, de contaminació lumínica i de relleu.
- Mapa interactiu amb punts d'observació recomanats.
- Índex de visibilitat per a un lloc i moment, amb els factors que l'expliquen.
- Calendari bàsic d'esdeveniments astronòmics.
- Alertes personalitzades segons fenomen, zona i condicions.
- Plans personals d'observació; registre d'observacions realitzades.
- Component comunitària bàsica.
- Constel·lacions amb curiositats i mitologia grega.
- **[Canvi 2026-10-15]** Gamificació amb trofeus privats per les observacions registrades (HU44, Sprint 3). Abans era a «Pendent de decidir».
- **[Canvi 2026-10-15]** Vista del cel en realitat augmentada per saber on mirar (HU46, Sprint 3). Abans era a «Pendent de decidir».
- **[Canvi 2026-10-15]** Mode nit vermell sobre negre en arribar al punt d'un pla (HU45, Sprint 2).
- Compte d'usuari; app en ca/es/en.
- Web d'administració: moderació, bloqueig de comptes, gestió de punts.
- Servei d'esdeveniments astronòmics per a altres aplicacions (API).

**Fora de l'abast**

- No és una app meteorològica ni un visor de dades astronòmiques.
- No és una eina exclusiva per a experts.
- No és una xarxa social (ni de fotos, ni amb seguiment, xats o feed).
- No substitueix serveis meteorològics oficials ni garanteix que un fenomen es vegi.
- No fa navegació GPS pròpia.
- No és un catàleg astronòmic complet.
- No cobreix territoris fora de Catalunya.
- No genera contingut amb IA.

**Pendent de decidir (Unresolved)**

- Plans compartits amb altres usuaris.
- Ressenyes públiques dels punts.
- Creació de punts per part dels usuaris.
- Funcionalitats socials (participants en una sortida, invitacions).
- Cercar què es pot veure en un lloc i moment sense triar fenomen.
- Punts favorits dins del perfil.
- Planetes.

## Èpiques

| Èpica | Nom | Històries |
|---|---|---|
| E01 | Recomanacions d'observació | HU01–HU05 |
| E02 | Exploració de punts d'observació | HU06–HU08 |
| E03 | Calendari de fenòmens astronòmics | HU09–HU11 |
| E04 | Plans personals d'observació | HU12–HU15 |
| E05 | Alertes personalitzades | HU16–HU20 |
| E06 | Registre personal d'observacions | HU21–HU24 |
| E07 | Punts favorits | HU25–HU27 |
| E08 | Aportacions de la comunitat | HU28–HU31 |
| E09 | Constel·lacions i mitologia | HU32–HU34 |
| E10 | Compte i perfil d'usuari | HU35–HU38 |
| E11 | Administració i moderació | HU39–HU42 |
| E12 | Servei d'esdeveniments per a altres equips | HU43 |

Detall i story points: `backlog.md`.

## Model conceptual (resum)

Cinc àrees: **motor de recomanació** (`PeticioRecomanacio`, `Recomanacio`, `FactorRecomanacio`, `TipusFactor`), **catàleg astronòmic** (`ObjectiuObservacio` abstracte → `ElementAstronomic` | `FenomenAstronomic`; `EsdevenimentAstronomic` = ocurrència concreta d'un fenomen), **localitzacions i comunitat** (`PuntObservacio` amb una `Ubicacio` valor; origen oficial/comunitari; estat pendent/publicat/rebutjat/desactivat; `RessenyaPunt`), **planificació i registre** (plans, registres d'observació) i **identitat i gamificació**. Una `Recomanacio` sempre avalua una `Ubicacio`, i només està lligada a un `PuntObservacio` si la ubicació és al catàleg. Diagrama UML complet a la incepció 2 (Drive).

## Pantalles (mockups, Figma)

01 Benvinguda i accés · 02 Què vols veure? · 03 Recomanacions al mapa · 04 Punt triat al mapa · 05 Detall del punt (índex per hores i factors) · 06 Pla d'observació · 07 Notificació d'alerta · 08 Calendari de fenòmens · 09 Fitxa de l'esdeveniment · 10 Alertes · 11 Nova alerta · 12 Valoració privada · 13 Els meus plans · 14 Perfil · 15 Constel·lacions · 16 Fitxa de la constel·lació.
