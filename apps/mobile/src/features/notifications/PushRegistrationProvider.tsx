import { createContext, type PropsWithChildren, useContext } from 'react';

import { useAuthState } from '@/features/auth/AuthProvider';

import { usePushRegistration, type PushRegistrationState } from './usePushRegistration';

const PushRegistrationContext = createContext<PushRegistrationState | null>(null);

/** Registra el token amb sessió (un sol cop per a tota l'app) i en comparteix l'estat. */
export function PushRegistrationProvider({ children }: PropsWithChildren) {
  const { user } = useAuthState();
  const state = usePushRegistration(user?.id ?? null);
  return (
    <PushRegistrationContext.Provider value={state}>{children}</PushRegistrationContext.Provider>
  );
}

/** L'estat del permís i del registre, per a la pantalla d'alertes (TG-148). */
export function usePushPermission(): PushRegistrationState {
  const state = useContext(PushRegistrationContext);
  if (!state) throw new Error('usePushPermission requires PushRegistrationProvider');
  return state;
}
