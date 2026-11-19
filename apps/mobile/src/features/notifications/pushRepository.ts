import type { DispositiuPush, PlataformaPush } from '@talaia/shared';
import { isRunningInExpoGo } from 'expo';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import type * as NotificationsModule from 'expo-notifications';
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

let notificationsModule: typeof NotificationsModule | null = null;

/**
 * `expo-notifications` només es carrega on pot funcionar. A Expo Go d'Android, importar-lo ja
 * llança un error: en carregar-se, el mòdul registra un listener del token, i Expo Go ja no en té
 * des de l'SDK 53. Per això no s'importa a dalt del fitxer.
 */
function notifications(): typeof NotificationsModule {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- càrrega diferida (vegeu a dalt)
  notificationsModule ??= require('expo-notifications') as typeof NotificationsModule;
  return notificationsModule;
}

function platform(): PlataformaPush | null {
  return Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : null;
}

function projectId(): string | undefined {
  const fromConfig = (Constants.expoConfig?.extra?.eas as { projectId?: string } | undefined)
    ?.projectId;
  return fromConfig ?? Constants.easConfig?.projectId;
}

function toPermission(response: NotificationsModule.NotificationPermissionsStatus): PushPermission {
  const { IosAuthorizationStatus } = notifications();
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
   * simulador no en té: en tots dos casos, l'app no demana res. Expo Go es detecta amb
   * `isRunningInExpoGo()`, la mateixa comprovació que fa `expo-notifications`:
   * `Constants.executionEnvironment` no serveix, perquè Expo Go 58 hi diu `bare`.
   */
  isSupported(): boolean {
    return platform() !== null && Device.isDevice && !isRunningInExpoGo();
  },

  async getPermission(): Promise<PushPermission> {
    if (!pushRepository.isSupported()) return 'unavailable';
    return toPermission(await notifications().getPermissionsAsync());
  },

  /** Demana el permís (el diàleg del sistema). A Android 13+, cal el canal abans. */
  async requestPermission(channelName: string): Promise<PushPermission> {
    if (!pushRepository.isSupported()) return 'unavailable';
    await ensureChannel(channelName);
    return toPermission(await notifications().requestPermissionsAsync());
  },

  /**
   * Obté l'Expo push token i el desa al perfil (`PUT /perfil/dispositius`), si no és el que ja
   * s'ha desat en aquesta sessió. Només amb permís concedit. Pot fallar sense xarxa o sense
   * `projectId`: qui la crida decideix què en fa.
   */
  async registerDevice(channelName: string): Promise<string> {
    const plataforma = platform();
    if (!plataforma || !pushRepository.isSupported()) {
      throw new Error('Push notifications are not supported on this device');
    }
    const started = generation;
    const registration = (async () => {
      await ensureChannel(channelName);
      const { data: token } = await notifications().getExpoPushTokenAsync({
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
    const started = generation;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<void>((resolve) => {
      timer = setTimeout(resolve, UNREGISTER_TIMEOUT_MS);
    });
    const unregister = async () => {
      await pending;
      // Si s'ha esgotat el temps, ja és una altra sessió: el seu token no s'ha de tocar.
      if (generation !== started) return;
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

  /**
   * Amb l'app oberta, les notificacions també es mostren: si no, Expo no les ensenya (TG-154).
   */
  showNotificationsWhileOpen(): void {
    if (!pushRepository.isSupported()) return;
    notifications().setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  },

  /**
   * Avisa amb el `puntId` quan l'usuari toca una notificació d'una alerta (TG-154, ADR-0028), també
   * la que ha obert l'app en fred (`getLastNotificationResponse`). Cada resposta es fa servir un
   * sol cop: s'esborra en llegir-la, i si el listener rep la mateixa de l'arrencada, no es repeteix.
   */
  onPointNotificationOpened(listener: (puntId: string) => void): () => void {
    if (!pushRepository.isSupported()) return () => {};
    const {
      addNotificationResponseReceivedListener,
      clearLastNotificationResponse,
      getLastNotificationResponse,
    } = notifications();
    let handled: string | null = null;
    const handle = (response: NotificationsModule.NotificationResponse) => {
      const { identifier, content } = response.notification.request;
      if (identifier === handled) return;
      handled = identifier;
      clearLastNotificationResponse();
      const puntId: unknown = content.data?.puntId;
      // El que arriba de fora es valida: només un identificador no buit obre la fitxa.
      if (typeof puntId === 'string' && puntId !== '') listener(puntId);
    };
    const last = getLastNotificationResponse();
    if (last) handle(last);
    const subscription = addNotificationResponseReceivedListener(handle);
    return () => subscription.remove();
  },

  /** Avisa quan el sistema canvia el token del dispositiu (ADR-0028). */
  onTokenChange(listener: () => void): () => void {
    if (!pushRepository.isSupported()) return () => {};
    const subscription = notifications().addPushTokenListener(() => listener());
    return () => subscription.remove();
  },
};

async function ensureChannel(name: string): Promise<void> {
  if (Platform.OS !== 'android') return;
  const { AndroidImportance, setNotificationChannelAsync } = notifications();
  await setNotificationChannelAsync(ALERTS_CHANNEL_ID, {
    name,
    importance: AndroidImportance.HIGH,
  });
}
