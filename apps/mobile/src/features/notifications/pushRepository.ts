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

// El token que s'ha registrat a l'API en aquesta sessió: el que es treu en tancar-la, i el que
// evita repetir el `PUT` si no ha canviat.
let registeredToken: string | null = null;
// El registre en curs: el logout l'espera, perquè el `DELETE` no arribi abans que el `PUT`.
let pendingRegistration: Promise<unknown> | null = null;
// Puja a cada logout: un registre que acaba després no deixa el token com a registrat.
let generation = 0;

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
   * Obté l'Expo push token i el desa al perfil (`PUT /perfil/dispositius`), si no és el que ja
   * s'ha desat en aquesta sessió. Només amb permís concedit. Pot fallar sense xarxa o sense
   * `projectId`: qui la crida decideix què en fa.
   */
  async registerDevice(channelName: string): Promise<string> {
    const plataforma = platform();
    if (!plataforma) throw new Error('Push notifications are not supported on this platform');
    const started = generation;
    const registration = (async () => {
      await ensureChannel(channelName);
      const { data: token } = await Notifications.getExpoPushTokenAsync({
        projectId: projectId(),
      });
      if (token === registeredToken) return token;
      const body: DispositiuPush = { token, plataforma };
      await apiPut('/perfil/dispositius', body);
      if (generation === started) registeredToken = token;
      return token;
    })();
    const pending = registration.catch(() => {});
    pendingRegistration = pending;
    try {
      return await registration;
    } finally {
      if (pendingRegistration === pending) pendingRegistration = null;
    }
  },

  /**
   * Treu el token registrat del perfil abans del logout (ADR-0028), també si el `PUT` encara
   * no havia acabat. No falla mai ni espera més de `UNREGISTER_TIMEOUT_MS`: sense xarxa, el
   * logout continua i el token queda al perfil.
   */
  async unregisterDevice(): Promise<void> {
    const pending = pendingRegistration;
    if (!registeredToken && !pending) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<void>((resolve) => {
      timer = setTimeout(resolve, UNREGISTER_TIMEOUT_MS);
    });
    const unregister = async () => {
      await pending;
      const token = registeredToken;
      registeredToken = null;
      generation++;
      if (token) {
        await apiDelete(`/perfil/dispositius/${encodeURIComponent(token)}`).catch(() => {});
      }
    };
    try {
      await Promise.race([unregister(), timeout]);
    } finally {
      clearTimeout(timer);
      // Si s'ha esgotat el temps, la sessió que ve no ha d'heretar el token d'aquesta.
      registeredToken = null;
      generation++;
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
