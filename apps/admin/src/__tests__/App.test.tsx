import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { createFakeSupabase, deferred, stubAdminApi, type Session } from './support/fakeAuth';

const supabase = vi.hoisted(() => ({ client: undefined as unknown }));
vi.mock('@supabase/supabase-js', () => ({ createClient: () => supabase.client }));

const ADMIN: Session = { access_token: 'token-admin' };
const CONFIRMED = 'Accés d’administrador confirmat.';
const NO_ACCESS = 'Aquest compte no té accés a l’administració.';
const SIGN_IN_FAILED = 'No s’ha pogut completar l’inici de sessió. Torna-ho a provar.';

type FakeAuth = ReturnType<typeof createFakeSupabase>['auth'];

/** Obre la web com main.tsx (StrictMode), amb una sessió guardada o sense, a l'adreça indicada. */
async function openAdmin({
  session = null,
  url = '/',
  configure,
}: {
  session?: Session | null;
  url?: string;
  /** Respostes de Supabase que la web ja necessita en muntar-se. */
  configure?: (auth: FakeAuth) => void;
}) {
  window.history.replaceState({}, '', url);
  const fake = createFakeSupabase(session);
  configure?.(fake.auth);
  supabase.client = fake.client;
  // auth.ts crea el client i recorda el retorn PKCE en carregar-se: cada test parteix de zero.
  vi.resetModules();
  const { App } = await import('../App');
  const user = userEvent.setup();
  render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
  return { user, auth: fake.auth, emit: fake.emit };
}

function googleButton() {
  return screen.queryByRole('button', { name: 'Continua amb Google' });
}

function lastAuthorization(fetch: ReturnType<typeof stubAdminApi>) {
  const [url, init] = fetch.mock.lastCall!;
  return { url, authorization: new Headers(init?.headers).get('Authorization') };
}

describe('Càrrega i errors', () => {
  it('indica que comprova l’accés mentre l’API respon', async () => {
    const response = deferred<Response>();
    const fetch = vi.fn(() => response.promise);
    vi.stubGlobal('fetch', fetch);
    await openAdmin({ session: ADMIN });

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(screen.getByText('Comprovant l’accés…')).toBeInTheDocument();
    expect(googleButton()).not.toBeInTheDocument();

    await act(async () => response.resolve(new Response(null, { status: 204 })));
    expect(await screen.findByText(CONFIRMED)).toBeInTheDocument();
    expect(screen.queryByText('Comprovant l’accés…')).not.toBeInTheDocument();
  });

  it('avisa de l’error si la web no té la configuració de Supabase', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '');
    const fetch = stubAdminApi(204);
    await openAdmin({ session: ADMIN });

    expect(await screen.findByRole('alert')).toHaveTextContent('No s’ha pogut comprovar l’accés');
    expect(googleButton()).not.toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([
    ['l’API respon amb un error', () => stubAdminApi(500)],
    [
      'no hi ha connexió amb l’API',
      () => vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))),
    ],
  ])('avisa de l’error si %s', async (_case, stubApi) => {
    stubApi();
    await openAdmin({ session: ADMIN });

    expect(await screen.findByRole('alert')).toHaveTextContent('No s’ha pogut comprovar l’accés');
    expect(screen.queryByText(CONFIRMED)).not.toBeInTheDocument();
  });

  it('avisa si no pot llegir la sessió guardada', async () => {
    stubAdminApi(204);
    await openAdmin({
      configure: (auth) => auth.getSession.mockResolvedValue({ error: new Error('storage') }),
    });

    expect(await screen.findByRole('status')).toHaveTextContent(SIGN_IN_FAILED);
    expect(screen.getByRole('alert')).toHaveTextContent('No s’ha pogut comprovar l’accés');
  });
});

