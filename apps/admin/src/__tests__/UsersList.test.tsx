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
const props = { accessToken: 'token', currentUserId: 'self', onAccessDenied: vi.fn() };
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe('Llista d’usuaris', () => {
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
