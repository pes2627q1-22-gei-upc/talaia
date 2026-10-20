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
- **Estacions, un cop al mes:** es desen les operatives (`estacions_xema`, amb PostGIS). Les que ja no ho són **no s'esborren**: es marquen amb `operativa = false` i en conserven les lectures, perquè n'hi ha prou d'un dia de baixa temporal per perdre l'historial que farà servir la TG-184 (les lectures no tenen `on delete cascade`). Cada punt rep l'**estació operativa més propera**, només per distància (`punts_observacio.estacio_xema`); només s'actualitzen els punts que canvien d'estació.
- **Lectures, un cop al dia, les d'ahir (UTC):** una petició per variable per a totes les estacions, i només es desen les de les estacions assignades als punts. Unes **190 consultes al mes**, sigui quin sigui el nombre de punts. Les dades del dia anterior ja estan completes, i el contrast es fa a posteriori (no cal temps real). El worker ho ha de planificar **en UTC i no abans de les 03:00 UTC**: amb l'hora de Catalunya entre les 00:00 i les 02:00, el canvi d'hora del 25/10 faria saltar el dia 24.
- **Format:** `lectures_xema`, una fila per estació i lectura semihorària, amb les unitats d'Open-Meteo (`LecturaXema` a `@talaia/shared`; el vent, en km/h). Les lectures es guarden 90 dies.
- **Quan:** la XEMA etiqueta per davant (la lectura de les 11:00Z cobreix de 11:00 a 11:30), i Open-Meteo etiqueta per darrere els valors acumulats (la precipitació de les 12:00 és la de 11:00 a 12:00). La TG-184 ho ha de tenir en compte en comparar-les, o es desquadrarà mitja hora o una hora.
- **Qualitat de les dades:**
  - Les lectures que Meteocat marca com a **invàlides** (estat «N») no es desen. Si en tornar a baixar un dia una lectura que era pendent ha passat a «N» (o fora de rang), aquell valor es posa a `null` (`anulaValors`): el `coalesce` no la pot conservar.
  - Els valors **fora del rang físic** (`RANGS`, els mateixos que els `check` de la taula: una humitat de 101) es descarten un a un: no fan perdre la resta del dia.
  - `validada` diu si **tots** els valors de la fila estan validats (estat «V»). Meteocat valida amb dies de retard, de manera que a les lectures d'ahir sol ser `false`. Si una ingesta parcial conserva valors antics, la fila només és validada si l'antiga també ho era.
- **Robustesa:** si falla una variable es desen les altres, i tornar a baixar un dia no esborra els valors que la nova ingesta no porta (`coalesce`). Si fallen totes, la ingesta falla. Si la clau és rebutjada (401, 403) o la quota s'ha exhaurit (429), para de seguida per no gastar més consultes, però abans desa les variables que ja havia baixat. Respecta el senyal d'aturada del worker.

### Alternatives descartades

- **Totes les variables d'una estació per hora:** fresc, però multiplica la quota per 100.
- **Agregar a hores en ingestar:** caldria decidir ara com es comparen les lectures semihoràries amb la previsió horària (instantani o mitjana, interval inicial o final), i això és de la TG-184. Es desen tal com venen.
- **Desar totes les estacions:** unes 190 estacions per 48 lectures al dia, quan només en fan servir unes 25.

## Conseqüències

- Cal demanar la clau amb el compte de l'equip (P20) i posar-la a `/opt/talaia/.env` a la VM. **La subscripció gratuïta caduca** (d'un mes a un any, segons el que es demani): cal renovar-la, i una clau caducada fa fallar la ingesta amb un 401 o 403, visible al log.
- **Condicions d'ús:** si l'app mostra o difon aquestes dades, cal citar el Servei Meteorològic de Catalunya (SMC) com a font.
- **L'estació es tria només per distància.** Amb les 189 estacions reals, 15 dels 32 punts queden amb més de 350 m de diferència d'altitud (el Santuari del Far, a 1.119 m, amb Anglès, a 151 m), 10 de les 27 estacions assignades no mesuren el vent a 10 m i 4 no tenen irradiància. Per a la TG-184 caldrà triar-la també per altitud i per les variables que mesura.
- Els codis de variable (30, 31, 32, 33, 35 i 36) són els del catàleg oficial, i una mostra real de 183 estacions passa pel client (comprovat a la revisió de la PR #51).
- La planificació va dins del procés horari de la TG-99 ([ADR-0024](0024-planificacio-worker-node-cron.md)), a `services/worker/src/meteocat/planificacio.ts`: lectures cada dia a les 06:15 UTC, estacions el dia 1 de cada mes a les 06:00 UTC i en arrencar si `estacions_xema` és buida. Sense `METEOCAT_API_KEY` el worker arrenca igual, amb un avís al log, i no ingesta res.
