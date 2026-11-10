import type { DispositiuPush, PlataformaPush } from '@talaia/shared';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { AndroidImportance, IosAuthorizationStatus } from 'expo-notifications';
import { Platform } from 'react-native';

import { apiDelete, apiPut } from '@/core/api/httpClient';

/**
 * Estat del permís de notificacions que veu la pantalla d'alertes (HU17). `unavailable`: el
 * dispositiu no pot rebre push (Expo Go, simulador o web, ADR-0028), i no es demana res.
 */
export type PushPermission = 'granted' | 'denied' | 'undetermined' | 'unavailable';

/** El canal d'Android de les alertes: el worker hi envia (`channelId: 'alertes'`, ADR-0028). */
export const ALERTS_CHANNEL_ID = 'alertes';

/** Com a molt el temps que el logout espera el `DELETE` del token. */
export const UNREGISTER_TIMEOUT_MS = 3_000;

// El token que s'ha registrat a l'API en aquesta execució: el que es treu en tancar la sessió.
let registeredToken: string | null = null;

function platform(): PlataformaPush | null {
  return Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : null;
}

function projectId(): string | undefined {
  const fromConfig = (Constants.expoConfig?.extra?.eas as { projectId?: string } | undefined)
    ?.projectId;
  return fromConfig ?? Constants.easConfig?.projectId;
}

function toPermission(response: Notifications.NotificationPermissionsStatus): PushPermission {
  const iosStatus = response.ios?.status;
  if (
    response.granted ||
    iosStatus === IosAuthorizationStatus.PROVISIONAL ||
    iosStatus === IosAuthorizationStatus.EPHEMERAL
  ) {
    return 'granted';
  }
  return response.status === 'undetermined' ? 'undetermined' : 'denied';
}

/** Permís, token i registre de les notificacions push (TG-152, ADR-0028). */
export const pushRepository = {
  /**
   * Si aquest dispositiu pot tenir un Expo push token. Expo Go no rep push des de l'SDK 53, i un
   * simulador no en té: en tots dos casos, l'app no demana res.
   */
  isSupported(): boolean {
    return (
      platform() !== null &&
      Device.isDevice &&
      Constants.executionEnvironment !== ExecutionEnvironment.StoreClient
    );
  },

  async getPermission(): Promise<PushPermission> {
    if (!pushRepository.isSupported()) return 'unavailable';
    return toPermission(await Notifications.getPermissionsAsync());
  },

  /** Demana el permís (el diàleg del sistema). A Android 13+, cal el canal abans. */
  async requestPermission(channelName: string): Promise<PushPermission> {
    if (!pushRepository.isSupported()) return 'unavailable';
    await ensureChannel(channelName);
    return toPermission(await Notifications.requestPermissionsAsync());
  },

  /**
   * Obté l'Expo push token i el desa al perfil (`PUT /perfil/dispositius`). Només amb permís
   * concedit. Pot fallar sense xarxa o sense `projectId`: qui la crida decideix què en fa.
   */
  async registerDevice(channelName: string): Promise<string> {
    const plataforma = platform();
    if (!plataforma) throw new Error('Push notifications are not supported on this platform');
    await ensureChannel(channelName);
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: projectId() });
    const body: DispositiuPush = { token, plataforma };
    await apiPut('/perfil/dispositius', body);
    registeredToken = token;
    return token;
  },

  /**
   * Treu el token registrat del perfil abans del logout (ADR-0028). No falla mai ni espera més
   * de `UNREGISTER_TIMEOUT_MS`: sense xarxa, el logout continua i el token queda al perfil.
   */
  async unregisterDevice(): Promise<void> {
    const token = registeredToken;
    if (!token) return;
    registeredToken = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<void>((resolve) => {
      timer = setTimeout(resolve, UNREGISTER_TIMEOUT_MS);
    });
    try {
      await Promise.race([
        apiDelete(`/perfil/dispositius/${encodeURIComponent(token)}`).catch(() => {}),
        timeout,
      ]);
    } finally {
      clearTimeout(timer);
    }
  },

  /** Avisa quan el sistema canvia el token del dispositiu (ADR-0028). */
  onTokenChange(listener: () => void): () => void {
    if (!pushRepository.isSupported()) return () => {};
    const subscription = Notifications.addPushTokenListener(() => listener());
    return () => subscription.remove();
  },
};

async function ensureChannel(name: string): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(ALERTS_CHANNEL_ID, {
    name,
    importance: AndroidImportance.HIGH,
  });
}
