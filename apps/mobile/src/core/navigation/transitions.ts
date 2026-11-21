import { isRunningInExpoGo } from 'expo';
import { Platform } from 'react-native';

/**
 * Transicions entre pantalles: el lliscament d'iOS a les dues plataformes i, a iOS, tornar enrere
 * lliscant des de qualsevol punt de la pantalla. El fons de cada pantalla és el `background` del tema
 * de navegació (`_layout.tsx`), que canvia amb el mode nit.
 */
export const stackOptions = {
  headerShown: false,
  animation: 'ios_from_right',
  fullScreenGestureEnabled: true,
} as const;

/**
 * A iOS, fora d'Expo Go, la barra d'estat la porta cada pantalla (`UIViewControllerBasedStatusBarAppearance`
 * a `app.json`): l'app fa servir escenes, i l'API global de `StatusBar` no l'amaga (ADR-0032). A Expo
 * Go la clau és `false` i aquestes opcions hi peten; allà, i a Android, la porta `<StatusBar>`.
 */
export function statusBarPerScreen(os = Platform.OS, expoGo = isRunningInExpoGo()): boolean {
  return os === 'ios' && !expoGo;
}

/**
 * Opcions del Stack arrel. Les pantalles que no diuen res de la barra (també les de les pestanyes i
 * les dels Stacks de dins) fan servir aquestes: en mode nit s'amaga, perquè l'hora i la bateria de
 * l'iOS sempre surten en blanc i no es poden tenyir.
 */
export function rootStackOptions(night: boolean, perScreen = statusBarPerScreen()) {
  return perScreen
    ? ({ ...stackOptions, statusBarStyle: 'light', statusBarHidden: night } as const)
    : stackOptions;
}
