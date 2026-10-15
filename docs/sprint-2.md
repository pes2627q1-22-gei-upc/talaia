# Sprint 2 — 09/11/2026 → 27/11/2026

**Objectiu:** Tancar el MVP (ubicació triada al mapa, com arribar, fitxa del fenomen) i tenir a punt per a la demo del 23/11 els aspectes transversals: alertes amb notificacions push, plans sincronitzats amb el calendari, canvi d'idioma, web d'administració amb gestió de punts i bloqueig de comptes, i el servei d'esdeveniments per a Aprop; i els metodològics: desplegament automàtic, cobertura, RNF mesurables i gestió de bugs a Taiga.

**Compromís:** 123 story points en 24 històries (23 d'usuari + la tècnica [TEC]) · 57 tasques · 123 h estimades. Sprint master: **Martina**.

**Criteri d'estimació:** 1 story point = 1 hora. Els story points d'una història són la suma de les hores estimades de les seves tasques.

Fites: review del Sprint 1 i planning 09/11 · demo d'aspectes metodològics i transversals 23/11 · retrospectiva 25/11 · lliurament 27/11 · review i planning del Sprint 3 el 30/11.

Font de veritat: [taulell de Taiga](https://tree.taiga.io/project/mohamed-dari-pes_22_c_talaia/taskboard/sprint-2-932). Si aquest fitxer i Taiga no coincideixen, mana Taiga.

Les tasques del Sprint 1 que no es tanquin el 28/10 s'hi afegeixen a la planning del 09/11.

## HU05 · Consultar la visibilitat d'una ubicació escollida manualment · [TG-28](https://tree.taiga.io/project/mohamed-dari-pes_22_c_talaia/us/28)
Èpica E01 · Recomanacions d'observació · **9 SP**  
*Com a usuari, vull tocar qualsevol lloc del mapa i obtenir-ne l'índex, de manera que pugui avaluar llocs que no són a la llista.*

**Criteris d'acceptació**
- [ ] Tocant qualsevol lloc del mapa dins de Catalunya es mostra l'índex d'aquella ubicació per a l'hora triada.
- [ ] La resposta arriba en menys de 3 s, i una segona consulta del mateix lloc i hora surt de la memòria cau.
- [ ] Fora de Catalunya o sense dades, es mostra un missatge clar.

| Ref | Tasca | Responsable | Inici | Límit | h |
|---|---|---|---|---|---|
| TG-130 | Endpoint GET /api/v1/visibilitat (lat, lon, hora): índex al moment per a qualsevol ubicació, amb memòria cau | Hugo | 10/11 | 13/11 | 4 |
| TG-131 | Tocar el mapa per triar una ubicació i veure'n l'índex (mockup 04) | Joan | 16/11 | 19/11 | 4 |
| TG-132 | Tests de l'endpoint de visibilitat i de la memòria cau | Hugo | 13/11 | 17/11 | 1 |

## HU02 · Trobar punts recomanats prop de la ubicació actual · [TG-27](https://tree.taiga.io/project/mohamed-dari-pes_22_c_talaia/us/27)
Èpica E01 · Recomanacions d'observació · **5 SP**  
*Com a usuari, vull veure els millors punts a prop de la meva ubicació, de manera que pugui sortir a observar sense planificar-ho.*

**Criteris d'acceptació**
- [ ] Amb el permís de localització, «A prop meu» mostra el rànquing de punts dins del radi per defecte des de la ubicació actual.
- [ ] Si es denega el permís, l'app demana triar l'origen a mà.

| Ref | Tasca | Responsable | Inici | Límit | h |
|---|---|---|---|---|---|
| TG-133 | Recomanacions «a prop meu»: la ubicació de l'usuari com a origen i un radi per defecte a /recomanacions | Mohamed | 10/11 | 12/11 | 2 |
| TG-134 | Accés «A prop meu» al mapa amb la ubicació actual i el rànquing | Joan | 12/11 | 16/11 | 3 |

## HU08 · Consultar com arribar a un punt d'observació · [TG-29](https://tree.taiga.io/project/mohamed-dari-pes_22_c_talaia/us/29)
Èpica E02 · Exploració de punts d'observació · **6 SP**  
*Com a usuari, vull veure la distància i el temps fins al punt i obrir la navegació al mapa del mòbil, de manera que hi pugui arribar fàcilment.*

**Criteris d'acceptació**
- [ ] La fitxa del punt mostra la distància i el temps des de la ubicació de l'usuari, obtinguts del servei de Mobilicat.
- [ ] «Com arribar» obre el mapa del mòbil (Apple Maps o Google Maps) amb el destí.
- [ ] Si el servei de Mobilicat no respon, la fitxa es mostra igualment, sense distància ni temps.

| Ref | Tasca | Responsable | Inici | Límit | h |
|---|---|---|---|---|---|
| TG-135 | Client del servei de rutes de Mobilicat a l'API (distància i temps), amb resposta parcial si no respon | Victor | 10/11 | 13/11 | 3 |
| TG-136 | Distància, temps i botó «Com arribar» a la fitxa del punt, amb deep link al mapa del mòbil | Vinyet | 16/11 | 18/11 | 2 |
| TG-137 | Tests del client de rutes (contracte i caiguda del servei) | Victor | 13/11 | 17/11 | 1 |

## HU10 · Consultar l'explicació i l'horari d'un fenomen · [TG-30](https://tree.taiga.io/project/mohamed-dari-pes_22_c_talaia/us/30)
Èpica E03 · Calendari de fenòmens astronòmics · **5 SP**  
*Com a usuari, vull obrir la fitxa d'un fenomen amb l'explicació i l'horari, de manera que sàpiga què veuré i a quina hora.*

**Criteris d'acceptació**
- [ ] En tocar un fenomen del calendari s'obre la seva fitxa amb l'explicació i l'horari (inici, màxim i fi) en hora local.
- [ ] L'explicació es mostra en l'idioma de l'app.

| Ref | Tasca | Responsable | Inici | Límit | h |
|---|---|---|---|---|---|
| TG-138 | Endpoint GET /api/v1/esdeveniments/{id} amb l'explicació i l'horari | Victor | 10/11 | 12/11 | 2 |
| TG-139 | Pantalla de la fitxa de l'esdeveniment (mockup 09) | Joan | 11/11 | 16/11 | 3 |

## HU11 · Cercar punts d'observació per a un fenomen del calendari · [TG-31](https://tree.taiga.io/project/mohamed-dari-pes_22_c_talaia/us/31)
Èpica E03 · Calendari de fenòmens astronòmics · **3 SP**  
*Com a usuari, vull obtenir els millors punts per a un fenomen concret, de manera que pugui planificar on veure'l.*

**Criteris d'acceptació**
- [ ] Des de la fitxa d'un fenomen, «On veure-ho» obre el rànquing de punts amb el fenomen i la data preomplerts.
- [ ] El rànquing fa servir l'índex de la finestra horària del fenomen.

| Ref | Tasca | Responsable | Inici | Límit | h |
|---|---|---|---|---|---|
| TG-140 | Recomanacions per a un esdeveniment: la seva finestra horària a /recomanacions | Mohamed | 12/11 | 16/11 | 2 |
| TG-141 | Botó «On veure-ho» de la fitxa de l'esdeveniment cap al rànquing de punts | Vinyet | 18/11 | 19/11 | 1 |

## HU43 · Consultar per API els esdeveniments astronòmics d'un període · [TG-26](https://tree.taiga.io/project/mohamed-dari-pes_22_c_talaia/us/26)
Èpica E12 · Servei d'esdeveniments per a altres equips · **4 SP**  
*Com a equip extern (Aprop), vull consultar per API els esdeveniments d'un període i tipus, de manera que els pugui integrar a la meva aplicació.*

**Criteris d'acceptació**
- [ ] L'endpoint d'esdeveniments és accessible des de fora amb una clau d'API per equip i té límit de peticions.
- [ ] La documentació OpenAPI és pública i hi ha una guia d'integració.
- [ ] L'equip d'Aprop ha fet com a mínim una petició real des de la seva app.

| Ref | Tasca | Responsable | Inici | Límit | h |
|---|---|---|---|---|---|
| TG-142 | Publicar el servei per a Aprop: clau d'API per equip, límit de peticions i CORS | Victor | 13/11 | 17/11 | 2 |
| TG-143 | Documentació OpenAPI pública i guia d'integració per a Aprop | Victor | 17/11 | 18/11 | 1 |
| TG-144 | Prova d'integració amb l'equip d'Aprop i recollida del seu feedback | Victor | 18/11 | 20/11 | 1 |

## HU16 · Crear una alerta segons el fenomen i la zona · [TG-37](https://tree.taiga.io/project/mohamed-dari-pes_22_c_talaia/us/37)
Èpica E05 · Alertes personalitzades · **6 SP**  
*Com a usuari, vull crear una alerta per fenomen, distància i índex mínim, de manera que em notifiquin quan valgui la pena sortir.*

**Criteris d'acceptació**
- [ ] L'usuari pot crear una alerta amb fenomen, distància màxima des d'un origen i índex mínim.
- [ ] L'alerta queda desada i només la veu qui l'ha creat.

| Ref | Tasca | Responsable | Inici | Límit | h |
|---|---|---|---|---|---|
| TG-145 | Model de dades d'alertes i endpoints POST/GET /api/v1/alertes (només les de l'usuari) | Mohamed | 09/11 | 11/11 | 3 |
| TG-146 | Pantalla «Nova alerta» (mockup 11): fenomen, distància i índex mínim | Joan | 11/11 | 16/11 | 3 |

## HU19 · Activar o desactivar una alerta · [TG-40](https://tree.taiga.io/project/mohamed-dari-pes_22_c_talaia/us/40)
Èpica E05 · Alertes personalitzades · **4 SP**  
*Com a usuari, vull activar o desactivar una alerta, de manera que controli les notificacions.*

**Criteris d'acceptació**
- [ ] La pantalla d'alertes llista les alertes de l'usuari amb un interruptor per activar-les o desactivar-les.
- [ ] Una alerta desactivada no envia notificacions.

| Ref | Tasca | Responsable | Inici | Límit | h |
|---|---|---|---|---|---|
| TG-147 | Endpoint PATCH /api/v1/alertes/{id} (activa i preferències) | Mohamed | 11/11 | 12/11 | 1 |
| TG-148 | Pantalla «Alertes» (mockup 10) amb la llista i l'interruptor d'activació | Martina | 16/11 | 18/11 | 3 |

## HU18 · Modificar les preferències d'una alerta · [TG-39](https://tree.taiga.io/project/mohamed-dari-pes_22_c_talaia/us/39)
Èpica E05 · Alertes personalitzades · **2 SP**  
*Com a usuari, vull editar una alerta, de manera que ajusti quan em notifiquen.*

**Criteris d'acceptació**
- [ ] Es poden editar el fenomen, la distància i l'índex mínim d'una alerta, i els canvis s'apliquen al recàlcul següent.

| Ref | Tasca | Responsable | Inici | Límit | h |
|---|---|---|---|---|---|
| TG-149 | Editar una alerta des de la llista (reutilitza «Nova alerta») | Martina | 18/11 | 20/11 | 2 |

## HU20 · Eliminar una alerta · [TG-41](https://tree.taiga.io/project/mohamed-dari-pes_22_c_talaia/us/41)
Èpica E05 · Alertes personalitzades · **1 SP**  
*Com a usuari, vull eliminar una alerta, de manera que deixi de rebre-la.*

**Criteris d'acceptació**
- [ ] Es pot eliminar una alerta des de la llista, amb confirmació, i deixa de notificar.

| Ref | Tasca | Responsable | Inici | Límit | h |
|---|---|---|---|---|---|
| TG-150 | Endpoint DELETE /api/v1/alertes/{id} i eliminar-la des de la llista | Martina | 19/11 | 20/11 | 1 |

## HU17 · Rebre una alerta quan hi hagi condicions favorables d'observació · [TG-38](https://tree.taiga.io/project/mohamed-dari-pes_22_c_talaia/us/38)
Èpica E05 · Alertes personalitzades · **13 SP**  
*Com a usuari, vull rebre una notificació push quan es compleixin les condicions, de manera que no perdi les bones nits.*

**Criteris d'acceptació**
- [ ] Quan, després d'un recàlcul, un punt dins de la zona d'una alerta activa supera l'índex mínim, l'usuari rep una notificació push.
- [ ] No es rep més d'una notificació per alerta i nit.
- [ ] En tocar la notificació s'obre la fitxa del punt.
- [ ] Si l'usuari no dona permís de notificacions, l'app continua funcionant i ho indica a la pantalla d'alertes.

| Ref | Tasca | Responsable | Inici | Límit | h |
|---|---|---|---|---|---|
| TG-151 | ADR de les notificacions push (Expo Push Service; a Android, Expo Go no en rep des de l'SDK 53) | Martina | 09/11 | 10/11 | 1 |
| TG-152 | Permís i registre del token de notificacions a l'app (expo-notifications) | Martina | 10/11 | 13/11 | 3 |
| TG-153 | Avaluació de les alertes al worker després de cada recàlcul de l'índex | Hugo | 12/11 | 17/11 | 4 |
| TG-154 | Enviament push sense repetir la mateixa nit, i obrir la fitxa en tocar la notificació (mockup 07) | Martina | 16/11 | 19/11 | 3 |
| TG-155 | Tests de l'avaluació i de l'enviament de les alertes | Hugo | 17/11 | 19/11 | 2 |

## HU12 · Crear un pla amb punt, fenomen, data i hora · [TG-33](https://tree.taiga.io/project/mohamed-dari-pes_22_c_talaia/us/33)
Èpica E04 · Plans personals d'observació · **9 SP**  
*Com a usuari, vull crear un pla d'observació sincronitzable amb el calendari del mòbil, de manera que no m'oblidi de la sortida.*

**Criteris d'acceptació**
- [ ] L'usuari pot crear un pla triant punt, fenomen, data i hora, i queda desat al seu compte.
- [ ] Amb el permís de calendari, el pla s'afegeix al calendari del mòbil; si és el de Google, apareix a Google Calendar.

| Ref | Tasca | Responsable | Inici | Límit | h |
|---|---|---|---|---|---|
| TG-156 | Model de dades de plans i endpoints POST/GET /api/v1/plans | Mohamed | 12/11 | 16/11 | 3 |
| TG-157 | Pantalla «Pla d'observació» (mockup 06): punt, fenomen, data i hora | Mohamed | 16/11 | 18/11 | 3 |
| TG-158 | Afegir el pla al calendari del mòbil (expo-calendar), que el sincronitza amb Google Calendar | Joan | 18/11 | 20/11 | 2 |
| TG-159 | Tests dels endpoints de plans i del ViewModel | Mohamed | 18/11 | 20/11 | 1 |

## HU13 · Consultar els plans d'observació desats · [TG-34](https://tree.taiga.io/project/mohamed-dari-pes_22_c_talaia/us/34)
Èpica E04 · Plans personals d'observació · **2 SP**  
*Com a usuari, vull veure la llista dels meus plans, de manera que tingui present les properes sortides.*

**Criteris d'acceptació**
- [ ] «Els meus plans» llista els plans futurs per data, i els passats a part.

| Ref | Tasca | Responsable | Inici | Límit | h |
|---|---|---|---|---|---|
| TG-160 | Pantalla «Els meus plans» (mockup 13) | Mohamed | 18/11 | 20/11 | 2 |

## HU14 · Modificar un pla d'observació · [TG-35](https://tree.taiga.io/project/mohamed-dari-pes_22_c_talaia/us/35)
Èpica E04 · Plans personals d'observació · **2 SP**  
*Com a usuari, vull editar un pla, de manera que l'adapti si canvien les condicions.*

**Criteris d'acceptació**
- [ ] Es poden modificar la data, l'hora i el punt d'un pla, i l'esdeveniment del calendari s'actualitza.

| Ref | Tasca | Responsable | Inici | Límit | h |
|---|---|---|---|---|---|
| TG-161 | Modificar un pla: PATCH /api/v1/plans/{id} i edició des de la pantalla del pla i al calendari | Mohamed | 23/11 | 25/11 | 2 |

## HU15 · Eliminar un pla d'observació · [TG-36](https://tree.taiga.io/project/mohamed-dari-pes_22_c_talaia/us/36)
Èpica E04 · Plans personals d'observació · **1 SP**  
*Com a usuari, vull eliminar un pla, de manera que mantingui la llista neta.*

**Criteris d'acceptació**
- [ ] Es pot eliminar un pla, amb confirmació, i s'elimina també del calendari del mòbil.

| Ref | Tasca | Responsable | Inici | Límit | h |
|---|---|---|---|---|---|
| TG-162 | Eliminar un pla: DELETE /api/v1/plans/{id}, des de la llista i del calendari | Joan | 23/11 | 24/11 | 1 |

## HU37 · Canviar l'idioma de l'aplicació · [TG-42](https://tree.taiga.io/project/mohamed-dari-pes_22_c_talaia/us/42)
Èpica E10 · Compte i perfil d'usuari · **5 SP**  
*Com a usuari, vull canviar l'idioma (català, castellà, anglès), de manera que utilitzi l'app en la meva llengua.*

**Criteris d'acceptació**
- [ ] Des del perfil es pot triar català, castellà o anglès, i l'app canvia a l'instant.
- [ ] L'idioma triat es manté en tornar a obrir l'app.
- [ ] El contingut de l'API (fenòmens i punts) arriba en l'idioma triat.

| Ref | Tasca | Responsable | Inici | Límit | h |
|---|---|---|---|---|---|
| TG-163 | Selector d'idioma al perfil, persistit, i idioma de les respostes de l'API (Accept-Language) | Vinyet | 16/11 | 19/11 | 3 |
| TG-164 | Contingut de l'API en ca/es/en (noms i descripcions de fenòmens i punts) | Victor | 12/11 | 16/11 | 2 |

## HU36 · Consultar i editar el perfil · [TG-43](https://tree.taiga.io/project/mohamed-dari-pes_22_c_talaia/us/43)
Èpica E10 · Compte i perfil d'usuari · **5 SP**  
*Com a usuari, vull veure i editar el meu perfil, de manera que mantingui les dades al dia.*

**Criteris d'acceptació**
- [ ] El perfil mostra el nom, el correu i l'avatar, i es pot editar el nom.
- [ ] Els canvis es desen a la base de dades.

| Ref | Tasca | Responsable | Inici | Límit | h |
|---|---|---|---|---|---|
| TG-165 | Endpoints GET/PATCH /api/v1/perfil | Martina | 17/11 | 19/11 | 2 |
| TG-166 | Pantalla de perfil (mockup 14) | Vinyet | 19/11 | 24/11 | 3 |

## HU38 · Eliminar el compte i les dades personals · [TG-44](https://tree.taiga.io/project/mohamed-dari-pes_22_c_talaia/us/44)
Èpica E10 · Compte i perfil d'usuari · **3 SP**  
*Com a usuari, vull eliminar el meu compte i totes les dades, de manera que s'exerceixi el meu dret a l'oblit (RGPD).*

**Criteris d'acceptació**
- [ ] Des del perfil es pot eliminar el compte amb una confirmació explícita.
- [ ] S'esborren l'usuari d'Auth i totes les seves dades (plans, alertes, favorits, observacions i fotos).
- [ ] Després, la sessió es tanca i les credencials ja no serveixen.

| Ref | Tasca | Responsable | Inici | Límit | h |
|---|---|---|---|---|---|
| TG-167 | Eliminar el compte: endpoint que esborra l'usuari de Supabase Auth i totes les seves dades (RGPD) | Martina | 23/11 | 25/11 | 2 |
| TG-168 | Opció «Eliminar el compte» al perfil, amb confirmació | Vinyet | 24/11 | 25/11 | 1 |

## HU25 · Desar un punt d'observació com a favorit · [TG-45](https://tree.taiga.io/project/mohamed-dari-pes_22_c_talaia/us/45)
Èpica E07 · Punts favorits · **3 SP**  
*Com a usuari, vull marcar un punt com a favorit, de manera que el trobi ràpidament.*

**Criteris d'acceptació**
- [ ] Des de la fitxa d'un punt es pot marcar com a favorit, i el canvi es veu a l'instant.

| Ref | Tasca | Responsable | Inici | Límit | h |
|---|---|---|---|---|---|
| TG-169 | Model de favorits i endpoints POST/DELETE/GET /api/v1/favorits | Hugo | 16/11 | 17/11 | 2 |
| TG-170 | Botó de favorit a la fitxa del punt | Vinyet | 19/11 | 20/11 | 1 |

## HU26 · Consultar els punts favorits · [TG-46](https://tree.taiga.io/project/mohamed-dari-pes_22_c_talaia/us/46)
Èpica E07 · Punts favorits · **2 SP**  
*Com a usuari, vull veure els meus punts favorits, de manera que accedeixi als llocs que m'agraden.*

**Criteris d'acceptació**
- [ ] El perfil llista els punts favorits, i en tocar-ne un s'obre la fitxa.

| Ref | Tasca | Responsable | Inici | Límit | h |
|---|---|---|---|---|---|
| TG-171 | Llista de punts favorits al perfil | Vinyet | 24/11 | 25/11 | 2 |

## HU27 · Eliminar un punt dels favorits · [TG-47](https://tree.taiga.io/project/mohamed-dari-pes_22_c_talaia/us/47)
Èpica E07 · Punts favorits · **1 SP**  
*Com a usuari, vull treure un punt dels favorits, de manera que mantingui la llista útil.*

**Criteris d'acceptació**
- [ ] Es pot treure un punt dels favorits des de la fitxa i des de la llista.

| Ref | Tasca | Responsable | Inici | Límit | h |
|---|---|---|---|---|---|
| TG-172 | Treure un punt dels favorits des de la fitxa i des de la llista | Vinyet | 25/11 | 26/11 | 1 |

## HU39 · Gestionar els punts d'observació des de la web d'administració · [TG-52](https://tree.taiga.io/project/mohamed-dari-pes_22_c_talaia/us/52)
Èpica E11 · Administració i moderació · **12 SP**  
*Com a administrador, vull crear, editar i retirar punts d'observació, de manera que el catàleg sigui correcte.*

**Criteris d'acceptació**
- [ ] Només un compte amb rol d'administrador pot entrar a la web d'administració.
- [ ] L'administrador pot crear, editar i retirar punts; un punt retirat deixa de sortir a l'app.
- [ ] La web se serveix a la VM amb HTTPS.

| Ref | Tasca | Responsable | Inici | Límit | h |
|---|---|---|---|---|---|
| TG-173 | ADR de la web d'administració (P11) i scaffold Vite + React amb accés només per a administradors | Victor | 09/11 | 12/11 | 4 |
| TG-174 | Endpoints d'administració per crear, editar i retirar punts (rol admin) | Hugo | 11/11 | 13/11 | 3 |
| TG-175 | Llista i formulari de punts a la web d'administració | Victor | 16/11 | 19/11 | 4 |
| TG-176 | Servir la web d'administració a la VM (Nginx) | Mohamed | 19/11 | 20/11 | 1 |

## HU41 · Bloquejar i desbloquejar comptes d'usuari · [TG-54](https://tree.taiga.io/project/mohamed-dari-pes_22_c_talaia/us/54)
Èpica E11 · Administració i moderació · **5 SP**  
*Com a moderador, vull bloquejar i desbloquejar comptes, de manera que pugui actuar davant d'abusos.*

**Criteris d'acceptació**
- [ ] Des de la web d'administració es pot bloquejar i desbloquejar un compte.
- [ ] Un compte bloquejat rep 403 a totes les rutes protegides de l'API, i l'app li mostra un avís.

| Ref | Tasca | Responsable | Inici | Límit | h |
|---|---|---|---|---|---|
| TG-177 | Bloquejar i desbloquejar comptes: endpoint d'admin i rebuig (403) de les peticions d'un compte bloquejat | Martina | 12/11 | 16/11 | 2 |
| TG-178 | Pantalla d'usuaris amb el bloqueig a la web d'administració | Victor | 19/11 | 20/11 | 2 |
| TG-179 | Avís a l'app quan el compte està bloquejat | Martina | 17/11 | 18/11 | 1 |

## [TEC] Qualitat, desplegament i índex v2 (Sprint 2) · [TG-117](https://tree.taiga.io/project/mohamed-dari-pes_22_c_talaia/us/117)
Història tècnica (sense èpica de producte) · **15 SP**  
Història tècnica del Sprint 2: aspectes metodològics (desplegament automàtic, cobertura, RNF mesurables, gestió de bugs), índex v2 i feedback d'usuaris reals.

| Ref | Tasca | Responsable | Inici | Límit | h |
|---|---|---|---|---|---|
| TG-180 | Desplegament automàtic a la VM en cada push a stable (GitHub Actions) | Mohamed | 16/11 | 18/11 | 3 |
| TG-181 | Informe de cobertura a la CI i a SonarCloud, amb llindar mínim al codi nou | Vinyet | 10/11 | 12/11 | 2 |
| TG-182 | Primera mesura dels RNF de Taiga (càrrega del mapa, p95 de l'API, cobertura, accessibilitat) | Hugo | 18/11 | 20/11 | 2 |
| TG-183 | Procés de bugs a Taiga (issues amb tipus i severitat, enllaç a la PR) i triatge dels del Sprint 1 | Joan | 09/11 | 10/11 | 1 |
| TG-184 | Índex v2: perfil d'horitzó i ajust amb les observacions de Meteocat | Hugo | 19/11 | 24/11 | 4 |
| TG-185 | Tests de l'índex v2 | Hugo | 24/11 | 26/11 | 1 |
| TG-186 | Sessió de feedback amb usuaris reals (aficionats a l'astronomia) amb l'app del Sprint 2 | Victor | 23/11 | 26/11 | 2 |

## [GES] Gestió i cerimònies del Sprint 2 · [TG-118](https://tree.taiga.io/project/mohamed-dari-pes_22_c_talaia/us/118)
Fora del sprint backlog (sense story points, no compta al burndown). Les hores es registren a la PRT.

| Ref | Tasca | Responsable | Inici | Límit | h |
|---|---|---|---|---|---|
| TG-187 | Sprint Planning (09/11) i lliurament de planning_2.pdf | Martina | 09/11 | 09/11 | 2 |
| TG-188 | Daily scrums a classe i seguiment del taulell | Martina | 09/11 | 25/11 | 2 |
| TG-189 | Release 0.2.0 (snapshot → stable) i desplegament per a la demo | Martina | 20/11 | 20/11 | 1 |
| TG-190 | Retrospective Meeting (25/11) i lliurament de report_2.pdf | Martina | 25/11 | 27/11 | 2 |
| TG-191 | Preparar i assajar la demo d'aspectes metodològics i transversals (23/11) | Vinyet | 19/11 | 23/11 | 3 |
| TG-192 | Actualitzar la PRT i els gràfics de burndown i velocitat | Victor | 25/11 | 27/11 | 1 |
| TG-193 | Actualitzar la memòria (requisits, metodologia i descripció tècnica) | Hugo | 24/11 | 27/11 | 2 |
| TG-194 | Explicar a la memòria com fem servir els assistents de codi (procés, CLAUDE.md, skills) | Joan | 23/11 | 26/11 | 2 |
| TG-195 | Revisió de codi de les PR | Mohamed | 09/11 | 26/11 | 2 |

## Repartiment d'hores

Backlog del sprint i gestió [GES], per persona. L'acumulat inclou el Sprint 1 i serveix per equilibrar la càrrega del curs. Joan porta més pantalles de disseny a petició seva.

| Persona | Sprint 2 | Acumulat |
|---|---|---|
| Joan | 19 | 65 |
| Vinyet | 19 | 45 |
| Martina | 27 | 42 |
| Mohamed | 25 | 48 |
| Hugo | 25 | 39 |
| Victor | 25 | 41 |
