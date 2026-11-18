import { isRunningInExpoGo } from 'expo';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { apiDelete, apiPut } from '@/core/api/httpClient';

import { ALERTS_CHANNEL_ID, pushRepository, UNREGISTER_TIMEOUT_MS } from '../pushRepository';

jest.mock('expo', () => ({ isRunningInExpoGo: jest.fn(() => false) }));
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: { extra: { eas: { projectId: 'projecte-eas' } } },
  },
}));
jest.mock('expo-device', () => ({ isDevice: true }));
jest.mock('expo-notifications', () => ({
  IosAuthorizationStatus: {
    NOT_DETERMINED: 0,
    DENIED: 1,
    AUTHORIZED: 2,
    PROVISIONAL: 3,
    EPHEMERAL: 4,
  },
  AndroidImportance: { HIGH: 5 },
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(async () => null),
  getExpoPushTokenAsync: jest.fn(),
  addPushTokenListener: jest.fn(),
  addNotificationResponseReceivedListener: jest.fn(),
  getLastNotificationResponse: jest.fn(() => null),
  clearLastNotificationResponse: jest.fn(),
  setNotificationHandler: jest.fn(),
}));
jest.mock('@/core/api/httpClient', () => ({
  apiPut: jest.fn(async () => undefined),
  apiDelete: jest.fn(async () => undefined),
}));

const notifications = jest.mocked(Notifications);
const device = Device as { isDevice: boolean };
const runningInExpoGo = jest.mocked(isRunningInExpoGo);
const TOKEN = 'ExponentPushToken[abc]';

const permission = (
  status: 'granted' | 'denied' | 'undetermined',
  ios?: number,
): Notifications.NotificationPermissionsStatus =>
  ({
    status,
    granted: status === 'granted',
    canAskAgain: true,
    expires: 'never',
    ios: ios === undefined ? undefined : { status: ios },
  }) as Notifications.NotificationPermissionsStatus;

beforeEach(async () => {
  jest.clearAllMocks();
  Platform.OS = 'android';
  device.isDevice = true;
  runningInExpoGo.mockReturnValue(false);
  notifications.getExpoPushTokenAsync.mockResolvedValue({ type: 'expo', data: TOKEN });
  // Cap token registrat d'un test anterior.
  await pushRepository.unregisterDevice();
  jest.mocked(apiDelete).mockClear();
});

describe('pushRepository.isSupported', () => {
  it('a un mòbil amb un build propi, sí', () => {
    expect(pushRepository.isSupported()).toBe(true);
  });

  it('a Expo Go, no (no rep push des de l’SDK 53)', () => {
    runningInExpoGo.mockReturnValue(true);
    expect(pushRepository.isSupported()).toBe(false);
  });

  it('a un simulador, no', () => {
    device.isDevice = false;
    expect(pushRepository.isSupported()).toBe(false);
  });

  it('al web, no', () => {
    Platform.OS = 'web';
    expect(pushRepository.isSupported()).toBe(false);
  });
});

describe('pushRepository.getPermission', () => {
  it.each([
    ['granted', permission('granted'), 'granted'],
    ['denied', permission('denied'), 'denied'],
    ['undetermined', permission('undetermined'), 'undetermined'],
    ['provisional a iOS', permission('denied', 3), 'granted'],
  ] as const)('%s → %s', async (_cas, response, expected) => {
    notifications.getPermissionsAsync.mockResolvedValue(response);
    await expect(pushRepository.getPermission()).resolves.toBe(expected);
  });

  it('sense suport torna unavailable sense tocar el mòdul natiu', async () => {
    runningInExpoGo.mockReturnValue(true);
    await expect(pushRepository.getPermission()).resolves.toBe('unavailable');
    expect(notifications.getPermissionsAsync).not.toHaveBeenCalled();
  });
});

