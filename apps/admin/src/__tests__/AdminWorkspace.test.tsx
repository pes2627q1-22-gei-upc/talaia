import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { PuntAdmin } from '@talaia/shared';

import { AdminWorkspace } from '../AdminWorkspace';

const TOKEN = 'token-admin';
const PUNT: PuntAdmin = {
  id: '7d3f2c1a-5b4e-4f6a-9c8d-1e2f3a4b5c6d',
  slug: 'mirador-del-montsec',
  nom: 'Mirador del Montsec',
  municipi: 'Àger',
  descripcio: 'Parc Astronòmic del Montsec.',
  altitud: 817,
  horitzoObert: ['S', 'SW'],
  accessibilitat: "Accés en cotxe fins a l'equipament",
  sqm: null,
  estat: 'PUBLICAT',
  origen: 'OFICIAL',
  dataCreacio: '2026-10-12T10:00:00.000Z',
  dataActualitzacio: '2026-10-12T10:00:00.000Z',
  lat: 42.0244,
  lon: 0.7364,
};

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('Espai d’administració de punts', () => {
  it('conserva el filtre i el formulari de punts en canviar de secció', async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => response([PUNT])),
    );
    const { rerender } = render(
      <AdminWorkspace accessToken={TOKEN} currentUserId="admin-auth-id" onAccessDenied={vi.fn()} />,
    );

    await user.type(await screen.findByLabelText('Cerca per nom o municipi'), 'Àger');
    await user.click(screen.getByRole('button', { name: 'Usuaris' }));
    expect(screen.getByRole('heading', { name: 'Usuaris' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Usuaris' })).toHaveAttribute('aria-current', 'page');
    await user.click(screen.getByRole('button', { name: 'Punts' }));
    expect(screen.getByLabelText('Cerca per nom o municipi')).toHaveValue('Àger');

    await user.click(screen.getByRole('button', { name: 'Nou punt' }));
    await user.type(screen.getByLabelText('Nom'), 'Punt sense desar');
    await user.click(screen.getByRole('button', { name: 'Usuaris' }));
    rerender(
      <AdminWorkspace
        accessToken="token-renovat"
        currentUserId="admin-auth-id"
        onAccessDenied={vi.fn()}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Punts' }));
    expect(screen.getByLabelText('Nom')).toHaveValue('Punt sense desar');
  });

  it('crea i edita un punt tornant a la llista després de cada acció', async () => {
    const user = userEvent.setup();
    let points: PuntAdmin[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === '/api/v1/admin/punts' && init?.method === 'POST') {
        const payload = JSON.parse(String(init.body)) as Partial<PuntAdmin>;
        const created = { ...PUNT, ...payload } as PuntAdmin;
        points = [created];
        return response(created, 201);
      }
      if (url === `/api/v1/admin/punts/${PUNT.id}` && init?.method === 'PATCH') {
        const changes = JSON.parse(String(init.body)) as Partial<PuntAdmin>;
        points = [{ ...PUNT, ...points[0], ...changes }];
        return response(points[0]);
      }
      if (url === '/api/v1/admin/punts') return response(points);
      if (url === `/api/v1/admin/punts/${PUNT.id}`) return response(points[0] ?? PUNT);
      throw new Error(`Petició inesperada: ${init?.method ?? 'GET'} ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <AdminWorkspace accessToken={TOKEN} currentUserId="admin-auth-id" onAccessDenied={vi.fn()} />,
    );

    expect(await screen.findByText('Encara no hi ha punts al catàleg.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Nou punt' }));
    expect(screen.getByRole('heading', { name: 'Nou punt' })).toBeInTheDocument();

    await user.type(screen.getByLabelText('Identificador (slug)'), PUNT.slug);
    await user.type(screen.getByLabelText('Nom'), PUNT.nom);
    await user.type(screen.getByLabelText('Municipi'), PUNT.municipi);
    await user.type(screen.getByLabelText('Descripció'), PUNT.descripcio);
    await user.type(screen.getByLabelText('Latitud'), String(PUNT.lat));
    await user.type(screen.getByLabelText('Longitud'), String(PUNT.lon));
    await user.click(screen.getByRole('button', { name: 'Crea el punt' }));

    expect(await screen.findByText('Punt creat correctament.')).toBeInTheDocument();
    expect(await screen.findByRole('row', { name: /Mirador del Montsec/ })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Edita Mirador del Montsec' }));
    expect(await screen.findByRole('heading', { name: 'Edita el punt' })).toBeInTheDocument();
    await user.clear(screen.getByLabelText('Nom'));
    await user.type(screen.getByLabelText('Nom'), 'Observatori del Montsec');
    await user.click(screen.getByRole('button', { name: 'Desa els canvis' }));

    expect(await screen.findByText('Canvis desats correctament.')).toBeInTheDocument();
    expect(await screen.findByRole('row', { name: /Observatori del Montsec/ })).toBeInTheDocument();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(6));
  });

  it('torna a la llista sense canviar el punt si es cancel·la l’edició', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      return String(input) === '/api/v1/admin/punts' ? response([PUNT]) : response(PUNT);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <AdminWorkspace accessToken={TOKEN} currentUserId="admin-auth-id" onAccessDenied={vi.fn()} />,
    );

    await user.click(await screen.findByRole('button', { name: 'Edita Mirador del Montsec' }));
    expect(await screen.findByRole('heading', { name: 'Edita el punt' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel·la' }));

    expect(await screen.findByRole('row', { name: /Mirador del Montsec/ })).toHaveTextContent(
      'Publicat',
    );
    expect(screen.queryByRole('heading', { name: 'Edita el punt' })).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
