# ADR-0014: Identificador `cat.talaia.app` i Expo Go per provar en dispositius

**Estat:** Acceptada · **Data:** 2026-10-10 · Resol la decisió pendent P22

## Context

Per generar qualsevol build natiu de l'app (EAS, `expo prebuild`) cal un identificador: `ios.bundleIdentifier` i `android.package`, que fins ara era la P22. A més, l'equip prova l'app als mòbils amb **Expo Go**: treballa amb macOS, Windows i Linux, i no tothom té Xcode ni un compte de desenvolupador d'Apple de pagament. Un *development build* propi obligaria a tothom a compilar-lo o a dependre d'EAS i, a iPhone, del compte d'Apple.

## Decisió

- **Identificador:** `cat.talaia.app` a iOS i a Android (`apps/mobile/app.json`). Es pot canviar fins a la primera publicació a les botigues; després ja no. *Avís:* el domini `talaia.cat` és d'una altra persona; si a la botiga hi ha conflicte, es revisa abans de publicar.
- **Expo Go és l'entorn de proves** de tota l'app, mapa inclòs (el mapa és una DOM component: [ADR-0015](0015-mapa-dom-component.md)). `npm run mobile` i escanejar el QR.
- **Cap mòdul natiu que no porti Expo Go** sense un ADR que ho justifiqui. Abans de fer-ne servir un, mira si és a la llista de l'SDK (`npx expo install` el valida) i si Expo Go l'inclou.

## Conseqüències

- No hi ha `expo-dev-client` ni `eas.json`. Quan calgui un build per publicar (TestFlight, Play), s'afegeixen els perfils d'EAS en aquell moment.
- Les carpetes `ios/` i `android/` no es versionen; si algú fa `expo prebuild` en local, es generen.
- **Actualització 2026-10-25 (SDK 58):** l'Expo Go de les botigues només obre projectes del seu SDK. Quan va sortir el de l'SDK 58, ningú que l'hagués actualitzat podia obrir el projecte, que era de l'SDK 57. Cal pujar d'SDK quan surt el nou Expo Go. Mentrestant, a Android es pot instal·lar l'APK de l'SDK anterior (<https://expo.dev/go>) i, a iOS, només el simulador (l'Expo CLI hi instal·la la versió que toca) o un Expo Go de l'SDK anterior per TestFlight (`npx eas-cli go`, amb el compte d'Apple Developer).