describe('pushRepository.requestPermission', () => {
  it('a Android crea el canal abans del diàleg (Android 13+)', async () => {
    notifications.requestPermissionsAsync.mockResolvedValue(permission('granted'));
    await expect(pushRepository.requestPermission('Alertes')).resolves.toBe('granted');
    expect(notifications.setNotificationChannelAsync).toHaveBeenCalledWith(ALERTS_CHANNEL_ID, {
      name: 'Alertes',
      importance: 5,
    });
    expect(notifications.setNotificationChannelAsync.mock.invocationCallOrder[0]).toBeLessThan(
      notifications.requestPermissionsAsync.mock.invocationCallOrder[0]!,
    );
  });

  it('a iOS no crea cap canal', async () => {
    Platform.OS = 'ios';
    notifications.requestPermissionsAsync.mockResolvedValue(permission('denied'));
    await expect(pushRepository.requestPermission('Alertes')).resolves.toBe('denied');
    expect(notifications.setNotificationChannelAsync).not.toHaveBeenCalled();
  });

  it('sense suport no obre cap diàleg', async () => {
    device.isDevice = false;
    await expect(pushRepository.requestPermission('Alertes')).resolves.toBe('unavailable');
    expect(notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  });
});

describe('pushRepository.registerDevice', () => {
  it('demana el token amb el projectId d’EAS i el desa amb PUT /perfil/dispositius', async () => {
    await expect(pushRepository.registerDevice('Alertes')).resolves.toBe(TOKEN);
    expect(notifications.getExpoPushTokenAsync).toHaveBeenCalledWith({ projectId: 'projecte-eas' });
    expect(apiPut).toHaveBeenCalledWith('/perfil/dispositius', {
      token: TOKEN,
      plataforma: 'android',
    });
  });

  it('no repeteix el PUT si el token és el que ja s’ha desat', async () => {
    await pushRepository.registerDevice('Alertes');
    await pushRepository.registerDevice('Alertes');
    expect(apiPut).toHaveBeenCalledTimes(1);

    notifications.getExpoPushTokenAsync.mockResolvedValue({
      type: 'expo',
      data: 'ExponentPushToken[nou]',
    });
    await pushRepository.registerDevice('Alertes');
    expect(apiPut).toHaveBeenCalledTimes(2);
  });

  it('després del logout, el mateix token es torna a desar (pot ser una altra persona)', async () => {
    await pushRepository.registerDevice('Alertes');
    await pushRepository.unregisterDevice();
    await pushRepository.registerDevice('Alertes');
    expect(apiPut).toHaveBeenCalledTimes(2);
  });

  it('propaga l’error si no hi ha token (sense xarxa)', async () => {
    notifications.getExpoPushTokenAsync.mockRejectedValue(new Error('network'));
    await expect(pushRepository.registerDevice('Alertes')).rejects.toThrow('network');
    expect(apiPut).not.toHaveBeenCalled();
  });
});

describe('pushRepository.unregisterDevice', () => {
  it('esborra el token registrat (codificat a la ruta) i només un cop', async () => {
    await pushRepository.registerDevice('Alertes');
    await pushRepository.unregisterDevice();
    await pushRepository.unregisterDevice();
    expect(apiDelete).toHaveBeenCalledTimes(1);
    expect(apiDelete).toHaveBeenCalledWith('/perfil/dispositius/ExponentPushToken%5Babc%5D');
  });

  it('si el PUT encara no ha acabat, l’espera i després esborra el token', async () => {
    let finishPut!: () => void;
    jest.mocked(apiPut).mockReturnValueOnce(
      new Promise<undefined>((resolve) => {
        finishPut = () => resolve(undefined);
      }),
    );
    const registration = pushRepository.registerDevice('Alertes');
    await Promise.resolve();
    const unregister = pushRepository.unregisterDevice();
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(apiDelete).not.toHaveBeenCalled();
    finishPut();
    await registration;
    await unregister;
    expect(apiDelete).toHaveBeenCalledWith('/perfil/dispositius/ExponentPushToken%5Babc%5D');
  });

  it('sense token registrat no fa cap petició', async () => {
    await pushRepository.unregisterDevice();
    expect(apiDelete).not.toHaveBeenCalled();
  });

  it('no falla si l’API falla', async () => {
    await pushRepository.registerDevice('Alertes');
    jest.mocked(apiDelete).mockRejectedValueOnce(new Error('offline'));
    await expect(pushRepository.unregisterDevice()).resolves.toBeUndefined();
  });

  it(`no espera més de ${UNREGISTER_TIMEOUT_MS} ms`, async () => {
    await pushRepository.registerDevice('Alertes');
    jest.useFakeTimers();
    try {
      jest.mocked(apiDelete).mockReturnValueOnce(new Promise(() => {}));
      const done = pushRepository.unregisterDevice();
      await jest.advanceTimersByTimeAsync(UNREGISTER_TIMEOUT_MS);
      await expect(done).resolves.toBeUndefined();
    } finally {
      jest.useRealTimers();
    }
  });

  it('després del temps d’espera, no esborra el token de la sessió següent', async () => {
    let finishPut!: () => void;
    jest.mocked(apiPut).mockReturnValueOnce(
      new Promise<undefined>((resolve) => {
        finishPut = () => resolve(undefined);
      }),
    );
    jest.useFakeTimers();
    try {
      // Compte A: el PUT queda pendent i el logout s'acaba per temps.
      const registrationA = pushRepository.registerDevice('Alertes');
      await Promise.resolve();
      const logoutA = pushRepository.unregisterDevice();
      await jest.advanceTimersByTimeAsync(UNREGISTER_TIMEOUT_MS);
      await logoutA;
      // Compte B registra el mateix token del dispositiu.
      await pushRepository.registerDevice('Alertes');
      // Acaba el PUT d'A: el logout antic no ha d'esborrar el token de B.
      finishPut();
      await registrationA;
      await jest.runAllTimersAsync();
      expect(apiDelete).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
    // El token continua registrat per a B: el seu logout l'esborra.
    await pushRepository.unregisterDevice();
    expect(apiDelete).toHaveBeenCalledTimes(1);
  });
});

describe('pushRepository.onTokenChange', () => {
  it('escolta els canvis de token i es pot desfer', () => {
    const remove = jest.fn();
    notifications.addPushTokenListener.mockReturnValue({ remove });
    const listener = jest.fn();
    const stop = pushRepository.onTokenChange(listener);
    notifications.addPushTokenListener.mock.calls[0]![0]({ type: 'android', data: 'nou' });
    expect(listener).toHaveBeenCalled();
    stop();
    expect(remove).toHaveBeenCalled();
  });
});

describe('a Expo Go', () => {
  it('no carrega expo-notifications, que a Android hi llança un error en importar-lo', async () => {
    runningInExpoGo.mockReturnValue(true);
    let isolated!: typeof pushRepository;
    jest.isolateModules(() => {
      jest.doMock('expo', () => ({ isRunningInExpoGo: () => true }));
      jest.doMock('expo-notifications', () => {
        throw new Error('expo-notifications no s’ha de carregar a Expo Go');
      });
      ({ pushRepository: isolated } =
        jest.requireActual<typeof import('../pushRepository')>('../pushRepository'));
    });
    await expect(isolated.getPermission()).resolves.toBe('unavailable');
    await expect(isolated.requestPermission('Alertes')).resolves.toBe('unavailable');
    expect(() => isolated.onTokenChange(jest.fn())()).not.toThrow();
    await expect(isolated.registerDevice('Alertes')).rejects.toThrow('not supported');
    await expect(isolated.unregisterDevice()).resolves.toBeUndefined();
  });
});

describe('pushRepository.onPointNotificationOpened', () => {
  const resposta = (identifier: string, data: Record<string, unknown> | null) =>
    ({
      actionIdentifier: 'expo.modules.notifications.actions.DEFAULT',
      notification: { request: { identifier, content: { data } } },
    }) as unknown as Notifications.NotificationResponse;
  const remove = jest.fn();
  let tocada: (response: Notifications.NotificationResponse) => void;

  beforeEach(() => {
    notifications.getLastNotificationResponse.mockReturnValue(null);
    notifications.addNotificationResponseReceivedListener.mockImplementation((listener) => {
      tocada = listener;
      return { remove };
    });
  });

  it('amb l’app oberta, en tocar-la passa el puntId i esborra la resposta', () => {
    const listener = jest.fn();
    const stop = pushRepository.onPointNotificationOpened(listener);

    tocada(resposta('n-1', { puntId: 'montsec' }));

    expect(listener).toHaveBeenCalledWith('montsec');
    expect(notifications.clearLastNotificationResponse).toHaveBeenCalled();
    stop();
    expect(remove).toHaveBeenCalled();
  });

  it('la que ha obert l’app en fred també compta, un sol cop encara que el listener la repeteixi', () => {
    notifications.getLastNotificationResponse.mockReturnValue(
      resposta('n-1', { puntId: 'montsec' }),
    );
    const listener = jest.fn();
    pushRepository.onPointNotificationOpened(listener);

    tocada(resposta('n-1', { puntId: 'montsec' }));
    tocada(resposta('n-2', { puntId: 'prades' }));

    expect(listener.mock.calls).toEqual([['montsec'], ['prades']]);
  });

  it('sense un puntId vàlid no obre res', () => {
    const listener = jest.fn();
    pushRepository.onPointNotificationOpened(listener);

    tocada(resposta('n-1', null));
    tocada(resposta('n-2', { puntId: '' }));
    tocada(resposta('n-3', { puntId: 42 }));

    expect(listener).not.toHaveBeenCalled();
  });

  it('mostra les notificacions amb l’app oberta', async () => {
    pushRepository.onPointNotificationOpened(jest.fn());
    const [{ handleNotification }] = notifications.setNotificationHandler.mock.calls[0]! as [
      { handleNotification: () => Promise<unknown> },
    ];
    await expect(handleNotification()).resolves.toEqual({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    });
  });

  it('a Expo Go no toca el mòdul natiu', () => {
    runningInExpoGo.mockReturnValue(true);
    pushRepository.onPointNotificationOpened(jest.fn())();
    expect(notifications.addNotificationResponseReceivedListener).not.toHaveBeenCalled();
  });
});
