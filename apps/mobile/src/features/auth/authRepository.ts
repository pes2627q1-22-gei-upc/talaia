import { AppState, Platform } from 'react-native';

import { getAuthClient } from '@/core/auth/supabase';

export type AuthUser = { id: string; email?: string };

function toUser(user: AuthUser | null | undefined): AuthUser | null {
  return user ? { id: user.id, email: user.email } : null;
}

export const authRepository = {
  async getUser(): Promise<AuthUser | null> {
    const client = getAuthClient();
    if (!client) return null;
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    return toUser(data.session?.user);
  },
  subscribe(onChange: (user: AuthUser | null) => void): () => void {
    const client = getAuthClient();
    if (!client) return () => {};
    const { data } = client.auth.onAuthStateChange((event, session) => {
      // La restauració explícita gestiona també els errors. El SDK pot emetre
      // INITIAL_SESSION amb null quan falla la lectura/renovació inicial.
      if (event === 'INITIAL_SESSION') return;
      // No cridar mètodes async de Supabase dins d'aquest callback (lock d'Auth).
      onChange(toUser(session?.user));
    });
    return () => data.subscription.unsubscribe();
  },
  async signOut(): Promise<void> {
    const client = getAuthClient();
    if (!client) return;
    const { error } = await client.auth.signOut({ scope: 'local' });
    if (error) throw error;
  },
  startAutoRefresh(): () => void {
    const client = getAuthClient();
    if (!client || Platform.OS === 'web') return () => {};
    const update = (state: string) => {
      if (state === 'active') client.auth.startAutoRefresh();
      else client.auth.stopAutoRefresh();
    };
    update(AppState.currentState);
    const listener = AppState.addEventListener('change', update);
    return () => {
      listener.remove();
      client.auth.stopAutoRefresh();
    };
  },
};
