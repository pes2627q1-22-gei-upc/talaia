# ADR-0025: Observacions de la XEMA de Meteocat: lectures d'ahir de l'estació més propera a cada punt, un cop al dia

**Estat:** Acceptada · **Data:** 2026-10-19 · TG-115

## Context

La previsió d'Open-Meteo s'ha de contrastar amb el que es va mesurar de debò ([producte.md](../producte.md), [arquitectura.md](../arquitectura.md)): la font són les estacions automàtiques de Meteocat (XEMA). L'ajust de l'índex amb aquestes dades és la TG-184 (índex v2, Sprint 2); aquesta decisió només en cobreix la ingesta.

En mirar l'API de dades meteorològiques de Meteocat:

- Cal una clau (`x-api-key`). El pla «Accés ciutadà i administració» és gratuït i inclou les dades de la XEMA, però la quota és **mensual**, i la documentació no en dona la xifra.
- La XEMA dona lectures **semihoràries** i no mesura els núvols. Sí que mesura la temperatura, la humitat, la precipitació, el vent i la irradiància solar, que de dia en fa de testimoni.
- Hi ha un endpoint per a **una variable de totes les estacions en un dia**, i un altre per a totes les variables d'una estació. Amb el segon, 25 estacions cada hora serien unes 18.000 consultes al mes.
- L'API té el CORS desactivat: només es pot fer servir des d'un servidor.

## Decisió

- **Al worker, no a l'app ni a l'API.** La clau `METEOCAT_API_KEY` és secreta i opcional: sense ella no s'ingesta res i la resta del worker funciona igual.
- **Estacions, un cop al mes:** es desen les operatives (`estacions_xema`, amb PostGIS), s'esborren les que ja no ho són i cada punt rep l'estació més propera (`punts_observacio.estacio_xema`).
- **Lectures, un cop al dia, les d'ahir:** una petició per variable per a totes les estacions, i només es desen les de les estacions assignades als punts. Unes **190 consultes al mes**, sigui quin sigui el nombre de punts. Les dades del dia anterior ja estan completes, i el contrast es fa a posteriori (no cal temps real).
- **Format:** `lectures_xema`, una fila per estació i lectura semihorària, amb les unitats d'Open-Meteo (`LecturaXema` a `@talaia/shared`; el vent, en km/h) i un booleà `validada` (estat «V» de Meteocat). Les lectures es guarden 90 dies.
- **Robustesa:** si falla una variable es desen les altres, i tornar a baixar un dia no esborra els valors que la nova ingesta no porta (`coalesce`).

### Alternatives descartades

- **Totes les variables d'una estació per hora:** fresc, però multiplica la quota per 100.
- **Agregar a hores en ingestar:** caldria decidir ara com es comparen les lectures semihoràries amb la previsió horària (instantani o mitjana, interval inicial o final), i això és de la TG-184. Es desen tal com venen.
- **Desar totes les estacions:** unes 190 estacions per 48 lectures al dia, quan només en fan servir unes 25.

## Conseqüències

- Cal demanar la clau amb el compte de l'equip (P20) i posar-la a `/opt/talaia/.env` a la VM.
- Els codis de variable (30, 31, 32, 33, 35 i 36) surten d'un llistat de tercers: s'han de confirmar amb `/variables/mesurades/metadades` quan hi hagi clau, igual que el format de la resposta per a totes les estacions.
- La planificació (cada dia i cada mes) entra al procés horari de la TG-99 ([ADR-0024](0024-planificacio-worker-node-cron.md)).
