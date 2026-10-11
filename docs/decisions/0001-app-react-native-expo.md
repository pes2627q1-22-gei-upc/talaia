# ADR-0001: App mòbil amb React Native + TypeScript + Expo, patró MVVM

**Estat:** Acceptada · **Data:** 2026-09 (Incepció 2)

## Context

Necessitem una app per a Android i iOS feta per sis persones en un quadrimestre, amb mapa 3D, notificacions push i compilació per a iOS sense que tothom tingui Mac. L'equip coneix JavaScript.

## Decisió

React Native + TypeScript amb Expo (EAS Build, Expo Push, dev client). Patró MVVM: View sense lògica → ViewModel (hook `useXxxViewModel`) → Repository (accés a l'API). Descartats: Flutter (Dart només a l'app, corba d'aprenentatge, ecosistema de mapa i Supabase menys madur), natiu Kotlin+Swift (dues bases de codi), Ionic/Capacitor (mapa menys fluid), PWA (push i segon pla limitats a iOS).

## Conseqüències

Tipus compartits amb el servidor via `packages/shared`. El mapa (MapLibre GL JS) és una DOM component i funciona a Expo Go ([ADR-0015](0015-mapa-dom-component.md); abans aquí deia que calia un *development build*). Les pantalles no criden l'API directament.
