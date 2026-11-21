import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { UsuariAdmin } from '@talaia/shared';
import { describe, expect, it, vi } from 'vitest';

import { UsersList } from '../UsersList';
import { deferred } from './support/fakeAuth';

const USERS: UsuariAdmin[] = [
  {
    id: '1',
    authUserId: 'self',
    nom: 'Àngela',
    email: 'angela@example.cat',
    avatarUrl: null,
    rol: 'admin',
    bloquejat: false,
    dataBloqueig: null,
    dataCreacio: '2026-11-20T10:00:00Z',
    dataActualitzacio: '2026-11-20T10:00:00Z',
  },
  {
    id: '2',
    authUserId: 'other',
    nom: null,
    email: null,
    avatarUrl: null,
    rol: 'usuari',
    bloquejat: true,
    dataBloqueig: '2026-11-19T10:00:00Z',
    dataCreacio: '2026-11-19T10:00:00Z',
    dataActualitzacio: '2026-11-19T10:00:00Z',
  },
];
const props = {
  accessToken: 'token',
  currentUserId: 'self',
  active: true,
  onAccessDenied: vi.fn(),
};
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe('Llista d’usuaris', () => {
  it('confirma el bloqueig d’un altre administrador i permet desbloquejar-lo', async () => {
    const person = {
      ...USERS[1]!,
      nom: 'Joan',
      email: 'joan@example.cat',
      rol: 'admin' as const,
      bloquejat: false,
      dataBloqueig: null,
    };
    const blocked = { ...person, bloquejat: true, dataBloqueig: '2026-11-19T10:00:00Z' };
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method !== 'PATCH') return response([USERS[0], person]);
      return response(JSON.parse(String(init.body)).bloquejat ? blocked : person);
    });
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    render(<UsersList {...props} />);
    expect(await screen.findByText('No pots bloquejar el teu compte')).toBeInTheDocument();
    const block = screen.getByRole('button', { name: /Bloqueja Joan/ });
    await user.click(block);
    expect(screen.getByRole('alertdialog')).toHaveTextContent('joan@example.cat');
    expect(screen.getByRole('button', { name: 'Cancel·la' })).toHaveFocus();
    await user.keyboard('{Shift>}{Tab}{/Shift}');
    expect(screen.getByRole('button', { name: 'Confirma el bloqueig' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Cancel·la' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(block).toHaveFocus();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await user.click(block);
    await user.click(screen.getByRole('button', { name: 'Confirma el bloqueig' }));
    expect(await screen.findByRole('status')).toHaveTextContent('bloquejat correctament');
    const patchCall = fetchMock.mock.calls[1]!;
    expect(patchCall[0]).toBe('/api/v1/admin/usuaris/2');
    expect(JSON.parse(String(patchCall[1]?.body))).toEqual({ bloquejat: true });
    expect(new Headers(patchCall[1]?.headers).get('Authorization')).toBe('Bearer token');
    await user.click(screen.getByRole('button', { name: /Desbloqueja Joan/ }));
    expect(await screen.findByRole('status')).toHaveTextContent('desbloquejat correctament');
    expect(JSON.parse(String(fetchMock.mock.calls[2]?.[1]?.body))).toEqual({ bloquejat: false });
  });

  it('impedeix accions duplicades i exigeix actualitzar quan el resultat és incert', async () => {
    const pending = deferred<Response>();
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'PATCH') return pending.promise;
      return response(USERS);
    });
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    render(<UsersList {...props} />);
    await user.click(await screen.findByRole('button', { name: /Desbloqueja Sense nom/ }));
    expect(screen.getByRole('button', { name: /Desbloqueja Sense nom/ })).toBeDisabled();
    pending.reject(new TypeError('network'));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No s’ha pogut confirmar el resultat',
    );
    expect(screen.getByRole('button', { name: /Desbloqueja Sense nom/ })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Actualitza la llista' }));
    expect(await screen.findByRole('button', { name: /Desbloqueja Sense nom/ })).toBeEnabled();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it.each([
    [400, 'cannot_block_self', 'No pots bloquejar el teu propi compte.'],
    [404, 'usuari_not_found', 'Aquest usuari ja no existeix'],
  ])('explica l’error %s de la modificació', async (status, code, message) => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) =>
        init?.method === 'PATCH' ? response({ error: { code } }, status) : response(USERS),
      ),
    );
    const user = userEvent.setup();
    render(<UsersList {...props} />);
    await user.click(await screen.findByRole('button', { name: /Desbloqueja Sense nom/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent(message);
  });

  it('retira l’accés si el PATCH és rebutjat per permisos', async () => {
    const denied = vi.fn();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) =>
        init?.method === 'PATCH' ? new Response(null, { status: 403 }) : response(USERS),
      ),
    );
    const user = userEvent.setup();
    render(<UsersList {...props} onAccessDenied={denied} />);
    await user.click(await screen.findByRole('button', { name: /Desbloqueja Sense nom/ }));
    await vi.waitFor(() => expect(denied).toHaveBeenCalledOnce());
  });

  it('mostra els perfils i filtra per nom, correu i estat', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      response(USERS),
    );
    vi.stubGlobal('fetch', fetchMock);
    const { rerender } = render(<UsersList {...props} />);
    expect(await screen.findByRole('row', { name: /Àngela/ })).toHaveTextContent('el teu compte');
    const blocked = screen.getByRole('row', { name: /Sense nom/ });
    expect(blocked).toHaveTextContent('Sense correu');
    expect(blocked).toHaveTextContent('Bloquejat');
    expect(within(blocked).getByText(/19.*nov.*2026/)).toBeInTheDocument();
    expect(new Headers(fetchMock.mock.calls[0]?.[1]?.headers).get('Authorization')).toBe(
      'Bearer token',
    );

    await user.type(screen.getByLabelText('Cerca per nom o correu'), 'ANGELA');
    expect(screen.queryByRole('row', { name: /Sense nom/ })).not.toBeInTheDocument();
    await user.clear(screen.getByLabelText('Cerca per nom o correu'));
    await user.type(screen.getByLabelText('Cerca per nom o correu'), 'example.cat');
    expect(screen.getByRole('row', { name: /Àngela/ })).toBeInTheDocument();
    await user.clear(screen.getByLabelText('Cerca per nom o correu'));
    await user.selectOptions(screen.getByLabelText('Filtra per estat'), 'blocked');
    expect(screen.queryByRole('row', { name: /Àngela/ })).not.toBeInTheDocument();
    rerender(<UsersList {...props} accessToken="renovat" />);
    expect(screen.getByLabelText('Filtra per estat')).toHaveValue('blocked');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await user.type(screen.getByLabelText('Cerca per nom o correu'), 'inexistent');
    expect(screen.getByText('No s’han trobat usuaris amb aquests criteris.')).toBeInTheDocument();
  });

  it('distingeix la càrrega, els errors, el reintent i la llista buida', async () => {
    const user = userEvent.setup();
    const pending = deferred<Response>();
    const fetchMock = vi
      .fn()
      .mockReturnValueOnce(pending.promise)
      .mockResolvedValueOnce(response([]));
    vi.stubGlobal('fetch', fetchMock);
    render(<UsersList {...props} />);
    expect(screen.getByRole('status')).toHaveTextContent('Carregant usuaris');
    pending.resolve(new Response(null, { status: 503 }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No s’han pogut carregar');
    await user.click(screen.getByRole('button', { name: 'Torna-ho a provar' }));
    expect(await screen.findByText('Encara no hi ha usuaris.')).toBeInTheDocument();
  });

  it.each([401, 403])('denega l’accés si l’API respon %i', async (status) => {
    const denied = vi.fn();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status })),
    );
    render(<UsersList {...props} onAccessDenied={denied} />);
    await vi.waitFor(() => expect(denied).toHaveBeenCalledOnce());
  });
});
