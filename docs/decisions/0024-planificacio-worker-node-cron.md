# ADR-0024: El worker recalcula l'índex cada hora amb node-cron dins del contenidor

**Estat:** Acceptada · **Data:** 2026-10-19 · TG-99

## Context

L'índex es precalcula cada hora ([ADR-0004](0004-index-precalculat.md)) amb la fórmula v1 ([ADR-0018](0018-formula-index-v1.md)), i l'API regenera el document del mapa quan el worker n'acaba una execució ([ADR-0012](0012-punts-mapa-geojson.md)). Faltava decidir qui dispara el recàlcul (P9): un planificador dins del procés del worker o el cron del sistema de la VM, que ja fa servir el deploy ([ADR-0021](0021-deploy-per-pull-des-de-la-vm.md)). El `Dockerfile` del worker ja esperava un procés llarg (`dist/main.js`).

## Decisió

- **node-cron dins del contenidor.** `services/worker/src/main.ts` és un procés llarg que recalcula l'índex **en arrencar** i **cada hora al minut 5** (`5 * * * *`, en **UTC**). El minut 5 deixa temps perquè Open-Meteo publiqui el model de l'hora en punt. En UTC i no amb l'hora de Catalunya: el 25/10, amb `Europe/Madrid`, node-cron passa de les 23:05Z a les 01:05Z i se salta una execució.
- **Una execució** (`recalcul/recalcul.ts`): punts `PUBLICAT` → previsió d'Open-Meteo → efemèrides → índex v1 → `index_visibilitat` (l'hora en curs i les següents; s'esborren les de fa més de 24 hores).
- **Per lots de 10 punts**, amb un timeout de 30 s i un reintent si l'error és transitori (xarxa, timeout, 429, 5xx). L'índex es desa lot a lot, i un lot que falla no atura els altres: un 503 «overloaded» d'Open-Meteo ja no deixa tots els punts sense índex. Són unes 770 crides al dia, lluny de les 10.000 de la quota.
- **Marca de versió:** cada execució, correcta o no, deixa una fila a la taula nova `execucions_worker`. Com a molt un cop per minut, l'API llegeix l'última `acabada_el` d'una execució que ha desat algun punt, també si n'ha fallat algun lot. Si ha canviat, regenera el GeoJSON del mapa. A més, compara a cada petició l'hora en curs amb la del document, sense anar a la BD, i el regenera al moment si ha canviat. L'`ETag` continua sent el hash del contingut.
- **Sense solapaments:** si una execució encara no ha acabat quan toca la següent, la nova se salta. Si una execució falla, l'error queda a la taula i al log, i el procés continua fins a l'hora següent.
- **Sense encallar-se:** el pool té timeouts de connexió (10 s) i de consulta (30 s).
- **Aturada neta:** amb `SIGTERM` no comença cap lot més, espera el que està en curs i tanca el pool. El compose dona 75 s (`stop_grace_period`), més que un lot amb el reintent.
- El servei `worker` de `deploy/compose.yaml` deixa de tenir `profiles: [worker]` i arrenca amb la resta.

### Per què així

- **Tot dins de Docker:** el worker es desplega, es reinicia (`restart: unless-stopped`) i es llegeix (`docker compose logs worker`) igual que l'API, i la planificació viu al repositori, no a la crontab de la VM.
- **Es pot provar:** l'orquestració (`recalculaIndex`) és una funció amb ports injectables, provada amb Jest sense xarxa ni base de dades. El cron de la VM no passaria per la CI.
- **Recàlcul en arrencar:** després d'un deploy o d'un reinici, el mapa té índex sense esperar l'hora següent.
- **node-cron** (v4) no té dependències i porta els tipus. Un `setInterval` derivaria i no respectaria el minut 5.
- **Es pot provar sense efectes:** el que fa el procés a cada hora és a `recalcul/executor.ts` (solapaments, errors, aturada), i `main.ts` només hi connecta el cron, el pool i els senyals.

### Alternatives descartades

- **Cron del sistema** que llança `docker compose run worker` cada hora: no calia cap dependència, però la planificació queda fora del repositori i de la CI, i cada execució arrencaria un contenidor nou.
- **pg_cron a Supabase:** el càlcul és en TypeScript (Astronomy Engine, Open-Meteo), no en SQL.

## Conseqüències

- Cal aplicar la migració `execucions_worker` a Supabase (`supabase db push`) abans del deploy que inclou el worker.
- `execucions_worker` creix una fila per hora (~9.000 l'any). De moment no s'esborra; si molesta, una purga com la de l'índex.
- Si el worker s'atura, el mapa no es queda en gris de seguida: cada execució desa unes 84 hores endavant, de manera que durant uns 3 dies el mapa mostra l'índex calculat amb una previsió cada cop més vella. Cal vigilar `execucions_worker` (o el log) per detectar-ho; una alerta queda per més endavant.
- El worker es compila amb tsup, com l'API, perquè `@talaia/db` i `@talaia/shared` no tenen build. `deploy-check.yml` comprova a cada PR que el contenidor arrenca i es manté en marxa sense base de dades.
