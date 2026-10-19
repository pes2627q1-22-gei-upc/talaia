# ADR-0022: Perfil d'horitzó per punt: el model de 5 m de l'ICGC pel WCS, a tres resolucions, omple `punts_observacio.horitzo`

**Estat:** Acceptada · **Data:** 2026-10-19 · TG-116

## Context

El quart factor de Talaia ([producte.md](../producte.md)) és el relleu: quina part del cel tapen les muntanyes. Un punt al fons d'una vall (Santa Fe del Montseny, el pantà de Cavallers) veu la Lluna i la posta de sol més tard i més d'hora que un cim, i el catàleg només en tenia una aproximació a mà (`horitzo_obert`, [ADR-0017](0017-cataleg-inicial-punts.md)). La font acordada és el model d'elevacions de 5 m de l'ICGC, preprocessat una vegada ([arquitectura.md](../arquitectura.md)). L'índex v1 no el fa servir: entra a la v2 (Sprint 2, [ADR-0018](0018-formula-index-v1.md)).

En mirar-ho de prop:

- L'ICGC serveix el **Model d'elevacions del terreny de Catalunya 5 × 5 m** (CC BY 4.0) pel seu WCS (`geoserveis.icgc.cat/icc_mdt/wcs/service`, cobertura `icc:met`) en EPSG:25831, **només en ArcGrid** (text), remostrejat pel veí més proper a la resolució que es demana. El servei tria el model de 5 m o el de 15 m segons la resolució, i una petició que surt de l'extensió del model torna una malla retallada d'una altra mida.
- Les tessel·les de relleu del mapa (`contextmaps-terreny-5m-rgb`, [ADR-0015](0015-mapa-dom-component.md)) surten del mateix model, però són PNG per pintar: caldria un descodificador de PNG.
- **El model només cobreix Catalunya.** Fora, el WCS no hi té dades: ni el mar ni l'Aragó, França o Andorra. Les tessel·les tampoc.
- Una finestra de 50 km al voltant d'un punt a 5 m són 400 milions de cel·les; el WCS en dona 1 milió en uns 40 s.

## Decisió

El mateix flux que la foscor ([ADR-0020](0020-foscor-sqm-geotiff.md)): un preprocés en Node a `data/scripts/`, sense dependències noves, que escriu el resultat al GeoJSON del catàleg i d'allà al seed.

1. **Tres finestres per punt** (`horitzo.ts`, `NIVELLS`), centrades al punt i retallades a l'extensió del model: **5 m fins a 1,5 km, 30 m fins a 12 km i 200 m fins a 50 km**. Les muntanyes properes demanen detall i les llunyanes, abast. L'error d'agafar el veí més proper és, en una vessant forta i a l'inici de cada nivell, d'uns 0,4°, i baixa amb la distància. Són ~1,25 milions de cel·les per punt.
2. **Un raig per grau d'azimut geogràfic, des de 50 m del punt.** L'alçada de l'horitzó és l'angle més alt fins al terreny vist des d'uns ulls a 2 m, amb la corbatura de la Terra i la refracció terrestre estàndard (k = 0,13): l'alçada **aparent**, la que es veu. El nord de la quadrícula UTM no és el geogràfic (fins a 1,5° de diferència a ponent): el raig es gira amb la convergència de meridians. El relleu a menys de 50 m no compta: les coordenades tenen uns metres d'error i l'observador es mou, i amb el raig des de 10 m un monticle de 4 m al costat del punt tapava 11° del cel de Bellmunt, que és dalt d'un turó.
3. **Fora del model compta el nivell del mar.** Sobre el mar és exacte; sobre terra és un **mínim**. Quan el raig hi entra des d'una cota de més de 10 m (no des de la costa), l'azimut és incomplet i `fill-horitzo.ts` ho diu.
4. **`punts_observacio.horitzo real[]`**: 360 alçades en graus amb 1 decimal (la posició és l'azimut, 0 = N), amb un `check` que exigeix exactament 360 valors en una llista que comenci a 1, cap element `null` i tots entre −90° i 90°; la columna és `null` si no s'ha calculat. Els nuls es busquen a part perquè `-90 <= all (…)` amb un element `null` dona `null`, i un `check` només rebutja `false`. `real` i no `numeric`, perquè el client de Postgres el torni com a `number[]` (a diferència de l'`sqm`).
5. **Memòria cau** a `data/raw/met/` (GeoTIFF per punt i nivell, no versionat): la segona execució no torna a baixar res.

### Per què així

- **WCS i no tessel·les:** és el servei de dades del model (ArcGrid, cotes ortomètriques), no una imatge per pintar, i el text es llegeix sense cap descodificador. El GeoTIFF de la memòria cau fa servir el que ja escriu i llegeix `mapa-foscor.ts`.
- **Tres resolucions i no una:** una sola a 5 m són hores de descàrrega per punt; una sola a 50 m dona errors de més d'1° a les vessants properes, que són les que més tapen.
- **Un perfil per punt, precalculat:** el relleu no canvia, els punts són pocs i el worker horari no ha de dependre del WCS.

## Alternatives descartades

- **Tessel·les de relleu del mapa:** més ràpides, però caldria descodificar PNG i seguir un producte cartogràfic que pot canviar sense avís.
- **Descarregar el model sencer** (fulls de l'ICGC) i retallar-lo en local: uns 5 GB a 5 m per a 32 punts.
- **Copernicus DEM (30 m) o SRTM:** cobreixen també fora de Catalunya, però són més grossos i no són la font acordada. És la manera d'omplir els azimuts incomplets si l'índex v2 ho necessita (vegeu les conseqüències).
- **Guardar 8 direccions en lloc de 360 graus:** la Lluna i el Sol surten per un azimut concret, i una muntanya estreta cau entre dues direccions.

## Conseqüències

- Els 32 punts oficials tenen `horitzo`. `horitzo_obert` es queda tal com és (descripció a mà); el script avisa quan diu obert on el relleu tapa més de 3° de mitjana.
- **Els punts de la frontera tenen azimuts amb un mínim** (el Montsec cap a l'Aragó, els Ports, els colls del Pirineu). Si l'índex v2 ho necessita, s'omplen amb Copernicus DEM fora de Catalunya, sense canviar el format.
- L'alçada és aparent: per saber si un astre és per sobre de l'horitzó, cal la seva alçada aparent (la geomètrica d'`efemeridesHora` més la refracció, uns 0,5° a l'horitzó).
- Els punts de la **comunitat** neixen amb `horitzo = null`: el mòdul ja els pot calcular, però en calent tarda mig minut i depèn del WCS. Es decidirà amb la creació de punts (HU de la comunitat).
- El tipus `PuntObservacio` de `@talaia/shared` no porta `horitzo` fins que algú el faci servir (índex v2, fitxa del punt).