describe('Inici de sessió', () => {
  it('sense sessió, ofereix Google i el codi pel correu sense consultar l’API', async () => {
    const fetch = stubAdminApi(204);
    await openAdmin({});

    expect(await screen.findByRole('button', { name: 'Continua amb Google' })).toBeInTheDocument();
    expect(screen.getByLabelText('Correu electrònic')).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('amb Google, demana tornar a la mateixa pàgina de la web', async () => {
    stubAdminApi(204);
    const { user, auth } = await openAdmin({ url: '/admin/' });

    await user.click(await screen.findByRole('button', { name: 'Continua amb Google' }));

    expect(auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/admin/` },
    });
  });

  it('avisa si no pot iniciar la sessió amb Google', async () => {
    stubAdminApi(204);
    const { user, auth } = await openAdmin({});
    auth.signInWithOAuth.mockResolvedValue({ error: new Error('provider disabled') });

    await user.click(await screen.findByRole('button', { name: 'Continua amb Google' }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      'No s’ha pogut iniciar la sessió amb Google.',
    );
  });

  it('amb el correu i el codi de sis xifres, entra si el compte és administrador', async () => {
    const fetch = stubAdminApi(204);
    const { user, auth } = await openAdmin({});

    await user.type(await screen.findByLabelText('Correu electrònic'), 'admin@talaia.cat');
    await user.click(screen.getByRole('button', { name: 'Envia’m un codi' }));

    expect(await screen.findByRole('status')).toHaveTextContent('T’hem enviat un codi al correu.');
    // La web d'administració no crea comptes nous.
    expect(auth.signInWithOtp).toHaveBeenCalledWith({
      email: 'admin@talaia.cat',
      options: { shouldCreateUser: false },
    });

    await user.type(screen.getByLabelText('Codi de sis xifres'), '123456');
    await user.click(screen.getByRole('button', { name: 'Verifica el codi' }));

    expect(await screen.findByText(CONFIRMED)).toBeInTheDocument();
    expect(auth.verifyOtp).toHaveBeenCalledWith({
      email: 'admin@talaia.cat',
      token: '123456',
      type: 'email',
    });
    expect(lastAuthorization(fetch)).toEqual({
      url: '/api/v1/admin/me',
      authorization: 'Bearer token-correu',
    });
  });

  it('desactiva l’enviament mentre s’envia el codi', async () => {
    stubAdminApi(204);
    const { user, auth } = await openAdmin({});
    const sending = deferred<{ error: null }>();
    auth.signInWithOtp.mockReturnValue(sending.promise);

    await user.type(await screen.findByLabelText('Correu electrònic'), 'admin@talaia.cat');
    await user.click(screen.getByRole('button', { name: 'Envia’m un codi' }));

    expect(screen.getByRole('button', { name: 'Envia’m un codi' })).toBeDisabled();
    await act(async () => sending.resolve({ error: null }));
    expect(await screen.findByLabelText('Codi de sis xifres')).toBeInTheDocument();
  });

  it('si no pot enviar el codi, ho diu i deixa tornar-ho a provar', async () => {
    stubAdminApi(204);
    const { user, auth } = await openAdmin({});
    auth.signInWithOtp.mockResolvedValue({ error: new Error('Signups not allowed for otp') });

    await user.type(await screen.findByLabelText('Correu electrònic'), 'algu@talaia.cat');
    await user.click(screen.getByRole('button', { name: 'Envia’m un codi' }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      'No s’ha pogut enviar el codi. Comprova el correu i torna-ho a provar.',
    );
    expect(screen.getByLabelText('Correu electrònic')).toHaveValue('algu@talaia.cat');
    expect(screen.getByRole('button', { name: 'Envia’m un codi' })).toBeEnabled();
  });

  it('si el codi no és vàlid o ha caducat, ho diu i no entra', async () => {
    const fetch = stubAdminApi(204);
    const { user, auth } = await openAdmin({});
    auth.verifyOtp.mockResolvedValue({ error: new Error('Token has expired or is invalid') });

    await user.type(await screen.findByLabelText('Correu electrònic'), 'admin@talaia.cat');
    await user.click(screen.getByRole('button', { name: 'Envia’m un codi' }));
    await user.type(await screen.findByLabelText('Codi de sis xifres'), '000000');
    await user.click(screen.getByRole('button', { name: 'Verifica el codi' }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      'El codi no és vàlid o ha caducat.',
    );
    expect(screen.getByLabelText('Codi de sis xifres')).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('Retorn de Google (PKCE)', () => {
  it('bescanvia el codi un sol cop, neteja l’adreça i comprova l’accés', async () => {
    const fetch = stubAdminApi(204);
    const { auth } = await openAdmin({ url: '/?code=codi-pkce' });

    expect(await screen.findByText(CONFIRMED)).toBeInTheDocument();
    // StrictMode munta l'app dues vegades, però el codi només es pot bescanviar un cop.
    expect(auth.exchangeCodeForSession).toHaveBeenCalledTimes(1);
    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith('codi-pkce');
    expect(window.location.search).toBe('');
    expect(lastAuthorization(fetch).authorization).toBe('Bearer token-google');
  });

  it('si Google torna un error, ho diu i neteja l’adreça', async () => {
    stubAdminApi(204);
    const { auth } = await openAdmin({
      url: '/?error=access_denied&error_description=L%27usuari+ha+cancel%C2%B7lat',
    });

    expect(await screen.findByRole('status')).toHaveTextContent(SIGN_IN_FAILED);
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(window.location.search).toBe('');
  });

  it('si el codi ja no és vàlid, ho diu i no entra', async () => {
    const fetch = stubAdminApi(204);
    await openAdmin({
      url: '/?code=codi-caducat',
      configure: (auth) =>
        auth.exchangeCodeForSession.mockResolvedValue({ error: new Error('invalid flow state') }),
    });

    expect(await screen.findByRole('status')).toHaveTextContent(SIGN_IN_FAILED);
    expect(screen.queryByText(CONFIRMED)).not.toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('Rol d’administrador', () => {
  it('mostra la zona d’administració si l’API confirma el rol amb el token de la sessió', async () => {
    const fetch = stubAdminApi(204);
    await openAdmin({ session: ADMIN });

    expect(await screen.findByText(CONFIRMED)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tanca la sessió' })).toBeInTheDocument();
    expect(lastAuthorization(fetch)).toEqual({
      url: '/api/v1/admin/me',
      authorization: 'Bearer token-admin',
    });
  });

  it.each([401, 403])(
    'si l’API respon %i, denega l’accés i deixa tancar la sessió',
    async (status) => {
      stubAdminApi(status);
      const { user } = await openAdmin({ session: ADMIN });

      expect(await screen.findByRole('alert')).toHaveTextContent(NO_ACCESS);
      expect(screen.queryByText(CONFIRMED)).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Tanca la sessió' }));
      expect(
        await screen.findByRole('button', { name: 'Continua amb Google' }),
      ).toBeInTheDocument();
    },
  );
});

describe('Tancament i caducitat de la sessió', () => {
  it('en tancar la sessió, torna a l’inici de sessió', async () => {
    stubAdminApi(204);
    const { user, auth } = await openAdmin({ session: ADMIN });

    await user.click(await screen.findByRole('button', { name: 'Tanca la sessió' }));

    expect(await screen.findByRole('button', { name: 'Continua amb Google' })).toBeInTheDocument();
    expect(screen.queryByText(CONFIRMED)).not.toBeInTheDocument();
    expect(auth.signOut).toHaveBeenCalledTimes(1);
  });

  it('avisa si no pot tancar la sessió', async () => {
    stubAdminApi(204);
    const { user, auth } = await openAdmin({ session: ADMIN });
    auth.signOut.mockResolvedValue({ error: new Error('network') });

    await user.click(await screen.findByRole('button', { name: 'Tanca la sessió' }));

    expect(await screen.findByRole('status')).toHaveTextContent('No s’ha pogut tancar la sessió.');
    expect(screen.getByText(CONFIRMED)).toBeInTheDocument();
  });

  it('quan la sessió caduca, torna a demanar el correu des de zero', async () => {
    stubAdminApi(204);
    const { user, emit } = await openAdmin({});
    await user.type(await screen.findByLabelText('Correu electrònic'), 'admin@talaia.cat');
    await user.click(screen.getByRole('button', { name: 'Envia’m un codi' }));
    await user.type(await screen.findByLabelText('Codi de sis xifres'), '123456');
    await user.click(screen.getByRole('button', { name: 'Verifica el codi' }));
    expect(await screen.findByText(CONFIRMED)).toBeInTheDocument();

    // Supabase no ha pogut renovar el token i tanca la sessió.
    await act(async () => emit('SIGNED_OUT', null));

    expect(screen.queryByText(CONFIRMED)).not.toBeInTheDocument();
    expect(screen.getByLabelText('Correu electrònic')).toHaveValue('');
    expect(screen.queryByLabelText('Codi de sis xifres')).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('quan Supabase renova el token, torna a comprovar el rol i el perd si l’hi han tret', async () => {
    const fetch = stubAdminApi(204, 204, 403);
    const { emit } = await openAdmin({ session: ADMIN });
    expect(await screen.findByText(CONFIRMED)).toBeInTheDocument();
    const checks = fetch.mock.calls.length;

    await act(async () => emit('TOKEN_REFRESHED', { access_token: 'token-renovat' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(NO_ACCESS);
    expect(fetch).toHaveBeenCalledTimes(checks + 1);
    expect(lastAuthorization(fetch).authorization).toBe('Bearer token-renovat');
  });

  it('no mostra la zona d’administració si la resposta de l’API arriba després de sortir', async () => {
    const response = deferred<Response>();
    const fetch = vi.fn(() => response.promise);
    vi.stubGlobal('fetch', fetch);
    const { emit } = await openAdmin({ session: ADMIN });
    await waitFor(() => expect(fetch).toHaveBeenCalled());

    await act(async () => emit('SIGNED_OUT', null));
    await act(async () => response.resolve(new Response(null, { status: 204 })));

    expect(screen.getByRole('button', { name: 'Continua amb Google' })).toBeInTheDocument();
    expect(screen.queryByText(CONFIRMED)).not.toBeInTheDocument();
  });
});
