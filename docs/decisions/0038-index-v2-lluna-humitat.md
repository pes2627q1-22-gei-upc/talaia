# ADR-0038: Índex v2: la Lluna amagada pel relleu i la humitat corregida amb la XEMA

**Estat:** Proposada · **Data:** 2026-11-11 · Substitueix en part l'[ADR-0018](0018-formula-index-v1.md) · TG-184, TG-185

## Context

L'índex v1 ([ADR-0018](0018-formula-index-v1.md)) combina els núvols, el Sol, la foscor i la Lluna, i deixa per a la v2 dues fonts que ja són a la base de dades: el **perfil d'horitzó** de cada punt ([ADR-0022](0022-perfil-horitzo-icgc.md)) i les **observacions de la XEMA** ([ADR-0025](0025-observacions-xema.md)). En mirar què hi ha de debò:

- **Perfil:** `punts_observacio.horitzo` té 360 alçades aparents (la posició és l'azimut, 0 = N) als 32 punts oficials. La mitjana va de −1,7° (Mont Caro) a 22,9° (pantà de Cavallers), i només 6 punts passen de 8°. Els punts de la comunitat i les ubicacions arbitràries de la TG-130 no en tenen (`null`).
- **XEMA:** `lectures_xema` guarda, per a l'estació assignada a cada punt (`punts_observacio.estacio_xema`), la temperatura, la humitat relativa, la precipitació, el vent i la irradiància, cada mitja hora, 90 dies. **No mesura núvols ni visibilitat**, i de nit l'única variable que diu alguna cosa del cel és la humitat ([ADR-0027](0027-index-per-objectiu.md)). Les lectures són d'**ahir** (es baixen a les 06:15 UTC): no serveixen per corregir la nit d'avui en temps real, només per mesurar l'error **sistemàtic** del model en aquell lloc.
- **Open-Meteo:** el worker en demana la previsió cada hora però **no la desa** (no hi ha taula de previsions), i la v1 no fa servir ni la humitat ni la visibilitat, que ja ingesta.
- **[ADR-0027](0027-index-per-objectiu.md)** (índex per objectiu) és **Proposada**: vuit perfils, una columna `objectiu` a la clau primària i filtres a totes les lectures de l'API. No cap a les 4 h de la TG-184, i n'hi ha parts que són d'altres tasques (TG-140, TG-212). Diu que el cel estrellat es queda amb la v1 i que l'ajust de Meteocat va «en un ADR a part»: és aquest.

Dos fets físics condicionen el disseny:

1. **La foscor del crepuscle no depèn del relleu.** El cel s'enfosqueix perquè l'aire de sobre entra a l'ombra de la Terra: amb el Sol a −12°, l'aire de sobre el punt és a l'ombra fins a uns 140 km d'alçada. Una carena d'un quilòmetre no hi canvia res; només fa ombra al fons de la vall.
2. **La Lluna amagada darrere una muntanya continua il·luminant el cel.** L'ombra de la carena només cobreix la capa d'aire més baixa (una carena a 3 km que tapa 15° amb la Lluna a 10° deixa a l'ombra uns 300 m d'aire, i l'atmosfera té una escala d'alçada de 8 km). El que desapareix és l'enlluernament, el paisatge il·luminat i la part més brillant del cel, la del voltant de la Lluna, que queda darrere la muntanya.

## Decisió

```
índex v2 = 100 × N × S × (0,6 · F + 0,4 · Lₕ) × H        arrodonit a l'enter, de 0 a 100; les franges de l'ADR-0018
```

**N** (núvols), **S** (Sol) i **F** (foscor) són els de la v1, sense cap canvi. Canvia la Lluna i s'hi afegeix la humitat:

| Factor | Càlcul |
|---|---|
| **Lₕ** Lluna | `1 − fracció il·luminada × min(1, alçada / 30°) × a`, amb `a = 0,5` si la Lluna és **amagada pel relleu** i 1 si no. Sota l'horitzó astronòmic (alçada ≤ 0), 1, com a la v1. |
| **H** humitat | `1 − 0,3 × min(1, max(0, (HR − 85) / 15))`: 1 fins al 85 % d'humitat relativa i 0,7 al 100 %. HR és la d'Open-Meteo, **corregida amb la XEMA** quan es pot (més avall). Sense dada d'humitat, 1. |

`FORMULA_V2` (al mòdul de la fórmula) hi té tots els pesos i llindars, i la v2 es marca amb `versio = 2`.

### Perfil d'horitzó: quan la Lluna és amagada

- **Alçada aparent** = l'alçada geomètrica de la Lluna (`efemerides.lluna.alcada`) més la refracció atmosfèrica estàndard (`Refraction('normal', …)` d'Astronomy Engine: 0,48° a l'horitzó, 0,09° a 10°). És la que es compara amb el perfil, que també és aparent (ADR-0022).
- **Horitzó a l'azimut de la Lluna:** interpolació lineal entre els dos graus enters del perfil, i del 359 es passa al 0.
- **Amagada** vol dir alçada geomètrica > 0 i alçada aparent ≤ horitzó a l'azimut. La rampa `min(1, alçada / 30°)` continua fent servir l'alçada geomètrica, com a la v1: modela l'extinció de la llum de la Lluna amb l'altura, que no depèn del relleu.
- **Sense perfil** (`horitzo = null`: punts de la comunitat, ubicacions de la TG-130) la Lluna es calcula exactament com a la v1. Un perfil pla (tot 0°) dona el mateix que no tenir-ne.
- **El Sol i la foscor no fan servir el perfil** (fet físic 1), ni hi ha cap terme de «cel visible» (vegeu les alternatives). `deDia` del mapa continua sent `sol === 0`.

Exemple real: pantà de Cavallers (SQM 21,71, F = 1), 30/11/2026 a les 02:00 (01:00 UTC), cel ras i sec. La Lluna, il·luminada al 63 %, és a 30,7° d'alçada però darrere la carena (32,9° a l'azimut 100°): Lₕ = 0,68 en lloc de 0,37, i l'índex passa de **75** (v1) a **87**. A les 03:00 ja ha sortit per sobre de la carena (40,9° contra 35,3°) i la v1 i la v2 donen 75. Entre l'11/11/2026 i el 31/01/2027, la Lluna (més del 50 % il·luminada i a més de 3°) queda amagada en plena nit 107 hores a Cavallers, 29 als Rasos de Peguera i 21 a Santa Fe del Montseny.

