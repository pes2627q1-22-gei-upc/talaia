# ADR-0024: El worker recalcula l'índex cada hora amb node-cron dins del contenidor

**Estat:** Acceptada · **Data:** 2026-10-19 · TG-99

## Context

L'índex es precalcula cada hora ([ADR-0004](0004-index-precalculat.md)) amb la fórmula v1 ([ADR-0018](0018-formula-index-v1.md)), i l'API regenera el document del mapa quan el worker n'acaba una execució ([ADR-0012](0012-punts-mapa-geojson.md)). Faltava decidir qui dispara el recàlcul (P9): un planificador dins del procés del worker o el cron del sistema de la VM, que ja fa servir el deploy ([ADR-0021](0021-deploy-per-pull-des-de-la-vm.md)). El `Dockerfile` del worker ja esperava un procés llarg (`dist/main.js`).

## Decisió

- **node-cron dins del contenidor.** `services/worker/src/main.ts` és un procés llarg que recalcula l'índex **en arrencar** i **cada hora al minut 5** (`5 * * * *`, zona `Europe/Madrid`). El minut 5 deixa temps perquè Open-Meteo publiqui el model de l'hora en punt.
- **Una execució** (`recalcul/recalcul.ts`): punts `PUBLICAT` → previsió d'Open-Meteo en lots → efemèrides → índex v1 → `index_visibilitat` (l'hora en curs i les següents; s'esborren les de fa més de 24 hores).
- **Marca de versió:** cada execució, correcta o no, deixa una fila a la taula nova `execucions_worker`. L'API llegeix l'última `acabada_el` correcta (com a molt un cop per minut) i, si ha canviat o ha canviat l'hora, regenera el GeoJSON del mapa. L'`ETag` continua sent el hash del contingut.
- **Sense solapaments:** si una execució encara no ha acabat quan toca la següent, la nova se salta. Si una execució falla, l'error queda a la taula i al log, i el procés continua fins a l'hora següent.
- **Aturada neta:** amb `SIGTERM` espera l'execució en curs i tanca el pool de la base de dades.
- El servei `worker` de `deploy/compose.yaml` deixa de tenir `profiles: [worker]` i arrenca amb la resta.

### Per què així

- **Tot dins de Docker:** el worker es desplega, es reinicia (`restart: unless-stopped`) i es llegeix (`docker compose logs worker`) igual que l'API, i la planificació viu al repositori, no a la crontab de la VM.
- **Es pot provar:** l'orquestració (`recalculaIndex`) és una funció amb ports injectables, provada amb Jest sense xarxa ni base de dades. El cron de la VM no passaria per la CI.
- **Recàlcul en arrencar:** després d'un deploy o d'un reinici, el mapa té índex sense esperar l'hora següent.
- **node-cron** (v4) no té dependències, porta els tipus i accepta la zona horària. Un `setInterval` derivaria i no respectaria el minut 5 ni el canvi d'hora.

### Alternatives descartades

- **Cron del sistema** que llança `docker compose run worker` cada hora: no calia cap dependència, però la planificació queda fora del repositori i de la CI, i cada execució arrencaria un contenidor nou.
- **pg_cron a Supabase:** el càlcul és en TypeScript (Astronomy Engine, Open-Meteo), no en SQL.

## Conseqüències

- Cal aplicar la migració `execucions_worker` a Supabase (`supabase db push`) abans del deploy que inclou el worker.
- `execucions_worker` creix una fila per hora (~9.000 l'any). De moment no s'esborra; si molesta, una purga com la de l'índex.
- Si el worker s'atura, el mapa continua amb l'últim índex desat de l'hora en curs; a l'hora següent els punts surten amb `index: null` (marcador gris) fins que torni.
