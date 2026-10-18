# Sprint 3 — 30/11/2026 → 18/12/2026

**Objectiu:** Completar el volum funcional (registre d'observacions, constel·lacions, aportacions de la comunitat amb moderació, comparar punts i trofeus), deixar els RNF complerts, publicar la release final i fer la presentació tècnica del 16/12.

**Compromís:** 88 story points en 16 històries (15 d'usuari + la tècnica [TEC]) · 38 tasques · 88 h estimades. Sprint master: **Hugo**.

**Criteri d'estimació:** 1 story point = 1 hora. Els story points d'una història són la suma de les hores estimades de les seves tasques.

Fites: planning 30/11 · *no hi ha classe 07/12* · release 1.0.0 15/12 · retrospectiva i presentació tècnica final 16/12 · lliurament final 18/12.

Font de veritat: [taulell de Taiga](https://tree.taiga.io/project/mohamed-dari-pes_22_c_talaia/taskboard/sprint-3-357). Si aquest fitxer i Taiga no coincideixen, mana Taiga.

## HU03 · Comparar punts d'observació segons l'índex de visibilitat · [TG-32](https://tree.taiga.io/project/mohamed-dari-pes_22_c_talaia/us/32)
Èpica E01 · Recomanacions d'observació · **4 SP**  
*Com a usuari, vull comparar diversos punts pel seu índex, de manera que triï el millor lloc.*

**Criteris d'acceptació**
- [ ] L'usuari pot triar entre 2 i 4 punts i veure'n l'índex per hores en una mateixa vista.

| Ref | Tasca | Responsable | Inici | Límit | h |
|---|---|---|---|---|---|
| TG-196 | Endpoint per comparar punts: l'índex per hores de diversos punts | Hugo | 01/12 | 02/12 | 1 |
| TG-197 | Seleccionar punts i vista comparativa | Joan | 02/12 | 04/12 | 3 |

## HU42 · Gestionar el calendari de fenòmens astronòmics · [TG-55](https://tree.taiga.io/project/mohamed-dari-pes_22_c_talaia/us/55)
Èpica E11 · Administració i moderació · **5 SP**  
*Com a administrador, vull afegir i corregir fenòmens del calendari, de manera que la informació sigui completa.*

**Criteris d'acceptació**
- [ ] L'administrador pot afegir, corregir i eliminar fenòmens del calendari des de la web d'administració.
- [ ] Els canvis es veuen a l'app i al servei per a Aprop.

| Ref | Tasca | Responsable | Inici | Límit | h |
|---|---|---|---|---|---|
| TG-198 | Endpoints d'administració dels fenòmens del calendari | Victor | 30/11 | 02/12 | 2 |
| TG-199 | Pantalla del calendari de fenòmens a la web d'administració | Victor | 02/12 | 04/12 | 3 |

## HU21 · Registrar una observació amb valoració, notes i fotografies privades · [TG-48](https://tree.taiga.io/project/mohamed-dari-pes_22_c_talaia/us/48)
Èpica E06 · Registre personal d'observacions · **9 SP**  
*Com a usuari, vull guardar una observació amb valoració, notes i fotos, de manera que tingui un diari de les meves sortides.*

**Criteris d'acceptació**
- [ ] L'usuari pot registrar una observació d'un punt amb data, valoració (1–5), notes i fins a 5 fotos.
- [ ] Les fotos es desen en un bucket privat: només les veu qui les ha pujat.

| Ref | Tasca | Responsable | Inici | Límit | h |
|---|---|---|---|---|---|
| TG-200 | Model de registres d'observació i endpoints, amb les fotos en un bucket privat de Supabase Storage | Martina | 30/11 | 02/12 | 4 |
| TG-201 | Pantalla «Valoració privada» (mockup 12): valoració, notes i fotos (càmera o galeria) | Vinyet | 02/12 | 09/12 | 4 |
| TG-202 | Tests dels endpoints de registres i dels permisos de Storage | Martina | 03/12 | 04/12 | 1 |

## HU22 · Consultar l'historial d'observacions · [TG-49](https://tree.taiga.io/project/mohamed-dari-pes_22_c_talaia/us/49)
Èpica E06 · Registre personal d'observacions · **2 SP**  
*Com a usuari, vull veure el meu historial, de manera que recordi les observacions passades.*

**Criteris d'acceptació**
- [ ] L'historial llista les observacions de l'usuari per data, amb la valoració i una miniatura.

| Ref | Tasca | Responsable | Inici | Límit | h |
|---|---|---|---|---|---|
| TG-203 | Historial d'observacions | Vinyet | 09/12 | 10/12 | 2 |

## HU23 · Modificar una observació registrada · [TG-50](https://tree.taiga.io/project/mohamed-dari-pes_22_c_talaia/us/50)
Èpica E06 · Registre personal d'observacions · **2 SP**  
*Com a usuari, vull editar una observació, de manera que corregeixi o completi la informació.*

**Criteris d'acceptació**
- [ ] Es poden editar la valoració, les notes i les fotos d'una observació.

| Ref | Tasca | Responsable | Inici | Límit | h |
|---|---|---|---|---|---|
| TG-204 | Modificar una observació (PATCH i edició) | Martina | 09/12 | 10/12 | 2 |

## HU24 · Eliminar una observació registrada · [TG-51](https://tree.taiga.io/project/mohamed-dari-pes_22_c_talaia/us/51)
Èpica E06 · Registre personal d'observacions · **1 SP**  
*Com a usuari, vull eliminar una observació, de manera que controli les meves dades.*

**Criteris d'acceptació**
- [ ] Es pot eliminar una observació, amb confirmació, i se n'esborren també les fotos.

| Ref | Tasca | Responsable | Inici | Límit | h |
|---|---|---|---|---|---|
| TG-205 | Eliminar una observació i les seves fotos | Martina | 10/12 | 11/12 | 1 |

## HU44 · Aconseguir trofeus per les observacions registrades · [TG-119](https://tree.taiga.io/project/mohamed-dari-pes_22_c_talaia/us/119)
Èpica E06 · Registre personal d'observacions · **6 SP**  
*Com a usuari, vull guanyar trofeus pel que observo (primera observació, nits diferents, fenòmens i punts diferents), de manera que em motivi a sortir a observar més sovint.*

**Criteris d'acceptació**
- [ ] En registrar una observació, s'atorguen una sola vegada els trofeus les regles dels quals es compleixen.
- [ ] El perfil mostra els trofeus aconseguits i els que falten, amb la condició de cadascun.
- [ ] En guanyar un trofeu, l'app ho avisa.
- [ ] Els trofeus són privats: no hi ha rànquing entre usuaris.

| Ref | Tasca | Responsable | Inici | Límit | h |
|---|---|---|---|---|---|
| TG-206 | Model de trofeus i regles d'atorgament en registrar una observació | Hugo | 02/12 | 04/12 | 3 |
| TG-207 | Trofeus al perfil i avís en guanyar-ne un | Joan | 09/12 | 11/12 | 3 |

## HU32 · Consultar les constel·lacions visibles aquesta nit · [TG-60](https://tree.taiga.io/project/mohamed-dari-pes_22_c_talaia/us/60)
Èpica E09 · Constel·lacions i mitologia · **10 SP**  
*Com a usuari, vull veure quines constel·lacions són visibles, de manera que sàpiga què puc buscar al cel.*

**Criteris d'acceptació**
- [ ] Es mostren les constel·lacions visibles aquesta nit des de la ubicació de l'usuari, amb l'hora en què són més altes.
- [ ] El contingut és en ca/es/en i surt de fonts obertes citades (sense IA).

| Ref | Tasca | Responsable | Inici | Límit | h |
|---|---|---|---|---|---|
| TG-208 | Catàleg de constel·lacions visibles des de Catalunya, amb mite i curiositats en ca/es/en (fonts obertes, sense IA) | Victor | 30/11 | 03/12 | 4 |
| TG-209 | Constel·lacions visibles aquesta nit (Astronomy Engine) i endpoint | Hugo | 30/11 | 02/12 | 3 |
| TG-210 | Pantalla de constel·lacions (mockup 15) | Joan | 03/12 | 09/12 | 3 |

## HU33 · Consultar la fitxa d'una constel·lació amb el mite i les curiositats · [TG-61](https://tree.taiga.io/project/mohamed-dari-pes_22_c_talaia/us/61)
Èpica E09 · Constel·lacions i mitologia · **2 SP**  
*Com a usuari, vull llegir la fitxa d'una constel·lació, de manera que aprengui el mite i les curiositats.*

**Criteris d'acceptació**
- [ ] La fitxa d'una constel·lació mostra el mite, les curiositats i quan es veu millor.

| Ref | Tasca | Responsable | Inici | Límit | h |
|---|---|---|---|---|---|
| TG-211 | Fitxa de la constel·lació (mockup 16) | Joan | 09/12 | 10/12 | 2 |

## HU34 · Cercar els millors punts per observar una constel·lació · [TG-62](https://tree.taiga.io/project/mohamed-dari-pes_22_c_talaia/us/62)
Èpica E09 · Constel·lacions i mitologia · **3 SP**  
*Com a usuari, vull obtenir els millors punts per a una constel·lació, de manera que la pugui observar en bones condicions.*

**Criteris d'acceptació**
- [ ] Des de la fitxa d'una constel·lació, «On veure-la» obre el rànquing de punts per a aquella constel·lació.

| Ref | Tasca | Responsable | Inici | Límit | h |
|---|---|---|---|---|---|
| TG-212 | Recomanacions per a una constel·lació (alçada sobre l'horitzó com a factor) | Hugo | 03/12 | 09/12 | 2 |
| TG-213 | Botó «On veure-la» a la fitxa de la constel·lació | Mohamed | 10/12 | 11/12 | 1 |

## HU46 · Saber on mirar amb la vista del cel en realitat augmentada · [TG-242](https://tree.taiga.io/project/mohamed-dari-pes_22_c_talaia/us/242)
Èpica E03 · Calendari de fenòmens astronòmics · **14 SP**  
*Com a usuari, vull apuntar el mòbil al cel i veure-hi on és cada fenomen i constel·lació, de manera que sàpiga exactament cap on he de mirar.*

**Criteris d'acceptació**
- [ ] Apuntant el mòbil al cel, la vista mostra sobre la càmera la Lluna, els planetes, el radiant de les pluges d'estels i les constel·lacions visibles, amb el seu nom.
- [ ] Si l'objectiu triat és fora de la pantalla, una fletxa indica cap on girar-se.
- [ ] Després de calibrar, l'error de posició és inferior a 10° (es comprova amb la Lluna o un planeta brillant).
- [ ] Funciona a Expo Go (iOS i Android), sense ARKit ni ARCore, i fa servir el mode nit.
- [ ] Sense permís de càmera, es mostra el mateix cel sobre fons negre.

| Ref | Tasca | Responsable | Inici | Límit | h |
|---|---|---|---|---|---|
| TG-243 | ADR de la vista AR a Expo Go: expo-camera, sensors i Skia, sense ARKit ni ARCore | Joan | 30/11 | 30/11 | 1 |
| TG-244 | Orientació del mòbil: azimut i alçada on apunta la càmera (DeviceMotion i rumb), amb filtre i calibratge manual | Joan | 01/12 | 04/12 | 4 |
| TG-245 | Posició al cel dels objectius (Lluna, planetes, radiants i constel·lacions) amb Astronomy Engine a l'app | Joan | 02/12 | 04/12 | 3 |
| TG-246 | Vista AR: càmera amb la superposició (Skia) i fletxa cap a l'objectiu quan és fora de la pantalla | Joan | 09/12 | 11/12 | 4 |
| TG-247 | Botó «On mirar» des de la fitxa de l'esdeveniment i de la constel·lació cap a la vista AR | Joan | 11/12 | 11/12 | 1 |
| TG-248 | Tests de la conversió de coordenades (alçada i azimut a posició a la pantalla) | Joan | 11/12 | 14/12 | 1 |

## HU28 · Proposar un nou punt d'observació · [TG-56](https://tree.taiga.io/project/mohamed-dari-pes_22_c_talaia/us/56)
Èpica E08 · Aportacions de la comunitat · **5 SP**  
*Com a usuari, vull proposar un punt nou perquè el revisin, de manera que la comunitat pugui descobrir-lo.*

**Criteris d'acceptació**
- [ ] L'usuari pot proposar un punt des del mapa amb nom, ubicació i descripció, i ha de ser dins de Catalunya.
- [ ] El punt queda pendent i no surt a l'app fins que un moderador l'aprova.

| Ref | Tasca | Responsable | Inici | Límit | h |
|---|---|---|---|---|---|
| TG-214 | Proposar un punt: endpoint amb estat pendent i validació que és dins de Catalunya | Mohamed | 30/11 | 02/12 | 2 |
| TG-215 | Formulari per proposar un punt des del mapa | Joan | 09/12 | 11/12 | 3 |

## HU30 · Compartir fotografies associades a un punt d'observació · [TG-58](https://tree.taiga.io/project/mohamed-dari-pes_22_c_talaia/us/58)
Èpica E08 · Aportacions de la comunitat · **4 SP**  
*Com a usuari, vull pujar fotos d'un punt, de manera que altres vegin què s'hi pot fotografiar.*

**Criteris d'acceptació**
- [ ] Des de la fitxa d'un punt, l'usuari pot pujar fotos, que queden pendents de moderació.

| Ref | Tasca | Responsable | Inici | Límit | h |
|---|---|---|---|---|---|
| TG-216 | Pujar fotos a un punt (Storage públic, pendents de moderació) | Martina | 02/12 | 04/12 | 2 |
| TG-217 | Afegir fotos des de la fitxa del punt | Vinyet | 10/12 | 11/12 | 2 |

## HU31 · Consultar les valoracions i fotografies d'un punt · [TG-59](https://tree.taiga.io/project/mohamed-dari-pes_22_c_talaia/us/59)
Èpica E08 · Aportacions de la comunitat · **3 SP**  
*Com a usuari, vull veure les valoracions i fotos d'un punt, de manera que conegui l'experiència d'altres.*

**Criteris d'acceptació**
- [ ] La fitxa del punt mostra una galeria amb les fotos aprovades.
- [ ] Les valoracions són privades (decisió de producte): aquí només hi ha fotos.

| Ref | Tasca | Responsable | Inici | Límit | h |
|---|---|---|---|---|---|
| TG-218 | Endpoint de les fotos aprovades d'un punt | Martina | 04/12 | 09/12 | 1 |
| TG-219 | Galeria de fotos aprovades a la fitxa del punt | Vinyet | 11/12 | 14/12 | 2 |

## HU40 · Moderar el contingut aportat pels usuaris · [TG-53](https://tree.taiga.io/project/mohamed-dari-pes_22_c_talaia/us/53)
Èpica E11 · Administració i moderació · **5 SP**  
*Com a moderador, vull revisar i retirar contingut (punts proposats, valoracions, fotos), de manera que la comunitat sigui fiable.*

**Criteris d'acceptació**
- [ ] La web d'administració té una cua amb els punts proposats i les fotos pendents.
- [ ] El moderador els pot aprovar o rebutjar, i només el contingut aprovat surt a l'app.

| Ref | Tasca | Responsable | Inici | Límit | h |
|---|---|---|---|---|---|
| TG-220 | Endpoints de moderació: aprovar o rebutjar punts proposats i fotos | Mohamed | 02/12 | 04/12 | 2 |
| TG-221 | Cua de moderació a la web d'administració | Victor | 09/12 | 11/12 | 3 |

## [TEC] Release final i qualitat (Sprint 3) · [TG-120](https://tree.taiga.io/project/mohamed-dari-pes_22_c_talaia/us/120)
Història tècnica (sense èpica de producte) · **13 SP**  
Història tècnica del Sprint 3: release final (app i prod), dades de demo, RNF complerts, informe de proves i segona ronda de feedback d'usuaris reals.

| Ref | Tasca | Responsable | Inici | Límit | h |
|---|---|---|---|---|---|
| TG-222 | Release final: build de l'app amb EAS i desplegament a prod | Mohamed | 14/12 | 15/12 | 3 |
| TG-223 | Dades de demo precarregades (seed) per a la presentació | Victor | 11/12 | 14/12 | 1 |
| TG-224 | Mesurar els RNF i corregir els que no es compleixin | Hugo | 10/12 | 14/12 | 3 |
| TG-225 | Informe final de proves i cobertura | Vinyet | 14/12 | 15/12 | 2 |
| TG-226 | Segona sessió de feedback amb usuaris reals | Martina | 09/12 | 11/12 | 2 |
| TG-227 | Corregir els bugs oberts a Taiga | Mohamed | 14/12 | 15/12 | 2 |

## [GES] Gestió i cerimònies del Sprint 3 · [TG-121](https://tree.taiga.io/project/mohamed-dari-pes_22_c_talaia/us/121)
Fora del sprint backlog (sense story points, no compta al burndown). Les hores es registren a la PRT.

| Ref | Tasca | Responsable | Inici | Límit | h |
|---|---|---|---|---|---|
| TG-228 | Sprint Planning (30/11) i lliurament de planning_3.pdf | Hugo | 30/11 | 30/11 | 2 |
| TG-229 | Daily scrums a classe i seguiment del taulell | Hugo | 30/11 | 16/12 | 2 |
| TG-230 | Release 1.0.0 (stable → prod) | Hugo | 15/12 | 15/12 | 1 |
| TG-231 | Retrospective Meeting (16/12) i lliurament de report_3.pdf | Hugo | 16/12 | 18/12 | 2 |
| TG-232 | Managerial report de l'entrega final | Hugo | 14/12 | 18/12 | 2 |
| TG-233 | Actualitzar la PRT i els gràfics (burndown, velocitat i product burndown) | Victor | 16/12 | 18/12 | 1 |
| TG-234 | Memòria final (requisits, metodologia i descripció tècnica) | Hugo | 14/12 | 18/12 | 2 |
| TG-235 | Informació de la release final: com executar l'app | Mohamed | 15/12 | 18/12 | 2 |
| TG-236 | Presentació final i demo (16/12): diapositives, guió de la demo i assaig | *per assignar* | 09/12 | 16/12 | 4 |

## Repartiment d'hores

Backlog del sprint i gestió [GES], per persona. L'acumulat inclou el Sprint 1 i serveix per equilibrar la càrrega del curs. Joan porta, a petició seva, més pantalles de disseny i les tasques del mode nit i de la vista AR. La presentació final (4 h, TG-236) la fan els tres membres que no han presentat abans i encara no està assignada: suma 4 h a cadascun.

| Persona | Sprint 3 | Acumulat |
|---|---|---|
| Joan | 28 | 99 |
| Vinyet | 12 | 59 |
| Martina | 13 | 55 |
| Mohamed | 12 | 60 |
| Hugo | 23 | 62 |
| Victor | 14 | 56 |