### Humitat corregida amb la XEMA: el biaix de nit de cada estació

- **Què es mesura:** el biaix `b = mediana(HR XEMA − HR Open-Meteo)` a l'**estació**, a les **hores de nit** dels **últims 14 dies**. Les hores de nit són les que tenen el Sol per sota de −6° d'alçada geomètrica a l'estació, és a dir, les que la v2 pot puntuar (S > 0).
- **La previsió del passat:** un cop al dia, després de baixar les lectures de la XEMA (a les 06:15 UTC i en arrencar, si el biaix d'avui encara no hi és i les lectures d'ahir ja s'han baixat), el worker demana a Open-Meteo, a les **coordenades de cada estació** assignada a algun punt, el mateix `/forecast` de sempre amb `past_days=14` (les primeres hores de cada passada del model, cosides). Són unes 25 ubicacions al dia: unes 35 crides de la quota de 10.000, perquè 13 variables i 15 dies compten com 1,4 crides.
- **Com s'aparellen:** el valor d'Open-Meteo de l'hora `h` (instantani) amb la **mitjana de les dues lectures de la XEMA etiquetades `h − 30 min` i `h`**, que cobreixen de `h − 30` a `h + 30` i queden centrades a `h`; si en falta alguna, l'hora no compta. Tot en UTC. No es fa servir cap variable acumulada (precipitació, irradiància), de manera que el desfasament d'etiquetes de l'ADR-0025 no hi entra.
- **Robustesa:** calen **48 parelles** com a mínim (unes 4 nits a l'hivern i 6 a l'estiu); si no n'hi ha prou, el biaix és `null`. La mediana no la mou una lectura dolenta ni un vespre de pluja, i el resultat es retalla a **±15** punts d'humitat i s'arrodoneix a la dècima.
- **On es desa:** `estacions_xema.biaix_humitat`, `biaix_mostres` i `biaix_calculat_el`. Se substitueixen cada dia, **totes les estacions en una sola transacció**: «ja s'ha calculat avui» es mira amb l'últim `biaix_calculat_el`, i si només se'n desés una part, la resta no es tornaria a calcular fins l'endemà. La ingesta mensual d'estacions no els toca.
- **Quan s'aplica a un punt** (al recàlcul horari, codi pur): si el punt té estació, la diferència d'altitud entre tots dos és com a molt de **350 m** (amb totes dues altituds conegudes), són a menys de **25 km** i el biaix és de fa **7 dies** com a molt. Llavors `HR' = min(100, max(0, HR + b))`, H es calcula amb `HR'` i la fila es marca `humitat_corregida = true`. Si no, H es calcula amb l'HR d'Open-Meteo tal qual.

Sense dades, la v2 no falla, només corregeix menys:

| Cas | Resultat |
|---|---|
| Sense `METEOCAT_API_KEY` o clau caducada | No es calcula cap biaix; els que hi havia deixen d'aplicar-se al cap de 7 dies. H amb l'HR d'Open-Meteo. |
| Punt sense estació, o estació massa lluny o a una altra altitud | H amb l'HR d'Open-Meteo. |
| Menys de 48 parelles (estació sense higròmetre, dies sense lectures) | `biaix_humitat = null`: H sense corregir. |
| Open-Meteo falla en demanar els dies passats, o falla el càlcul d'una estació | No es desa res: es manté el biaix anterior de totes (fins a 7 dies), l'error queda al log i l'execució següent ho torna a provar. |
| El worker arrenca abans de les 03:00 UTC (encara no es baixen les lectures d'ahir), o Meteocat no les ha donat | No es calcula: es manté el biaix anterior i es calcula a les 06:15, o quan arribin. Si es calculés abans, a les 06:15 ja constaria com a fet i les lectures d'ahir no hi entrarien. |
| L'hora no té humitat prevista | H = 1. |

Exemple: cel ras i fosc sense Lluna (índex 100 amb la v1). Open-Meteo preveu un 84 % d'humitat (H = 1); si l'estació diu que de nit el model fa curt 8 punts, l'HR corregida és del 92 %, H = 0,86 i l'índex, **86**.

### Persistència, versió i API

- **Migració** `20261120100000_index_v2_horitzo_humitat.sql`: `index_visibilitat.versio smallint not null default 1` (`check (versio >= 1)`) i `index_visibilitat.humitat_corregida boolean not null default false`; `estacions_xema.biaix_humitat real` (`check` entre −15 i 15), `biaix_mostres smallint` (`check` ≥ 0) i `biaix_calculat_el timestamptz`. Les files que ja hi ha queden com a v1; el primer recàlcul substitueix totes les hores futures, i les passades s'esborren en 24 h.
- **`factors`** (jsonb, sense canvi de columna) afegeix `humitat` (0–1). La resta de claus es diuen i s'interpreten igual.
- **`@talaia/shared`:** `FactorsIndex.humitat?: number`, `IndexHora.versio?: number` (absent = 1) i `IndexHora.humitatCorregida?: boolean`. Són opcionals perquè les files v1, els fixtures dels tests i la memòria cau de l'app continuïn sent vàlids; l'API sempre els envia, perquè la taula té valors per defecte.
- **API:** canvis només additius als esquemes (`indexSchemas.ts`) i a les lectures d'`index_visibilitat` (`puntsRepository`, `recomanacionsRepository`): els clients d'ara no es trenquen. El GeoJSON de `/punts` no canvia.
- **App:** el desglossament (TG-105) afegeix la fila «Humitat» quan la fila porta `factors.humitat`, amb franges pròpies (el factor va de 0,7 a 1: 1 és verd, a partir de 0,85 groc i per sota vermell), i, si `humitatCorregida`, diu en una línia a part que està corregida amb les observacions del **Servei Meteorològic de Catalunya** (citar l'SMC és una condició d'ús, ADR-0025). Va a la mateixa PR: sense la fila, una nit humida ensenyaria quatre factors alts i un índex més baix.
- **Codi pur i 100 % testejable**, com la v1: la fórmula, l'alçada aparent i l'horitzó a un azimut, al paquet compartit on la TG-130 porta la fórmula; el càlcul del biaix i la regla de quan s'aplica, al worker (`meteocat/ajust.ts`).

### Relació amb l'índex per objectiu i amb la TG-130

- La v2 **no implementa l'índex per objectiu**; l'ADR-0027 continua Proposada. Si s'accepta, el perfil `cel_estrellat` és la v2 (no la v1) i les condicions C fan servir les mateixes peces (`alcadaAparent`, `horitzoA`, «amagat»), on «sobre l'horitzó» vol dir, com diu aquell ADR, sobre el perfil. H multiplica la qualitat Q dels objectius de nit; a la posta i la sortida ho ha de decidir l'ADR-0027 (la humitat i la calitja hi poden afegir color). `versio` i la futura columna `objectiu` són independents.
- **TG-130** (`GET /api/v1/visibilitat`) crida el mateix `calculaIndexHores` del paquet compartit. Els paràmetres nous (`horitzo` i `biaixHumitat`) són opcionals i valen `null` per defecte: una ubicació arbitrària té la Lluna de la v1, H amb l'HR d'Open-Meteo, `versio = 2` i `humitatCorregida = false`, sense tocar el codi de l'endpoint.

## Per què així

- **El Sol, com a la v1:** per la física del crepuscle (fet 1). Avançar la nit a les valls faria que el mapa marqués de nit (`deDia = false`) un punt amb el cel encara blau.
- **La Lluna amagada resta la meitat, i no res:** el cel continua il·luminat (fet 2). Si no restés res, Cavallers donaria 100 amb una Lluna del 63 % alta al cel. La meitat és una proposta fàcil d'explicar, que es valida a la sessió de feedback (TG-186).
- **H multiplica i comença al 85 %:** la calitja i la rosada fan pitjor qualsevol cel ras en proporció, però no l'esborren; per això té un mínim de 0,7. La boira, que sí que l'esborra, ja és a N: per a Open-Meteo, els núvols baixos inclouen la boira. Amb l'HR per sota del 85 % i sense perfil, **la v2 és exactament la v1**: els tests de la v1 (HR del 60 %, sense perfil) passen sense tocar-los.
- **La humitat i no una altra variable:** és l'única que la XEMA mesura i que diu alguna cosa del cel de nit. Les dues fonts la donen directament (la XEMA no dona el punt de rosada), i és la que l'usuari entén («humitat del 92 %»).
- **Biaix sistemàtic i no correcció en temps real:** les lectures són d'ahir. L'error sistemàtic més conegut dels models a 2 m és de nit, a les valls i a la muntanya (inversions, bosses d'aire fred), que és on són els punts.
- **A l'estació i no al punt:** comparar Open-Meteo a les coordenades de l'estació amb el que l'estació mesura separa l'error del model de la diferència entre el punt i l'estació. Per això el biaix només passa a punts propers i a una altitud semblant.
- **Un cop al dia i desat:** les lectures canvien un cop al dia. El recàlcul horari no ha de demanar dies passats a Open-Meteo ni llegir 14 dies de lectures cada hora.
- **Una columna `versio`:** durant les 24 h després del deploy conviuen files v1 i v2, i la columna permet distingir-les a l'API i a les proves; també serveix per a una v3 o per a l'ADR-0027.

## Alternatives descartades

- **Fer fosc abans a les valls** (el Sol sota el perfil compta com a post): contradiu la física del crepuscle (fet 1).
- **Lluna amagada = cap llum** (aplicar literalment el «sobre l'horitzó» de l'ADR-0027 a la llum de la Lluna): dona un cel perfecte amb la Lluna alta (fet 2). Aquella definició és correcta per saber si un objectiu **es veu**, no per saber quanta llum fa.
- **Un factor de «cel visible»** (la fracció de la volta que tapa el relleu: un 38 % a Cavallers): és estàtic, o sigui que no diu *quan* anar-hi, i el cel que tapa (els primers 10–30°) és el pitjor per al cel estrellat (més extinció i les cúpules de llum de les ciutats). On sí que compta és en objectius baixos (la Via Làctia, la posta), i això és l'ADR-0027.
- **Corregir els núvols amb la irradiància de la XEMA:** només val de dia, quan els núvols no són els de la nit; caldria un model de cel ras i la radiació prevista, i 4 de les 27 estacions no la mesuren.
- **Corregir la nit d'avui amb les últimes lectures:** són d'ahir. Fer-ho en temps real voldria dir consultar cada hora totes les variables d'una estació (ADR-0025: la quota es multiplica per 100).
- **Biaix de la precipitació:** en 14 dies, gairebé totes les hores són 0; massa soroll per corregir res.
- **La visibilitat d'Open-Meteo com a factor:** la XEMA no la mesura (no es pot validar), i la boira ja és als núvols baixos.
- **Desar totes les previsions** (taula de previsions) i calcular el biaix amb les que es van fer servir de debò, amb l'antelació real: més fidel, però és una taula de ~2.700 files per hora amb la seva neteja. Si mai es fa, només canvia d'on surt la previsió del passat, no el càlcul del biaix.
- **Calcular el biaix a cada recàlcul horari:** 25 crides més a Open-Meteo per hora i 14 dies de lectures llegits cada hora, per a un valor que canvia un cop al dia.
- **Corregir la depressió del punt de rosada en lloc de l'HR:** és la mateixa informació (amb la temperatura, una dona l'altra), però s'hauria de calcular a partir de la XEMA i s'entén menys.

## Conseqüències

- **L'índex només canvia on hi ha un motiu:** les nits humides (HR > 85 %) baixen fins a un 30 %, i els punts de vall pugen quan tenen la Lluna darrere la muntanya. La resta és com a la v1. Les recomanacions, el mapa i les alertes (TG-153) fan servir la v2 sense canviar el codi.
- **La correcció arriba a uns quants punts, no a tots:** amb l'estació assignada només per distància, 15 dels 32 punts tenen més de 350 m de diferència d'altitud (ADR-0025). El pas següent és triar l'estació també per altitud («la més propera dins de ±350 m i 25 km; si no n'hi ha cap, la més propera»), que no canvia ni el càlcul ni el format del biaix.
- **El biaix és el de les primeres hores de previsió.** A 48 h l'error del model és més gran i aquesta part no es corregeix.
- **Pesos i llindars** (a = 0,5; 85 %; 0,7; 48 parelles; ±15; 350 m; 25 km; 7 dies) són una proposta: es revisen amb la sessió de feedback (TG-186) i amb els biaixos de les primeres setmanes, que queden al log.
- Cal aplicar la migració a Supabase (`supabase db push`) abans del deploy que porta la v2, i tornar a generar els tipus (`npm run db:types`).
- Als punts de la frontera, el perfil fora de Catalunya és un mínim (ADR-0022): la Lluna darrere el relleu d'Aragó o de França hi pot comptar com a visible. L'índex surt una mica més baix, mai més alt.
- Tasques afectades: TG-184 (fórmula, biaix, migració, worker, API i fila de l'app), TG-185 (tests), TG-130 (paquet compartit de la fórmula), TG-153 (alertes amb la v2), TG-105 (fila «Humitat»), i l'ADR-0027 si s'accepta (el cel estrellat passa a ser la v2).
