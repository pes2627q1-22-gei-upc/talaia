import 'react-native-url-polyfill/auto';

import { createClient, processLock, type SupabaseClient } from '@supabase/supabase-js';

import { env } from '@/core/config/env';

import { sessionStorage } from './sessionStorage';

let client: SupabaseClient | undefined;

/** Un únic client d'Auth; les dades de domini continuen passant per l'API. */
export function getAuthClient(): SupabaseClient | null {
  if (!env.supabaseUrl || !env.supabaseAnonKey) return null;
  client ??= createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: {
      storage: sessionStorage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      lock: processLock,
    },
  });
  return client;
}
