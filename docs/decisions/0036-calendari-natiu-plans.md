# ADR-0036: Calendari natiu per als plans d'observació

**Estat:** Acceptada · **Data:** 2026-11-20 · **Resol:** TG-158

## Context

La TG-158 permet afegir un pla d'observació al calendari del dispositiu. Això requereix consultar els calendaris editables, demanar permís i crear-hi un esdeveniment. `expo-calendar` 58 exposa aquesta funcionalitat amb l'API `CalendarNext`, que no forma part d'Expo Go. L'ADR-0014 estableix Expo Go com a entorn de proves i demana justificar amb un ADR qualsevol mòdul natiu que no hi sigui.

## Decisió

- Fer servir `expo-calendar` 58 i la seva API `CalendarNext` per llegir els calendaris editables i crear esdeveniments. No fer servir `expo-calendar/legacy`.
- La funció de calendari només s'activa en una build nativa compatible que inclogui `CalendarNext`. A Expo Go, la compilació web i les plataformes no compatibles, l'opció apareix desactivada i es pot desar el pla sense calendari.
- Si el pla no té una hora final explícita, l'esdeveniment del calendari dura dues hores. L'interval fins al migdia de l'endemà és un límit de consulta de l'API i no una durada adequada per bloquejar el calendari personal.
- Mantenir la càrrega del mòdul en diferit i comprovar-ne la disponibilitat abans d'utilitzar-lo, de manera que la resta de l'app continuï funcionant a Expo Go.
- Acceptar una build de desenvolupament o distribució per provar permisos i creació d'esdeveniments reals. L'app continua fent servir Expo Go per a la resta de funcionalitats.

## Conseqüències

- La funció de calendari no es pot validar amb Expo Go; cal una build nativa amb el plugin i els permisos configurats.
- Els canvis de `expo-calendar` s'han d'actualitzar i verificar contra la versió d'SDK utilitzada. L'API `CalendarNext` es prefereix perquè és l'API vigent del mòdul; no es manté una implementació paral·lela amb l'API antiga.
- Si el mòdul no està disponible o l'usuari no concedeix permís, el flux de creació del pla continua operatiu sense afegir-lo al calendari.
- En editar un pla (TG-161), l'esdeveniment s'actualitza només si és en aquest mòbil i encara coincideix amb el pla d'abans (inici, final i municipi, `isPlanEvent`): l'id només val per al mòbil que el va crear i en un altre pot ser un esdeveniment de l'usuari. Si no hi és, el pla es desa igual i s'ofereix afegir-ne un de nou (`createEvent` + `PUT /plans/{id}/calendari`); el `PATCH` no toca mai `calendariEventId`.
