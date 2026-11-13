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
exhaustiu dels controls i estats amb els tests automàtics. La revisió visual
ja feta es manté com a feta.

| Pantalla | Estats i interaccions | Tests existents o afegits | Entorn visual | Resultat i evidència | Pendent |
| --- | --- | --- | --- | --- | --- |
| Benvinguda | Proveïdors per plataforma, navegació, errors, intro i moviment reduït | `auth/WelcomeScreen.test.tsx` (ampliat) | Expo Go; revisió feta i confirmada per Vinyet | Tests automàtics; no acredita absència de retalls | — |
| Correu | Validació, enviament des del botó i teclat, enviament pendent, error, codi, verificació pendent, reenviament, reintent i canvi d’adreça | `auth/EmailLoginScreen.test.tsx` (nou), `auth/EmailLoginCloseButton.test.tsx` (existent) | Expo Go; revisió feta i confirmada per Vinyet | Proves del formulari amb serveis simulats | — |
| Retorn de l’enllaç de correu | Càrrega, error de l’enllaç, caducitat i retorn a la benvinguda | `auth/EmailLinkScreen.test.tsx` (nou) | Expo Go; revisió feta i confirmada per Vinyet | Proves de la vista; navegació reeixida també coberta al ViewModel | — |
| Error de restauració de sessió | Missatge i reintent | `auth/RestoreErrorScreen.test.tsx` (existent) | Expo Go; revisió feta i confirmada per Vinyet | Tests automàtics | — |
| Compte bloquejat | Avís, sortida de sessió, estat pendent i error | `auth/AccountBlockedScreen.test.tsx` (ampliat) | Expo Go; revisió feta i confirmada per Vinyet | Tests automàtics | — |
| Explora | Fenòmens, dia, franja horària, distància, navegació i àrea segura | `explore/ExploreScreen.test.tsx` (ampliat) | Expo Go; revisió feta i confirmada per Vinyet | Tests automàtics; la prova d’àrea segura no mesura la geometria final | — |
| Mapa i recomanacions | Marcadors, rànquing, full plegable, navegació, càrrega, buit i reintent | `map/MapScreen.test.tsx` (ampliat) | Expo Go; revisió feta i confirmada per Vinyet | Tests de pantalla amb el mapa simulat; DOM cobert separadament | — |
| Fitxa del punt | Dades, hores, factors, reintent i 404 | `point/PointDetailScreen.test.tsx` (existent), `point/PointDetailStates.test.tsx` (nou) | Expo Go; revisió feta i confirmada per Vinyet | Tests automàtics | — |
| Calendari | Llista, filtres, passats, selecció de dia, mes, retorn a avui, càrrega, error i buit | `calendar/CalendarScreen.test.tsx` (nou); ViewModel i calendari compartit ja provats | Expo Go; revisió feta i confirmada per Vinyet | Proves de la pantalla amb la consulta simulada | — |
| Alertes | Missatge provisional de funcionalitat pendent | `alerts/AlertsScreen.test.tsx` (existent) | Expo Go; revisió feta i confirmada per Vinyet | Només cobreix la pantalla existent, no funcionalitats futures | — |
| Perfil | Sessió, errors, reintent, canvi d’idioma des dels botons, selecció i persistència | `profile/ProfileScreen.test.tsx` (ampliat) | Expo Go; revisió feta i confirmada per Vinyet | Tests automàtics | — |

## Comprovació visual

Vinyet confirma que la revisió visual a Expo Go per comprovar retalls i
superposicions ja s’ha fet. No queda pendent repetir-la per la TG-260.

La confirmació s’ha incorporat a l’inventari. En aquesta sessió no s’han aportat
els detalls de dispositiu, sistema operatiu, idiomes, mida de text ni captures;
no se n’atribueix cap configuració concreta a la revisió feta.

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
| Fitxa: accions | Com arribar amb les coordenades correctes; error en obrir Maps; avís provisional de Crea un pla | `features/point/__tests__/PointDetailStates.test.tsx` |
| Fitxa: estats | Càrrega inicial; vista diürna; índex i metadades absents; hores buides, pendents o amb error; reintent des del desglossament; dades conservades i reintent desactivat durant el refresc | `features/point/__tests__/PointDetailStates.test.tsx` |
| Fitxa: selecció | Retorn a la millor hora quan la seleccionada desapareix després d’una actualització | `features/point/__tests__/PointDetailStates.test.tsx` |
| Benvinguda | Invocació del proveïdor correcte des de Google/Apple; bloqueig dels tres botons durant l’autenticació pendent i recuperació després d’un error | `features/auth/__tests__/WelcomeScreen.test.tsx` |
| Compte bloquejat | Reconsulta des del botó; bloqueig del reintent i del logout mentre comprova; finalització de la consulta | `features/auth/__tests__/AccountBlockedScreen.test.tsx` |
| Targeta d’estat de l’API | Càrrega, resposta, error, botó de reintent i recuperació | `features/apiStatus/__tests__/ApiStatusCard.test.tsx` |
| Mapa i recomanacions | Avís diürn a la vista; retorn de la llista completa a la curta | `features/map/__tests__/MapScreen.test.tsx` |
| Full compartit | Botó enrere d’Android i gest d’escapament accessible | `shared/ui/__tests__/Sheet.test.tsx` |
| Calendari compartit | Gestos de lliscar en les dues direccions i respecte dels límits | `shared/ui/__tests__/MonthCalendar.test.tsx` |
| Navegació auxiliar | Ruta inexistent i retorn real a l’inici; renderització del layout segons l’estat de sessió i etiquetes de les quatre pestanyes | `core/navigation/__tests__/NotFound.test.tsx`, `core/navigation/__tests__/TabsLayout.test.tsx` |

Els camins d’aquesta taula són relatius a `apps/mobile/src`. El test de ruta
inexistent utilitza Expo Router real; el del layout simula la barra nativa i les
pantalles filles per comprovar la selecció de vista. La targeta d’estat del perfil
ara disposa efectivament de la seva prova de vista pròpia.

No s’han duplicat tots els casos interns dels components compartits a cada
pantalla ni afegit una prova per cada text o opció amb el mateix callback. Les
comprovacions de geometria final al dispositiu corresponen a la revisió visual ja
feta, no a una afirmació derivada del nombre de tests.

## Abast

Aquest registre correspon a les pantalles mòbils de la TG-260. La web
`apps/admin` té un entorn propi i no disposa d’script de tests; les validacions
mòbils no s’hi atribueixen. Aquesta tasca no modifica el seu codi ni els seus
manifests de dependències.
