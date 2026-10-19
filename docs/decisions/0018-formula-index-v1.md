# ADR-0018: Fórmula de l'índex v1: els núvols i el Sol multipliquen, la foscor i la Lluna es ponderen

**Estat:** Acceptada · **Data:** 2026-10-16 · Resol la decisió pendent P12 · TG-98

## Context

L'índex de visibilitat (0–100) és el nucli del producte ([ADR-0004](0004-index-precalculat.md)). La v1 (Sprint 1) combina els núvols (Open-Meteo, TG-95), la foscor del cel (mapa de contaminació lumínica, TG-97) i la Lluna (Astronomy Engine, TG-96). Ha de ser **explicable**: la fitxa del punt el desglossa per factors (HU04, TG-104 i TG-105). P12 demanava fixar els pesos i els llindars de color.

## Decisió

```
índex = 100 × N × S × (0,6 · F + 0,4 · L)        arrodonit a l'enter, de 0 a 100
```

Cada factor va de 0 a 1:

| Factor | Càlcul |
|---|---|
| **N** núvols | 1 − la capa que més tapa: `max(baixos, 0,85 · mitjans, 0,5 · alts) / 100`. Sense capes, la coberta total. Si plou a l'hora (> 0,1 mm) o no hi ha cap dada de núvols, 0. |
| **S** Sol | 1 de nit o en el crepuscle astronòmic, 0,5 en el nàutic, 0 en el civil o de dia. |
| **F** foscor | `(SQM − 17,5) / 4`: 17,5 mag/arcsec² és cel de ciutat (0) i 21,5 o més, cel fosc (1). Fins que TG-97 doni l'SQM de cada punt, **0,6** i l'índex es marca `foscorEstimada`. |
| **L** Lluna | `1 − fracció il·luminada × min(1, alçada / 30°)`. Sota l'horitzó, 1. |

**Franges** (tokens del design system): 0–39 `tap`, 40–69 `jus`, 70–100 `ras`.

- **Els núvols i el Sol multipliquen**, perquè amb el cel tapat o de dia no hi ha res a veure, faci la nit que faci. La foscor i la Lluna diuen com de bo és un cel ras: per això es ponderen.
- **La capa que més tapa mana.** Els núvols baixos tapen del tot; els alts (cirrus) deixen veure les estrelles més brillants i compten la meitat.
- **Codi pur i 100 % testejable**: `services/worker/src/index/formula.ts` (`FORMULA_V1` hi té tots els pesos i llindars). Els tipus del desglossament (`FactorsIndex`, `IndexHora`) són a `@talaia/shared`.
- **Persistència horària**: taula `index_visibilitat`, una fila per punt i hora amb el valor, la franja, els factors i `foscor_estimada`. Recalcular una hora la substitueix (`on conflict (punt_id, hora)`), així el worker horari (TG-99) no duplica res.

Exemple: cel ras, de nit, Lluna mig il·luminada a 20° i foscor estimada → `100 × 1 × 1 × (0,36 + 0,4 × 0,67)` = **63 · jus**.

## Alternatives descartades

- **Suma ponderada** (`0,5 · N + 0,3 · F + 0,2 · L`): la més fàcil d'explicar, però un cel tapat del tot, de nit i sense Lluna, treu un 38, a tocar de «regular».
- **Producte de tots els factors**: castiga dues vegades una nit amb una mica de Lluna en un cel fosc, i el desglossament ja no es pot llegir com «què aporta cada factor».

## Conseqüències

- La v1 val per al **cel estrellat** («Qualsevol cel ras»). Per a fenòmens on la Lluna és l'objectiu (la Lluna plena, una superlluna) o per a les postes de sol, el factor Lluna i el Sol s'han d'adaptar per fenomen: és feina de les recomanacions per fenomen (TG-100, HU01) en sprints posteriors.
- Quan TG-97 tingui l'SQM per punt, l'índex deixa de ser estimat sense tocar la fórmula. El perfil d'horitzó (TG-116) i l'ajust amb les observacions de Meteocat entren a l'índex v2 (Sprint 2).
- Canviar un pes és canviar `FORMULA_V1` i els tests que el fixen, a la mateixa PR i amb un ADR que substitueixi aquest.
- Tasques afectades: TG-99 (crida `calculaIndexHores` i el repositori cada hora), TG-100 i TG-92 (llegeixen la taula), TG-103 (tests de la fórmula), TG-104 i TG-105 (mostren els factors).
