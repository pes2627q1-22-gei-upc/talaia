import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** El navegador només té la clau pública; el rol es comprova sempre a l'API. */
export const authClient =
  url && key
    ? createClient(url, key, {
        auth: {
          flowType: 'pkce',
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
        },
      })
    : null;

let redirectResult: Promise<void> | undefined;

/** React StrictMode pot muntar dues vegades l'app: el codi PKCE només es pot bescanviar un cop. */
export function completeAuthRedirect(): Promise<void> {
  if (!authClient) return Promise.resolve();
  const client = authClient;
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const authError = params.get('error_description');
  if (!code && !authError) return Promise.resolve();
  redirectResult ??= (async () => {
    window.history.replaceState({}, '', window.location.pathname);
    if (authError) throw new Error(authError);
    const { error } = await client.auth.exchangeCodeForSession(code!);
    if (error) throw error;
  })();
  return redirectResult;
}

export async function checkAdmin(accessToken: string): Promise<'allowed' | 'denied'> {
  const response = await fetch('/api/v1/admin/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });
  if (response.status === 204) return 'allowed';
  if (response.status === 401 || response.status === 403) return 'denied';
  throw new Error(`No s'ha pogut comprovar l'accés (${response.status})`);
}
