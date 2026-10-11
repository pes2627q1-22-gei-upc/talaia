# ADR-0005: Mapa amb MapLibre i tessel·les de l'ICGC; rutes via Mobilicat + deep link

**Estat:** Acceptada · **Data:** 2026-09 (Incepció 2)

> **2026-10-10:** el motor del mapa és MapLibre **GL JS** en una DOM component, amb terreny 3D i a Expo Go, i ja no cal *development build*: [ADR-0015](0015-mapa-dom-component.md).

## Context

Volem un mapa molt més estètic que Google Maps, fosc i en 3D, amb dades obertes i sense cost.

## Decisió

MapLibre amb les tessel·les vectorials i el relleu 3D de l'ICGC, amb un estil nocturn propi (paleta Talaia). Distància i temps fins als punts via el servei de rutes de l'equip Mobilicat; per navegar, deep link a l'app de mapes del mòbil. Descartats: Google Maps SDK (cost, clau, poc personalitzable), Mapbox (llicència i preu).

## Conseqüències

Atribució ICGC + OpenStreetMap obligatòria. Cal development build d'Expo. Sense servei de rutes propi.
