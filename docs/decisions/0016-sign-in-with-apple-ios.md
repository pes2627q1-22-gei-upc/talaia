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
- **Actualització 2026-10-15:** connectar els botons (Google, Apple i correu) i la crida que assegura el perfil passa a [TG-249](https://tree.taiga.io/project/mohamed-dari-pes_22_c_talaia/task/249) (Martina); TG-83 queda per a la sessió. Apple fa servir el **flux natiu** (`expo-apple-authentication` i `signInWithIdToken`): a Expo Go el token és per a `host.exp.Exponent`, que s'afegeix als *Client IDs* del proveïdor a Supabase, i no cal Services ID ni la clau secreta que caduca cada 6 mesos. L'Apple Developer només cal per activar la capacitat a l'App ID `cat.talaia.app`. Google va pel navegador (`signInWithOAuth` i `expo-web-browser`).
- Quan el botó iniciï sessió de debò, ha de seguir les pautes de disseny d'Apple per a aquest botó (logotip i text). També el de Google ha de portar el logotip «G» oficial. Ara són botons del design system sense lògica d'autenticació.
- **Actualització 2026-10-20 (TG-249):** fet. El botó és l'oficial d'Apple (`AppleAuthenticationButton`, tipus «Continua», estil negre) i el de Google porta el logotip «G». El ViewModel continua exposant `showApple`.
- **Actualització 2026-10-22:** Expo Go (SDK 57) **no porta el mòdul natiu** d'`expo-apple-authentication`, ni al simulador ni al mòbil: `isAvailableAsync()` dona `false` i el botó oficial surt com «Unimplemented component». El flux natiu només funciona als builds natius (`cat.talaia.app`). Perquè Apple surti i funcioni a Expo Go, on es prova tot (ADR-0014), sense el mòdul natiu va **pel navegador**, com Google (`signInWithOAuth`). Això demana el que la decisió del 2026-10-15 evitava: un **Services ID** (`cat.talaia.web`, amb el domini i la tornada de Supabase) i una **clau** de Sign in with Apple, amb la qual es genera el secret (`supabase/scripts/apple-secret.mjs`). **El secret caduca cada 6 mesos** i s'ha de regenerar abans: l'actual (clau `RT43ZN4WSK`, equip `MUY564KAW3`) caduca el **2027-04-20**. `host.exp.Exponent` ja no fa falta als *Client IDs*. El botó passa a ser propi, amb el logotip i el text que demanen les pautes d'Apple, i és el mateix en tots dos casos.
