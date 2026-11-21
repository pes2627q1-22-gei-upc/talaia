import { vi } from 'vitest';

export type Session = { access_token: string };
type AuthEvent = 'INITIAL_SESSION' | 'SIGNED_IN' | 'SIGNED_OUT' | 'TOKEN_REFRESHED';
type Listener = (event: AuthEvent, session: Session | null) => void;
type AuthResult = { data?: unknown; error: Error | null };

const ok: AuthResult = { data: {}, error: null };

/**
 * Client d'auth de Supabase en memòria: només el que fa servir la web d'administració.
 * Com el real, avisa els subscriptors en iniciar o tancar sessió i en subscriure's.
 */
export function createFakeSupabase(initialSession: Session | null = null) {
  let session = initialSession;
  const listeners = new Set<Listener>();

  function emit(event: AuthEvent, next: Session | null) {
    session = next;
    for (const listener of listeners) listener(event, next);
  }

  const auth = {
    onAuthStateChange: vi.fn((listener: Listener) => {
      listeners.add(listener);
      queueMicrotask(() => listener('INITIAL_SESSION', session));
      return { data: { subscription: { unsubscribe: () => listeners.delete(listener) } } };
    }),
    getSession: vi.fn(async (): Promise<AuthResult> => ({ data: { session }, error: null })),
    exchangeCodeForSession: vi.fn(async (_code: string): Promise<AuthResult> => {
      emit('SIGNED_IN', { access_token: 'token-google' });
      return ok;
    }),
    signInWithOAuth: vi.fn(async (_credentials: unknown): Promise<AuthResult> => ok),
    signInWithOtp: vi.fn(async (_credentials: unknown): Promise<AuthResult> => ok),
    verifyOtp: vi.fn(async (_params: unknown): Promise<AuthResult> => {
      emit('SIGNED_IN', { access_token: 'token-correu' });
      return ok;
    }),
    signOut: vi.fn(async (): Promise<AuthResult> => {
      emit('SIGNED_OUT', null);
      return ok;
    }),
  };

  return { client: { auth }, auth, emit };
}

export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** Simula `GET /api/v1/admin/me` i `GET /api/v1/admin/punts` per a les proves de l'admin. */
export function stubAdminApi(...statuses: number[]) {
  const pending = [...statuses];
  const fetch = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
    if (String(input) === '/api/v1/admin/punts') {
      return new Response('[]', {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const status = pending.length > 1 ? pending.shift()! : pending[0]!;
    return new Response(null, { status });
  });
  vi.stubGlobal('fetch', fetch);
  return fetch;
}
