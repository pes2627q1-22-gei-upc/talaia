# ADR-0037: Barra de pestanyes pròpia en lloc de la nativa

**Estat:** Proposada · **Data:** 2026-11-20 · TG-239 · Substitueix en part l'[ADR-0010](0010-eines-app.md) (P2, pestanyes natives)

## Context

L'ADR-0010 va triar les pestanyes natives d'Expo Router (`NativeTabs`). En mode nit (ADR-0032), tota l'app ha de ser vermella sobre negre. Una build Release al simulador d'iOS 27 amb el mode nit forçat ho va mesurar píxel a píxel: la barra nativa és l'única peça de les pantalles principals que no s'hi pot posar.

- Des d'iOS 26, el fons de la barra és un vidre que pinta el sistema: en mode nit surt gris (`#202020`). La documentació d'Expo ho diu: `backgroundColor`, `blurEffect` i `shadowColor` no hi fan res.
- Les pestanyes no triades surten en blanc (`#F9F9F9`) encara que hi passem `iconColor` i `labelStyle`.
- Quan hi passa contingut vermell per sota, el vidre hi afegeix reflexos blancs.

## Decisió

Una barra pròpia (`core/navigation/TabBar.tsx`) amb els `Tabs` JavaScript d'Expo Router (`expo-router/js-tabs`), en els dos temes:

- va amb el tema: el fons, la càpsula, la pestanya triada (`far` sobre `crep`) i les altres (`boira`);
- les icones continuen sent SF Symbols a iOS i Material Symbols a Android, amb `expo-symbols` (Expo Go el porta) i `tintColor`;
- queda sota les pantalles, i no per sobre com la nativa d'iOS 26: cap contingut no hi queda tapat, i les pantalles no han de reservar-ne l'espai;
- cada pestanya és un `tab` accessible amb l'estat `selected`, i tornar a tocar la triada fa el `tabPress` que la pila fa servir per tornar a l'inici.

S'hi van pensar dues alternatives:

- **La nativa de dia i la pròpia de nit:** el mode normal no canviava, però hi hauria dues barres per mantenir, i un salt visual en entrar al mode nit.
- **Deixar la nativa:** no compleix l'ADR-0032.

## Conseqüències

- Es perd el vidre d'iOS 26 a la barra. A canvi, la barra es veu igual a iOS i a Android, i és el pas previ a la barra del mockup amb les icones de Talaia.
- El mapa (`MapScreen`) ja no suma la zona segura de baix, perquè la barra ja la deixa.
- Les pestanyes canvien a l'instant, sense animació, com fins ara (design system, «Moviment»).
