# Inventari de proves de presentació (TG-260)

Inventari de les pantalles mòbils existents a `snapshot` (base `5f60772`). El
procediment i els criteris són a [testing-ui.md](testing-ui.md). Les rutes de
recomanacions utilitzen `MapScreen`; no són una vista sense tests.

Els noms de fitxer de la taula corresponen a `__tests__` dins de cada mòdul de
`apps/mobile/src/features`. Les proves noves mantenen les vistes, els ViewModels
i els components compartits reals i simulen les dependències externes.

## Validació automàtica

Executada el 13/11/2026 amb Node 22.23.3:

- `npm run test --workspace apps/mobile -- --ci --runInBand`: 76 suites i 449 tests correctes (54 tests nous).
- `npm test`: correctes els tests de tots els workspaces que en disposen.
- `npm run typecheck --workspace apps/mobile`: correcte.
- `npm run typecheck`: correcte en tots els workspaces, després d’instal·lar les
  dependències locals d’admin ja declarades al projecte; manifests i lockfile sense canvis.
- `npm run lint`: sense errors; un avís a `apps/mobile/src/core/i18n/index.ts:43`
  (`import/no-named-as-default-member`), un fitxer que aquesta tasca no modifica.

## Pantalles

La taula identifica les proves disponibles, ampliades després del contrast
exhaustiu dels controls i estats amb els tests automàtics. Vinyet confirma la
revisió visual de les pantalles en iPhone amb Expo Go, en ca/es/en, incloent-hi
selectors oberts, formularis i estats. La segona columna descriu la cobertura
automàtica; el registre visual de sota concreta la confirmació manual i les
configuracions que encara no es poden donar per cobertes.

