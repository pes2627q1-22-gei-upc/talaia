# ADR-0027: Índex per objectiu: cada objectiu diu quan es pot veure i què el fa millor

**Estat:** Proposada · **Data:** 2026-10-21 · Substitueix en part l'[ADR-0018](0018-formula-index-v1.md) · TG-184

## Context

L'índex v1 ([ADR-0018](0018-formula-index-v1.md)) és el mateix per a tots els objectius, i les recomanacions (TG-100) el fan servir per a tots. La v1 diu com de bo és un cel de nit, i per a alguns objectius dona just el contrari:

- **Posta i sortida de sol:** el factor Sol val 0 de dia i en el crepuscle civil, o sigui que l'índex és 0 a l'hora de la posta, que és quan s'hi ha d'anar.
- **Eclipsi:** el solar del 2 d'agost de 2027 (parcial des de Catalunya, al migdia) dona 0. En un de Lluna, la Lluna plena i alta resta, quan és el que es vol veure.
- **La Lluna** és un objectiu del producte ([producte.md](../producte.md): «la posta, la Lluna, una pluja d'estels o una constel·lació»), però no és a `ObjectiuObservacio`. Amb la v1, la millor nit per veure-la és la que no en té.
- **Pluja d'estels:** la v1 no sap si n'hi ha cap d'activa ni si el radiant és amunt. Una nit qualsevol de juny surt igual que la de les Perseides.
- **Via Làctia:** en un cel fosc (F = 1) amb la Lluna plena alta, la v1 dona 60 («jus»), i la Via Làctia no es veu.

L'ADR-0018 ja ho preveia («s'han d'adaptar per fenomen»), i el perfil d'horitzó de cada punt ja és a la base de dades ([ADR-0022](0022-perfil-horitzo-icgc.md)).

## Decisió

Una sola forma, amb un perfil per objectiu:

```
índex(objectiu) = 100 × N × C × Q        arrodonit a l'enter, de 0 a 100; les franges de l'ADR-0018
```

- **N, núvols:** el de la v1, llevat de la posta i la sortida (taula).
- **C, condició (0–1):** si a aquella hora i en aquell punt l'objectiu **es pot veure**. Generalitza el factor Sol de la v1: si és 0, no hi ha res a veure, faci el cel que faci.
- **Q, qualitat (0–1):** com de bé es veu, quan es pot veure.

**«Sobre l'horitzó» vol dir sobre el perfil d'horitzó del punt**: l'alçada aparent de l'astre (la geomètrica més la refracció) és més gran que `horitzo[azimut]`. Un punt sense perfil (els de la comunitat) fa servir 0°.

| Objectiu | C: es pot veure si… | Q: és millor com més… | N |
|---|---|---|---|
| `cel_estrellat` | El factor Sol de la v1: 1 amb el Sol sota −12°, 0,5 en el crepuscle nàutic | `0,6·F + 0,4·L` (la v1) | v1 |
| `constellacions` | Com el cel estrellat | `0,4 + 0,3·F + 0,3·L`: les estrelles brillants es veuen fins i tot des de ciutat i amb Lluna | v1 |
| `via_lactia` | Sol (1 sota −18°, 0,5 en el crepuscle astronòmic) × centre galàctic (1 sobre l'horitzó; si no, 0,5, perquè la banda d'hivern és més feble) | `Fᵥ × Lᵥ`, perquè calen tots dos: `Fᵥ = (SQM − 19,5) / 2` i `Lᵥ = 1 − fracció × min(1, alçada / 10°)` | v1 |
| `pluja_estels` | El factor Sol de la v1, i una pluja del calendari activa (entre `inici` i `fi`) amb `radiant_maxim` (sense, no compta) | `sin(alçada del radiant) × (0,6·F + 0,4·L)`: la taxa visible és la ZHR pel sinus de l'alçada del radiant (`radiant_maxim`) | v1 |
| `eclipsi` | Un eclipsi del calendari en curs en algun moment de l'hora, amb l'astre (el Sol o la Lluna) sobre l'horitzó | Solar: l'obscuració màxima al punt en aquella hora (`SearchLocalSolarEclipse` d'Astronomy Engine). Lunar: 1 | v1 |
| `posta_sol` · `sortida_sol` | L'hora conté el minut en què el Sol travessa el perfil d'horitzó, de baixada o de pujada | `1 − 0,5 × min(1, horitzó / 10°)` a l'azimut del Sol: un horitzó pla o de mar val el doble que una carena de 10° | Només els baixos: `1 − baixos / 100`. Si plou, 0 |
| `lluna` (nou) | La Lluna és sobre l'horitzó: 1 amb el Sol sota l'horitzó, 0,3 de dia | La fracció il·luminada | v1 |

**Tots els factors es retallen a [0, 1]**, i una alçada sota l'horitzó compta com a 0:

- `Fᵥ = min(1, max(0, (SQM − 19,5) / 2))`. Un punt sense SQM fa servir la foscor estimada de la v1 (F = 0,6, uns 19,9 mag/arcsec², o sigui `Fᵥ` = 0,2), i l'índex es marca `foscorEstimada`.
- `Lᵥ = 1 − fracció × min(1, max(0, alçada) / 10°)`: amb la Lluna sota l'horitzó, 1.
- Pluja d'estels: `max(0, sin(alçada del radiant))`.
- Posta i sortida: `1 − 0,5 × min(1, max(0, horitzó) / 10°)`. Un horitzó negatiu (mar, penya-segat) val com un de pla.

Exemples: la posta des d'Àger, amb la carena a 5° cap a ponent i sense núvols baixos, fa `100 × 1 × 1 × 0,75` = **75 · ras**; des del Trabucador, amb l'horitzó de mar, **100**. La Via Làctia amb Lluna plena a 40° fa 0.

- **El cel estrellat no canvia:** el seu perfil és la v1 sencera. El mapa, que el mostra, i els tests de la v1 es queden igual.
- **Els factors imprescindibles multipliquen.** L'ADR-0018 pondera la foscor i la Lluna perquè, en un cel estrellat, totes dues el fan millor o pitjor, però cap no l'esborra. A la Via Làctia, en canvi, la Lluna alta o un cel de ciutat l'esborren del tot, i el radiant sota l'horitzó deixa la pluja sense estels.
- **El centre galàctic, a Catalunya, no puja més d'uns 20°** (declinació −29°): un punt amb muntanyes cap al sud no el veu mai. Per això la Via Làctia és l'objectiu on el perfil d'horitzó pesa més.
- **Al radiant, l'alçada geomètrica i no el perfil:** els estels surten per tot el cel, no del radiant, i la taxa depèn de l'alçada del radiant sobre l'horitzó de debò.
- **La ZHR no entra a l'índex.** És la mateixa per a tots els punts d'una nit: no canvia quin punt és millor, sinó quina nit, i això ho diu el calendari.
- **A la posta i la sortida, els núvols alts i mitjans no resten:** sovint la fan més bonica. Els baixos la tapen. Open-Meteo dona els núvols al punt i no cap a l'horitzó: és una aproximació.

### Persistència i API

- **`index_visibilitat` té una columna `objectiu`**, amb un `check` sobre la llista d'objectius, i la clau primària passa a ser `(punt_id, objectiu, hora)`. Les files actuals passen a `cel_estrellat`. El worker calcula els vuit objectius cada hora (a la taula, la posta i la sortida comparteixen fila) amb les mateixes efemèrides i la mateixa previsió, i guarda **totes les hores** de tots els objectius, també les de C = 0. Són unes 21.500 files per execució, en lloc de les 2.700 d'ara. Amb la neteja de les hores de més de 24 h, la taula es queda en uns quants centenars de milers de files. `execucions_worker.hores` continua comptant hores per punt, no files.
- **La migració, el worker i els filtres de l'API van a la mateixa PR.** Amb la clau nova, l'`on conflict (punt_id, hora)` del worker ja no troba cap restricció i falla. Totes les lectures d'`index_visibilitat` que no filtren per objectiu tornarien vuit files per punt i hora: el `left join` del mapa i l'`indexHores` de la fitxa i del desglossament (`puntsRepository`), `recomanacionsRepository` i la lectura del mateix worker. Per defecte filtren `objectiu = 'cel_estrellat'`.
- **`factors`** manté les claus de la v1 per al cel estrellat, i cada objectiu hi afegeix les seves (`radiant`, `horitzo`, `obscuracio`, `fraccio`). `FactorsIndex` de `@talaia/shared` passa a dependre de l'objectiu, i la fitxa (TG-104, TG-105) mostra els de l'objectiu triat.
- **Codi pur i testejable**, com la v1: els perfils, amb tots els pesos i llindars, són a `services/worker/src/index/formula.ts`. Canviar un pes vol dir canviar el perfil i els tests a la mateixa PR.
- **`GET /recomanacions?objectiu=…`** llegeix les files d'aquell objectiu. Per a un objectiu d'esdeveniment (la pluja d'estels i l'eclipsi) sense cap esdeveniment a la franja demanada, respon una llista buida amb el **següent esdeveniment** i la seva data, en lloc d'un rànquing de zeros (TG-140).
- **Fins que la v2 sigui en marxa** (release del 26/10): l'API respon 422 `objectiu_no_suportat` per a `posta_sol`, `sortida_sol` i `eclipsi`, i l'app marca aquests objectius «Aviat». La resta continua amb la v1, que per a ells és una aproximació acceptable.

## Alternatives descartades

- **La v1 amb excepcions** (el Sol a l'inrevés per a la posta, la Lluna a l'inrevés per a la Lluna): queda bé per a dos objectius, però la pluja, l'eclipsi i la Via Làctia tenen condicions que no són el Sol ni la Lluna (el radiant, l'eclipsi, el centre galàctic), i la fórmula s'acaba omplint de casos.
- **Filtrar les hores de la v1** (per a la posta, les hores de la posta): a la posta, la v1 val 0 pel Sol, i no hi ha res a filtrar.
- **Calcular-ho a l'API a cada consulta:** contradiu l'índex precalculat ([ADR-0004](0004-index-precalculat.md)), i l'API hauria de llegir la previsió i calcular les efemèrides de tots els punts a cada petició.
- **Guardar només les hores amb C > 0:** menys files, però una fila absent voldria dir dues coses («no es pot veure» i «no s'ha calculat»), i l'API les hauria de distingir.

## Conseqüències

- Nou objectiu **`lluna`** a `ObjectiuObservacio`, a l'API i a l'app (un objectiu més a «Què vols veure?»).
- Els pesos i els llindars són una **proposta**: es validen amb l'equip i, quan hi hagi prou observacions, amb l'ajust de Meteocat (TG-184, en un ADR a part). Aquest ajust té un límit: **la XEMA no mesura núvols**. De dia, la irradiància en fa de testimoni, però de nit cap variable de la XEMA no valida N: només hi ha la humitat i la pluja. A més, la XEMA etiqueta cada lectura per l'inici del període, i Open-Meteo etiqueta els valors acumulats per la fi ([ADR-0025](0025-observacions-xema.md)).
- A la posta i la sortida, el minut en què el Sol travessa el perfil és l'hora de la posta *en aquell punt* («a les 18:47, darrere el Montsec»), i la fitxa la pot ensenyar.
- Als punts de la frontera, la posta cap a l'Aragó o França fa servir un horitzó mínim ([ADR-0022](0022-perfil-horitzo-icgc.md)). Si es nota, s'omple amb el Copernicus DEM.
- Tasques afectades: TG-184 (worker, perfils i migració), TG-140 (recomanacions per esdeveniment i el següent esdeveniment), TG-104 i TG-105 (desglossament per objectiu), TG-101 («Aviat» i l'objectiu de la Lluna) i TG-212 (constel·lacions).
