import { createClient } from '@supabase/supabase-js';

import { env } from '@/core/config/env';

import { installWebCrypto } from '../webCrypto';

jest.mock('react-native-url-polyfill/auto', () => ({}));
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({ auth: {} })),
}));
jest.mock('../webCrypto', () => ({ installWebCrypto: jest.fn() }));
jest.mock('@/core/config/env', () => ({
  env: { apiUrl: 'http://localhost:3000/api/v1', supabaseUrl: '', supabaseAnonKey: '' },
}));

/**
 * El mòdul guarda el client en una variable: cada test el carrega de nou, amb el `sessionStorage`
 * d'aquell mateix registre de mòduls (per poder comparar-lo per identitat).
 */
function loadAuthModule() {
  let getAuthClient!: typeof import('../supabase').getAuthClient;
  let sessionStorage!: typeof import('../sessionStorage').sessionStorage;
  jest.isolateModules(() => {
    ({ getAuthClient } = jest.requireActual<typeof import('../supabase')>('../supabase'));
    ({ sessionStorage } =
      jest.requireActual<typeof import('../sessionStorage')>('../sessionStorage'));
  });
  return { getAuthClient, sessionStorage };
}

const configured = { supabaseUrl: 'https://example.supabase.co', supabaseAnonKey: 'anon-key' };
const mutableEnv = env as { supabaseUrl: string; supabaseAnonKey: string };

beforeEach(() => {
  jest.clearAllMocks();
  Object.assign(mutableEnv, { supabaseUrl: '', supabaseAnonKey: '' });
});

it("sense EXPO_PUBLIC_SUPABASE_URL o la clau anònima no hi ha client: l'app va sense sessió", () => {
  const { getAuthClient } = loadAuthModule();
  expect(getAuthClient()).toBeNull();
  mutableEnv.supabaseUrl = configured.supabaseUrl;
  expect(getAuthClient()).toBeNull();
  expect(createClient).not.toHaveBeenCalled();
});

it('crea el client un sol cop, amb la sessió al magatzem segur i el PKCE (TG-249)', () => {
  Object.assign(mutableEnv, configured);
  const { getAuthClient, sessionStorage } = loadAuthModule();

  const client = getAuthClient();

  expect(client).not.toBeNull();
  expect(getAuthClient()).toBe(client);
  expect(createClient).toHaveBeenCalledTimes(1);
  expect(createClient).toHaveBeenCalledWith(configured.supabaseUrl, configured.supabaseAnonKey, {
    auth: {
      storage: sessionStorage,
      persistSession: true,
      autoRefreshToken: true,
      // Google torna un `code` a la redirecció: no hi ha res a llegir de la URL.
      detectSessionInUrl: false,
      flowType: 'pkce',
    },
  });
});

it('instal·la el WebCrypto que necessita el PKCE abans de res', () => {
  loadAuthModule();
  expect(installWebCrypto).toHaveBeenCalledTimes(1);
});
