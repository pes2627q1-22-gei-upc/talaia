# ADR-0016: «Continua amb Apple» només a iOS

**Estat:** Acceptada · **Data:** 2026-10-12 · Resol la decisió pendent P15

## Context

La pantalla de benvinguda (mockup 01, TG-82) ofereix tres maneres d'entrar: Google, Apple i correu. Sign in with Apple necessita un compte d'Apple Developer de pagament (P15), i HU35 diu que s'ofereix «si hi ha compte de desenvolupador disponible». Ara n'hi ha un per al projecte.

A més, l'App Store demana que una app que permet entrar amb un servei de tercers (com Google) n'ofereixi també un altre amb garanties de privacitat equivalents (norma 4.8 de l'App Store Review Guidelines). Sign in with Apple és la manera directa de complir-la.

## Decisió

- **A iOS, la benvinguda mostra «Continua amb Apple»** entre Google i el correu, com al mockup.
- **A Android no es mostra.** Sign in with Apple no és natiu a Android i la norma 4.8 només afecta l'App Store.
- El ViewModel ho exposa com a `showApple` (`apps/mobile/src/features/auth/useWelcomeViewModel.ts`), amb test per a les dues plataformes.

## Conseqüències

- TG-81 configura el proveïdor d'Apple a Supabase Auth amb el compte d'Apple Developer del projecte. TG-83 hi connecta l'acció del ViewModel.
- Com s'implementa l'inici de sessió (natiu o pel navegador) ho decideixen TG-81 i TG-83, respectant l'[ADR-0014](0014-identificador-app-expo-go.md): tot es prova a Expo Go.
- Quan el botó iniciï sessió de debò, ha de seguir les pautes de disseny d'Apple per a aquest botó (logotip i text). També el de Google ha de portar el logotip «G» oficial. Ara són botons del design system sense lògica d'autenticació.
