---
paths:
  - "apps/mobile/**"
---

# App mòbil

- **MVVM, tokens i i18n.** Les regles són a `CLAUDE.md` (Convencions) i a `docs/design-system.md`. Cap color, mida ni text escrit a mà.
- **Els tres idiomes** (`src/core/i18n/locales/{ca,es,en}.json`) tenen exactament les mateixes claus, i `locales.test.ts` ho comprova. Si el català necessita una variant `_vowel`, també ha d'existir a l'es i a l'en.
- **React Query.** Si una propietat del resultat (`isStale`, `data`…) només es llegeix dins d'un callback, el component no es torna a pintar quan canvia. Cal llegir-la en pintar: `const { isStale } = query` (#131).
- **Tests amb el rellotge simulat.** Per deixar córrer les promeses sense avançar el temps, `await jest.advanceTimersByTimeAsync(0)`. `runOnlyPendingTimersAsync()` avança el rellotge fins al temporitzador següent i pot amagar el bug que es prova.
- **Tests amb mutacions.** Fes servir `src/test-utils/queryWrapper.tsx`. Sense el `gcTime` de les mutacions, Jest no acaba i la CI cau als 15 minuts (#146, #149).
- **Expo Go ha de continuar funcionant** (ADR-0014). Cap mòdul natiu nou sense ADR. Si un mòdul no hi és, `require` diferit i `isRunningInExpoGo()` (#110).
- **Typecheck i rutes d'Expo Router.** Si falla amb una ruta nova, esborra `apps/mobile/.expo/types`: són tipus generats i desfasats.
- **Pantalla nova o modificada.** Tests de presentació i comprovació visual segons `docs/testing-ui.md`, i la fila corresponent a `docs/testing-ui-inventari.md`.