| Pantalla | Estats i interaccions | Tests existents o afegits | Entorn visual | Resultat i evidència | Pendent |
| --- | --- | --- | --- | --- | --- |
| Benvinguda | Proveïdors per plataforma, navegació, errors, intro i moviment reduït | `auth/WelcomeScreen.test.tsx` (ampliat) | iPhone · Expo Go · ca/es/en; vegeu el registre visual | Tests automàtics; no acredita absència de retalls | Completar metadades i evidències; vegeu pendents |
| Correu | Validació, enviament des del botó i teclat, enviament pendent, error, codi, verificació pendent, reenviament, reintent i canvi d’adreça | `auth/EmailLoginScreen.test.tsx` (nou), `auth/EmailLoginCloseButton.test.tsx` (existent) | iPhone · Expo Go · ca/es/en; vegeu el registre visual | Proves del formulari amb serveis simulats | Completar metadades i evidències; vegeu pendents |
| Retorn de l’enllaç de correu | Càrrega, error de l’enllaç, caducitat i retorn a la benvinguda | `auth/EmailLinkScreen.test.tsx` (nou) | iPhone · Expo Go · ca/es/en; vegeu el registre visual | Proves de la vista; navegació reeixida també coberta al ViewModel | Completar metadades i evidències; vegeu pendents |
| Error de restauració de sessió | Missatge i reintent | `auth/RestoreErrorScreen.test.tsx` (existent) | iPhone · Expo Go · ca/es/en; vegeu el registre visual | Tests automàtics | Completar metadades i evidències; vegeu pendents |
| Compte bloquejat | Avís, sortida de sessió, estat pendent i error; contacte amb l’equip (TG-179): botó «Escriu a…» amb i sense `EXPO_PUBLIC_CONTACT_EMAIL`, avís quan no es pot obrir el correu i adreça seleccionable | `auth/AccountBlockedScreen.test.tsx` (ampliat), `auth/useAccountBlockedViewModel.test.tsx` | iPhone · Expo Go · ca/es/en; vegeu el registre visual. El contacte (PR #132) no hi és inclòs | Tests automàtics | Completar metadades i evidències; comprovació visual del contacte a Expo Go (PR #132); vegeu pendents |
| Explora | Fenòmens, dia, franja horària, distància, navegació i àrea segura | `explore/ExploreScreen.test.tsx` (ampliat) | iPhone · Expo Go · ca/es/en; vegeu el registre visual | Tests automàtics; la prova d’àrea segura no mesura la geometria final | Completar metadades i evidències; vegeu pendents |
| Mapa i recomanacions | Marcadors, rànquing, full plegable, navegació, càrrega, buit i reintent; punt triat al mapa (TG-131): targeta, càlcul, resultat, de dia, fora de Catalunya, reintent i tancament | `map/MapScreen.test.tsx` (ampliat), `map/useMapSpot.test.tsx` | iPhone · Expo Go · ca/es/en; vegeu el registre visual | Tests de pantalla amb el mapa simulat; DOM cobert separadament | Completar metadades i evidències; vegeu pendents |
| Fitxa d'esdeveniment i rànquing des del Calendari (TG-141, PR #160) | «On veure-ho», origen, retorn a la fitxa, full plegable; esdeveniment passat desactivat i `franja_passada` sense reintent | `event/__tests__/EventDetailScreen.test.tsx`, `event/__tests__/useEventRecommendations.test.tsx`, `map/__tests__/MapScreen.test.tsx`, `recommendations/__tests__/useRecommendationsViewModel.test.tsx` | iOS físic · ca/es/en, confirmació anterior; Vinyet confirma el 18/11/2026 Expo Go i el full tant des d'Explora com del Calendari | Confirmació directa de la responsable; proves automàtiques dels estats nous | Captures/vídeo, model, versió d'iOS i mida de text; revisió visual de l'estat passat afegit en aquesta correcció; Android i text ampliat |
| Fitxa del punt | Dades, hores, factors, reintent i 404 | `point/PointDetailScreen.test.tsx` (existent), `point/PointDetailStates.test.tsx` (nou) | iPhone · Expo Go · ca/es/en; vegeu el registre visual | Tests automàtics | Completar metadades i evidències; vegeu pendents |
| Rutes des de la fitxa (TG-136, PR #182) | «Com arribar» només consulta Mobilicat en prémer-lo; alternatives i trams, hora de sortida, retorn a la fitxa i obertura de Maps; sense ubicació, sense rutes i error | `point/PointDetailScreen.test.tsx`, `point/usePointDetailViewModel.test.tsx` | iPhone 14 · iOS 26.6.2 · Expo Go · ca/es/en · text normal | Captures a la PR #182; 39 tests de la fitxa executats en aquesta revisió | Comprovar Android, text ampliat, mode nit i les rodes d'Explora, Nou pla i Alertes |
| Fitxa del punt: fila «Humitat» de l'índex v2 (TG-184, PR #176) | Fila amb la icona de la gota entre la Lluna i el Sol només a les hores v2; color segons quant resta (100 verd, ≥ 85 groc, < 85 vermell); pista i, a sota, la cita del Servei Meteorològic de Catalunya quan la humitat és corregida | `point/usePointDetailViewModel.test.tsx` i `point/PointDetailScreen.test.tsx` (ampliats) | Pendent (Expo Go) | Tests automàtics amb l'API simulada | Revisar al dispositiu la fila amb la cita (dues línies) en ca/es/en, amb text ampliat i en mode nit (icona tenyida) |
| Favorit a la fitxa (TG-170; retirada de TG-172) | Botó accessible; estat inicial, desament i retirada immediats, errors amb reversió i reintent, sessió absent | `point/FavoriteButton.test.tsx`; `point/PointDetailScreen.test.tsx` (pantalla existent) | Pendent (Expo Go) | Tests automàtics amb l'API simulada | Revisar al dispositiu la fila sota el mapa, la zona segura, les mides de text i els estats en ca/es/en, iOS i Android |
| Pla d'observació (TG-157, TG-158) | Formulari, calendaris modificables, manca de suport o permís, selector de calendari, desament i error parcial amb reintent sense duplicats | `plans/NewPlanScreen.test.tsx`, `plans/useNewPlanViewModel.test.tsx`, `plans/usePlanCalendar.test.tsx`, `plans/planCalendarRepository.test.ts`, `plans/planCalendarModel.test.ts` | Pendent al mòbil | Tests de plans correctes; pantalla nova en ca/es/en amb calendari simulat | Revisió visual, permisos i desament reals, sincronització de Google, fulls i teclat, pantalla petita i text ampliat, ca/es/en, iOS i Android |
| Els meus plans (TG-160) | Pastilles «Propers» i «Passats» (els passats es demanen en obrir-los); esquelets mentre carreguen; fila amb el dia i el mes, el fenomen o «Cel estrellat» amb el municipi i la sortida; obrir la fitxa del punt; pla d'un punt retirat desactivat; buit amb «Troba un lloc» (només als propers) i error amb reintent; entrada des de Perfil només amb sessió | `plans/PlansScreen.test.tsx`, `plans/usePlansViewModel.test.tsx` (nous); `plans/planModel.test.ts`, `plans/plansRepository.test.tsx`, `profile/ProfileScreen.test.tsx` i `profile/useProfileViewModel.test.tsx` (ampliats) | Pendent (Expo Go) | Tests automàtics amb l'API simulada | Comprovació visual a Expo Go: llista buida, pla nou a «Propers» sense recarregar, passats atenuats, mode nit (vermell), títols llargs en ca/es/en i amb text ampliat |
| Calendari | Llista, filtres, passats, selecció de dia, mes, retorn a avui, càrrega, error i buit | `calendar/CalendarScreen.test.tsx` (nou); ViewModel i calendari compartit ja provats | iPhone · Expo Go · ca/es/en; vegeu el registre visual | Proves de la pantalla amb la consulta simulada | Completar metadades i evidències; vegeu pendents |
| Alertes | Càrrega (esquelets), llista, buida i error amb reintent; tipus d'avís amb la seva icona i el seu text («Cada nit a les 18:00» / «Quan l'índex arribi a 70», TG-268) i resum en temps de cotxe (amb l'índex només a les d'hora), alerta desactivada apagada i text que no tapa l'interruptor; interruptor optimista amb `PATCH /alertes/{id}` (TG-147) i avís si falla; «Nova alerta» des de la llista i des de l'estat buit (TG-148); avís de l’estat del permís de notificacions (TG-152): denegat amb el botó que obre la configuració, «no disponible» a Expo Go i al simulador sense botó, cap avís amb el permís concedit, no demanat o encara sense comprovar | `alerts/AlertsScreen.test.tsx` (ampliat), `alerts/useAlertsViewModel.test.tsx` (nou); `Toggle` amb tests propis a `shared/ui` | Pendent (Expo Go); el missatge provisional anterior es va revisar en un iPhone · Expo Go · ca/es/en | Tests automàtics amb el repository simulat | Comprovació visual a Expo Go (llista amb activa i desactivada, interruptor, buida i error, avís «no disponible»; ca/es/en, text ampliat, Android i iOS); denegat i concedit, amb el development build (PR #110) |
| Nova alerta (TG-146) | Seccions i valors per defecte, àrea segura i rètols llargs (es); final del formulari apartat de la barra de pestanyes a iOS (TG-267); ubicació buscant, error amb reintent i sense permís; fenomen, «La meva ubicació / Una zona concreta», full del mapa (triar i tancar sense triar), distància, índex per franges, tipus d'avís exclusius en targetes amb icona i text (TG-268), roda de l'hora i nota de l'avís a una hora; desar, enrere, límit d'alertes i error genèric | `alerts/NewAlertScreen.test.tsx`, `alerts/useNewAlertViewModel.test.tsx`, `alerts/ZonePickerMap.test.tsx`, `alerts/alertsRepository.test.ts` (nous) | Pendent (Expo Go) | Tests automàtics; el mapa de la zona es prova amb MapLibre simulat | Comprovació visual a Expo Go: targetes del tipus d'avís (icona, text sencer en ca/es/en, fosa en triar-les), fletxa enrere a Android, gestos del mapa dins del full, textos sencers en ca/es/en i amb text ampliat, iOS |
| Edita l'alerta (TG-149) | Des de la llista (la fila es prem; l'interruptor queda a part); formulari de «Nova alerta» amb els valors desats (fenomen, origen com a zona amb el nom, distància, índex, tipus d'avís i hora; una alerta antiga amb tots dos avisos surt com «en arribar», TG-268); «Desa els canvis» desactivat sense canvis; desa només el que canvia amb `PATCH /alertes/{id}` i torna a la llista; full de l'hora obert; carregant, alerta inexistent i error amb reintent | `alerts/EditAlertScreen.test.tsx` (nou); `alerts/useNewAlertViewModel.test.tsx`, `alerts/newAlertModel.test.ts`, `alerts/AlertsScreen.test.tsx` i `alerts/useAlertsViewModel.test.tsx` (ampliats) | Pendent (Expo Go) | Tests automàtics amb el repository simulat | Comprovació visual a Expo Go: obrir una alerta des de la llista, títol i «Desa els canvis» sencers en ca/es/en i amb text ampliat, Android i iOS |
| Perfil (TG-166) | Sessió, càrrega i error, reintent, edició del nom, canvi d’idioma des del full, selecció i persistència, confirmació de tancament de sessió i mode nit | `profile/ProfileScreen.test.tsx`, `profile/useProfileViewModel.test.tsx` (ampliats) | iPhone 14 · iOS 26.6.2 · Expo Go · ca/es/en · mida de text per defecte | Revisió visual dels estats confirmada per Vinyet; [captures a la PR #178](https://github.com/pes2627q1-22-gei-upc/talaia/pull/178); tests automàtics | Comprovar text ampliat i Android |
| Punts favorits (TG-171) | Entrada des del perfil; llista, càrrega, buit, error amb reintent; nom i municipi, cor decoratiu separat i accés a la fitxa | `profile/FavoritesScreen.test.tsx`, `profile/ProfileScreen.test.tsx` | iPhone · iOS 26.6.4 · català · text per defecte | Llista amb quatre favorits revisada per Vinyet, sense retalls ni superposicions comunicades; [registre](testing-ui-tg-171.md) i tests automàtics | Android, es/en, text ampliat i estats buit/error en dispositiu |
| Barra de pestanyes (TG-239, PR #172) | Canvi de pestanya; segon toc a l’activa (torna a l’inici de la pila); rànquing obert i plegat sobre la barra; àrees segures; etiquetes en ca/es/en; mode nit (la triada, negre sobre vermell); lletra del sistema a la mida més gran | `core/navigation/__tests__/TabBar.test.tsx` (nou), `core/navigation/__tests__/TabsLayout.test.tsx` (actualitzat) | Simulador iPhone 17 Pro · iOS 27.0 · Expo Go i build Release · ca/es/en · text normal i `accessibility-extra-large` | Sense retalls ni superposicions en ca/es/en. El full plegat queda sobre la barra, i el segon toc torna a «Què vols veure?». Amb la lletra més gran, les etiquetes es tallaven («Expl…»): ara creixen com a molt 1,2 vegades. En mode nit, cap píxel amb verd o blau | Android; dispositiu real |

## Comprovació visual

### Revisió confirmada

Vinyet confirma la revisió visual de les pantalles inventariades en un iPhone
amb Expo Go, en català, castellà i anglès. La revisió de retalls i superposicions
es va donar per feta sense incidències comunicades. El 14/11/2026 ha concretat
que va revisar tots els selectors oberts, els formularis i els estats en aquest
iPhone. Aquesta data correspon a la confirmació, no a la data d’execució de les
proves, que no consta.

| Dada | Informació confirmada | Pendent de documentar o provar |
| --- | --- | --- |
| Entorn d’execució | iPhone amb Expo Go; iOS descrit com a «última versió» | Model d’iPhone i número exacte de versió d’iOS |
| Idiomes | Català, castellà i anglès | — |
| Casos visuals | Pantalles inventariades, selectors oberts, formularis i estats; revisió general de retalls i superposicions sense incidències comunicades | Detallar per pantalla els estats concrets i confirmar explícitament els formularis amb el teclat obert |
| Mida de text | Vinyet no recorda la configuració utilitzada | Mida de text utilitzada; comprovació amb text ampliat pendent d’acreditar |
| Evidències visuals | Confirmació manual de Vinyet recollida en aquest registre | Afegir captures o vídeos disponibles vinculats a les pantalles i estats |

### Comprovacions pendents

La revisió en ca/es/en i dels selectors, formularis i estats en iPhone queda
registrada; no cal repetir els casos ja provats. Falta completar les metadades
i les evidències indicades a la taula per fer verificable el registre.

No consten una prova específica amb pantalla petita ni amb text ampliat, ni una
confirmació explícita del teclat obert. Aquests casos queden pendents d’acreditar
o provar. Android no consta provat; les diferències de plataforma aplicables
queden pendents de comprovació quan es disposi d’aquest entorn. La revisió en
un iPhone no dona aquestes configuracions per cobertes.

La validació visual de la TG-260 continua pendent de completar aquest registre
i les comprovacions aplicables que falten.

Els tests de components compartits (`Button`, `TextField`, `Sheet`, `MonthCalendar`,
`WheelPicker`, etc.) complementen aquests tests; no cal duplicar-los a cada vista.

## Casos completats després de la revisió exhaustiva

La revisió ha contrastat els controls i els estats de cada vista amb els tests de
pantalla, ViewModel, serveis i components compartits. S’han completat les proves
automàtiques següents, sense modificar funcionalitats ni dependències:

| Àmbit | Casos completats | Proves |
| --- | --- | --- |
| Explora: ubicació | Cerca desactivada durant la localització; reintent d’error i permís des de la fila; configuració quan no es pot demanar permís | `features/explore/__tests__/ExploreScreen.test.tsx` |
| Explora: dia i selectors | Demà/aquesta nit amb data correcta a la cerca; cancel·lació del calendari; reobertura del dia personalitzat; roda de l’hora final; tancament amb Fet i conservació de la franja | `features/explore/__tests__/ExploreScreen.test.tsx` |
| Explora: accés al mapa (TG-265) | «Mostra tots els punts al mapa» és un botó secundari amb vora i icona, no un enllaç; etiqueta en ca/es/en; obre el mapa sense cercar, també sense ubicació | `features/explore/__tests__/ExploreScreen.test.tsx` |
| Fitxa: accions | Com arribar amb les coordenades correctes; error en obrir Maps; avís provisional de Crea un pla | `features/point/__tests__/PointDetailStates.test.tsx` |
| Fitxa: estats | Càrrega inicial; vista diürna; índex i metadades absents; hores buides, pendents o amb error; reintent des del desglossament; dades conservades i reintent desactivat durant el refresc | `features/point/__tests__/PointDetailStates.test.tsx` |
| Fitxa: selecció | Retorn a la millor hora quan la seleccionada desapareix després d’una actualització | `features/point/__tests__/PointDetailStates.test.tsx` |
| Fitxa: explicació de l’índex (TG-264) | «Índex d’ara · hh:mm» només per a l’índex de l’hora en curs (si no, «Índex del dia, hh:mm»: refresc fallit i canvi d’hora abans del refresc); millor moment de la nit amb el màxim de la franja; què vol dir l’índex; ajuda per tocar les hores (text i `accessibilityHint`); títol dels factors amb l’hora i el valor («a la 01:00») | `features/point/__tests__/PointDetailScreen.test.tsx`, `features/point/__tests__/usePointDetailViewModel.test.tsx` |
| Benvinguda | Invocació del proveïdor correcte des de Google/Apple; bloqueig dels tres botons durant l’autenticació pendent i recuperació després d’un error | `features/auth/__tests__/WelcomeScreen.test.tsx` |
| Compte bloquejat | Reconsulta des del botó; bloqueig del reintent i del logout mentre comprova; finalització de la consulta; botó «Escriu a…» només amb el correu configurat i `mailto:` amb l’assumpte i el compte de la sessió (sense cos si la sessió no té correu); avís seleccionable amb l’adreça quan no es pot obrir el correu, que desapareix en reintentar-ho amb èxit (TG-179) | `features/auth/__tests__/AccountBlockedScreen.test.tsx`, `features/auth/__tests__/useAccountBlockedViewModel.test.tsx` |
| Targeta d’estat de l’API | Càrrega, resposta, error, botó de reintent i recuperació | `features/apiStatus/__tests__/ApiStatusCard.test.tsx` |
| Mapa i recomanacions | Avís diürn a la vista; retorn de la llista completa a la curta | `features/map/__tests__/MapScreen.test.tsx` |
| Full compartit | Botó enrere d’Android i gest d’escapament accessible | `shared/ui/__tests__/Sheet.test.tsx` |
| Calendari compartit | Gestos de lliscar en les dues direccions i respecte dels límits | `shared/ui/__tests__/MonthCalendar.test.tsx` |
| Navegació auxiliar | Ruta inexistent i retorn real a l’inici; renderització del layout segons l’estat de sessió i etiquetes de les quatre pestanyes | `core/navigation/__tests__/NotFound.test.tsx`, `core/navigation/__tests__/TabsLayout.test.tsx` |

Els camins d’aquesta taula són relatius a `apps/mobile/src`. El test de ruta
inexistent utilitza Expo Router real; el del layout simula els `Tabs` i les
pantalles filles per comprovar la selecció de vista. La targeta d’estat del perfil
ara disposa efectivament de la seva prova de vista pròpia.

No s’han duplicat tots els casos interns dels components compartits a cada
pantalla ni afegit una prova per cada text o opció amb el mateix callback. Les
comprovacions de geometria final al dispositiu requereixen el registre visual
descrit més amunt; no es poden deduir del nombre de tests.

## Abast

Aquest registre correspon a les pantalles mòbils de la TG-260. La web
`apps/admin` té un entorn propi i no disposa d’script de tests; les validacions
mòbils no s’hi atribueixen. Aquesta tasca no modifica el seu codi ni els seus
manifests de dependències.
