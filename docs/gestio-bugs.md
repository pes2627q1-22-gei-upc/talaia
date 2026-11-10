# Gestió de bugs a Taiga

Aquest és el criteri de l'equip per detectar, registrar, prioritzar i seguir els defectes de Talaia (TG-183). La **issue de Taiga** és el registre del bug; la tasca de sprint, si cal planificar-ne la correcció, i la PR s'hi enllacen. No es crea una issue per cada error provisional que apareix mentre s'implementa una tasca.

## Què considerem un bug

Un bug és un comportament **reproduïble** que contradiu els criteris d'acceptació, un contracte o la documentació d'una funcionalitat que ja s'havia donat per operativa. També ho és una regressió d'una funcionalitat que abans funcionava. Cal descriure què s'esperava i què passa realment, amb evidències; si encara no es pot reproduir, primer s'investiga.

Si la funcionalitat encara s'està implementant o provant dins de la tasca actual, la correcció forma part d'aquella tasca i de la seva PR. Si es detecta un defecte **preexistent o fora de l'abast** de la tasca actual, s'avisa la persona responsable i es registra una issue abans d'iniciar-ne la correcció. Una funcionalitat prevista per a un sprint posterior o una petició de millora no és un bug: s'ha de gestionar com a història, tasca o issue de tipus *Enhancement*, segons pertoqui.

Un assistent de codi pot identificar un possible bug i preparar-ne la informació, però **no ha de crear la issue ni ampliar l'abast de la tasca sense que la persona responsable ho confirmi**. Tampoc ha d'amagar un defecte real només perquè el detecti durant una altra tasca.

## Com registrar una issue

A Taiga, dins del projecte Talaia, obriu **Issues → New issue** i indiqueu:

1. **Títol concret** que descrigui el resultat incorrecte i on es produeix.
2. **Tipus: Bug**. No feu servir *Question* o *Enhancement* per a un defecte confirmat.
3. **Descripció:** context o versió, precondicions, passos per reproduir-lo, resultat esperat, resultat real i freqüència. Afegiu captures, logs o un test que falli si en teniu; elimineu-ne dades personals, tokens i secrets.
4. **Severitat** segons l'impacte (vegeu més avall) i **prioritat** segons quan cal actuar. No són el mateix: una incidència greu pot tenir una solució temporal que en modifiqui la urgència.
5. **Relacions:** enllaç a la història o tasca afectada i, quan existeixi, a la PR que el resol. A la PR, enllaceu també la issue de Taiga. Si es crea una tasca específica per corregir-lo, associeu-la a la mateixa issue i seguiu el Gitflow habitual.

La persona que el registra pot assignar-lo si el responsable és clar; en cas contrari, l'equip el tria al triatge. Eviteu duplicats: cerqueu primer si ja existeix una issue amb el mateix símptoma i afegiu-hi evidència si és el mateix defecte.

## Severitat i triatge

Taiga ofereix els nivells *Wishlist*, *Minor*, *Normal*, *Important* i *Critical*. Per als bugs, feu servir aquest criteri orientatiu:

| Severitat | Criteri |
|---|---|
| **Critical** | Caiguda general, pèrdua de dades, vulnerabilitat explotable o flux essencial inutilitzable sense alternativa. |
| **Important** | Funcionalitat principal bloquejada o resultat incorrecte amb impacte important; alternativa limitada o costosa. |
| **Normal** | Fallada funcional acotada amb alternativa raonable, sense pèrdua de dades. |
| **Minor** | Defecte petit, visual o de detall, que no impedeix completar el flux. |
| **Wishlist** | Reserveu-lo per a peticions de millora, no per a bugs confirmats. |

Al triatge, l'equip confirma la reproducció, l'abast i si és duplicat; ajusta severitat i prioritat; decideix responsable i sprint, i deixa la decisió comentada a la issue. Els bugs *Critical* o *Important* que bloquegin un flux del sprint s'han de comunicar al grup tan aviat com es detectin, sense esperar a la reunió següent. Un bug no es tanca només perquè hi hagi una PR: cal que la correcció s'hagi fusionat, que la CI passi i que s'hagi comprovat el cas de reproducció (manualment o amb un test). La issue ha de contenir l'enllaç a la PR i el resultat de la verificació.

## Triage dels defectes del Sprint 1

Per a la TG-183, reviseu els defectes coneguts del Sprint 1 amb l'equip i cerqueu-los a les issues, tasques, PR i notes de prova. Classifiqueu cada cas: **ja corregit** (enllaceu la PR o la tasca; no obriu una issue retrospectiva innecessària), **pendent i reproduïble** (creeu o actualitzeu una issue amb tipus *Bug* i severitat), **duplicat**, o **no confirmat** (demaneu els passos per reproduir-lo). Deixeu constància del resultat del triatge a la TG-183, inclòs si no queda cap bug pendent conegut. Que la llista d'issues sigui buida no demostra, per si sola, que no hi hagi defectes pendents.

## Exemple breu

> - **Títol:** El mapa no actualitza els punts en tornar de la fitxa a iOS.
> - **Esperat:** els punts reflecteixen l'índex actual. **Real:** es mostren valors anteriors.
> - **Passos:** obrir el mapa, entrar a una fitxa, esperar una actualització de l'índex i tornar al mapa.
> - **Evidència:** versió, captura o log sense dades sensibles.
> - **Tipus:** Bug · **Severitat:** Normal · **Prioritat:** segons el triatge.
> - **Seguiment:** història/tasca afectada, PR de correcció i verificació després del merge.

Les convencions de branca, commit i PR continuen definides a [git-workflow.md](git-workflow.md).
