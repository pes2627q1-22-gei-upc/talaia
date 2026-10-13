# ADR-0015: Mapa amb MapLibre GL JS en una DOM component d'Expo

**Estat:** Acceptada · **Data:** 2026-10-10 · Substitueix la part de MapLibre Native i del *development build* de l'[ADR-0005](0005-mapa-icgc-maplibre.md)

## Context

L'ADR-0005 triava MapLibre amb les tessel·les i el relleu 3D de l'ICGC, amb el binding natiu (`@maplibre/maplibre-react-native`). Provant-lo a TG-89 van sortir dos problemes:

1. **MapLibre Native no té terreny 3D** (`terrain`): només ombrejat 2D. La implementació és en un PR obert ([maplibre-native#4190](https://github.com/maplibre/maplibre-native/pull/4190), octubre del 2026). HU06 demana «relleu 3D».
2. **No funciona a Expo Go**, que és com l'equip prova als mòbils ([ADR-0014](0014-identificador-app-expo-go.md)).

MapLibre **GL JS** (web) sí que té terreny 3D, cel i boira, i Expo permet incrustar codi web amb les **DOM components** (`'use dom'`): un WebView que funciona a Expo Go.

## Decisió

- El mapa és una DOM component, `apps/mobile/src/features/map/NightMap.tsx`, amb **`maplibre-gl` 5.x**. La 6 només es publica en ESM i carrega el *worker* amb `import.meta.url`, que Metro no resol. S'hi passarà quan Metro ho admeti.
- **Estil:** el mateix estil nocturn de l'ICGC (`style/nightStyle.ts`), amb **terreny 3D real** (model d'elevacions de l'ICGC, 5 m a Catalunya i 30 m al voltant, exageració 1,2), relleu ombrejat a sobre i un cel de nit amb boira a l'horitzó. El terreny i l'ombrejat fan servir dues fonts `raster-dem` iguals, com recomana MapLibre.
- **MVVM:** el ViewModel prepara l'estil i la càmera (constants de mòdul) i la pantalla els passa com a props. Dins del WebView no hi ha tokens: els colors dels controls arriben com a props.
- **El mapa es crea un sol cop.** El pont de les DOM components és asíncron i torna a enviar les props a cada render natiu.
- **Babel no toca `maplibre-gl/dist`** (`apps/mobile/metro.transformer.js`): MapLibre converteix en text el codi del seu *worker*, i els helpers que hi afegeix Babel no existeixen dins del *worker*. Sense això, el mapa no pinta res.

Descartats:

| Opció | Per què no |
|---|---|
| MapLibre Native (`@maplibre/maplibre-react-native`) | Sense terreny 3D i sense Expo Go. Va ser la primera versió de TG-89 |
| Mapbox (`@rnmapbox/maps`) | Natiu: tampoc funciona a Expo Go. A més, *token* i cost (ADR-0005) |
| `react-native-maps` / `expo-maps` | Apple Maps i Google Maps: sense cartografia de l'ICGC ni estil nocturn propi |

## Conseqüències

- Tota l'app, mapa inclòs, es prova a Expo Go a qualsevol mòbil.
- **Rendiment per mesurar al dispositiu:** WebGL dins d'un WebView va fluid en mòbils moderns. Cal comprovar els 60 fps en un Android de gamma mitjana. En mode d'estalvi d'energia, iOS limita els fotogrames del web.
- **Arrencada:** el JavaScript de la DOM component no és bytecode de Hermes i triga una mica més a carregar.
- **Comunicació amb l'app per props i accions asíncrones.** Per a TG-90: els punts entren com a GeoJSON en una font amb `cluster: true` dins del mateix GL JS, i triar un punt crida una acció nativa (`onSelectPoint`).
- **A l'Expo Go actual** el WebView deixa una franja `nit` sota la barra d'estat i a la barra de pestanyes: ignora `contentInsetAdjustmentBehavior: 'never'`.
- Si es vol provar un altre estil o una altra font de relleu, es fa al navegador (la mateixa DOM component funciona a la web).
