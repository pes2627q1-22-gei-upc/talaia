import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppState } from 'react-native';

import { pushRepository, type PushPermission } from './pushRepository';

export type PushRegistrationState = {
  /** `null` sense sessió o mentre encara no s'ha mirat. */
  permission: PushPermission | null;
  /** Si el token d'aquest dispositiu és al perfil. */
  registered: boolean;
  /** El diàleg del permís: la pantalla d'alertes el demana en crear-ne una (ADR-0028). */
  requestPermission: () => Promise<PushPermission>;
};

type Snapshot = { userId: string; permission: PushPermission | null; registered: boolean };

/**
 * Amb sessió, mira el permís de notificacions i, si està concedit, registra el token a l'API
 * (TG-152). Ho torna a mirar quan l'app torna a primer pla (el permís es pot canviar a la
 * configuració) i quan canvia el token. Mai no falla: sense token (Expo Go, simulador, sense
 * xarxa), `registered` queda a `false` i l'app continua igual.
 */
export function usePushRegistration(userId: string | null): PushRegistrationState {
  const { t } = useTranslation();
  const channelName = t('notifications.channelName');
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  // Només el resultat de la sessió actual: un registre lent d'un altre usuari no compta.
  const session = useRef<string | null>(null);

  const update = useCallback((forUser: string, patch: Partial<Omit<Snapshot, 'userId'>>) => {
    if (session.current !== forUser) return;
    setSnapshot((prev) => ({
      userId: forUser,
      permission: prev?.userId === forUser ? prev.permission : null,
      registered: prev?.userId === forUser ? prev.registered : false,
      ...patch,
    }));
  }, []);

  const register = useCallback(
    async (forUser: string) => {
      try {
        await pushRepository.registerDevice(channelName);
        update(forUser, { registered: true });
      } catch {
        update(forUser, { registered: false });
      }
    },
    [channelName, update],
  );

  const sync = useCallback(
    async (forUser: string) => {
      let permission: PushPermission;
      try {
        permission = await pushRepository.getPermission();
      } catch {
        permission = 'unavailable';
      }
      update(forUser, { permission });
      if (permission === 'granted') await register(forUser);
      else update(forUser, { registered: false });
    },
    [register, update],
  );

  useEffect(() => {
    session.current = userId;
    if (!userId) return undefined;
    void sync(userId);
    const stopTokenListener = pushRepository.onTokenChange(() => void register(userId));
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') void sync(userId);
    });
    return () => {
      session.current = null;
      stopTokenListener();
      appState.remove();
    };
  }, [userId, sync, register]);

  const requestPermission = useCallback(async () => {
    const forUser = session.current;
    let permission: PushPermission;
    try {
      permission = await pushRepository.requestPermission(channelName);
    } catch {
      permission = 'unavailable';
    }
    if (forUser) {
      update(forUser, { permission });
      if (permission === 'granted') await register(forUser);
    }
    return permission;
  }, [channelName, register, update]);

  // L'estat d'un altre usuari (o d'abans del logout) no es mostra mai.
  const current = snapshot?.userId === userId ? snapshot : null;
  return {
    permission: current?.permission ?? null,
    registered: current?.registered ?? false,
    requestPermission,
  };
}
