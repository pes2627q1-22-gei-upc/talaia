import 'react-native-url-polyfill/auto';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { env } from '@/core/config/env';

import { sessionStorage } from './sessionStorage';
import { installWebCrypto } from './webCrypto';

installWebCrypto();

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
      // Google torna un `code` d'un sol ús a la redirecció, no els tokens (TG-249).
      flowType: 'pkce',
    },
  });
  return client;
}
