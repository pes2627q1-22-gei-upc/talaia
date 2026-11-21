import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { PuntAdmin } from '@talaia/shared';

import { PuntsList } from '../PuntsList';

const PUNTS: PuntAdmin[] = [
  {
    id: '7d3f2c1a-5b4e-4f6a-9c8d-1e2f3a4b5c6d',
    slug: 'mirador-del-montsec',
    nom: 'Mirador del Montsec',
    municipi: 'Àger',
    descripcio: 'Parc Astronòmic del Montsec.',
    altitud: 817,
    horitzoObert: ['S', 'SW'],
    accessibilitat: null,
    sqm: null,
    estat: 'PUBLICAT',
    origen: 'OFICIAL',
    dataCreacio: '2026-10-12T10:00:00.000Z',
    dataActualitzacio: '2026-10-12T10:00:00.000Z',
    lat: 42.0244,
    lon: 0.7364,
  },
  {
    id: '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d',
    slug: 'parc-de-collserola',
    nom: 'Parc de Collserola',
    municipi: 'Barcelona',
    descripcio: 'Espai natural de Collserola.',
    altitud: null,
    horitzoObert: null,
    accessibilitat: null,
    sqm: null,
    estat: 'DESACTIVAT',
    origen: 'COMUNITAT',
    dataCreacio: '2026-10-12T10:00:00.000Z',
    dataActualitzacio: '2026-10-12T10:00:00.000Z',
    lat: 41.4,
    lon: 2.1,
  },
];

describe('Llista de punts', () => {
  it('mostra les dades, el filtre, la cerca i les accions de crear i editar', async () => {
    const user = userEvent.setup();
    const fetch = vi.fn(
      async () =>
        new Response(JSON.stringify(PUNTS), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    );
    vi.stubGlobal('fetch', fetch);
    const onCreate = vi.fn();
    const onEdit = vi.fn();

    render(
      <PuntsList
        accessToken="token-admin"
        onAccessDenied={vi.fn()}
        onCreate={onCreate}
        onEdit={onEdit}
      />,
    );

    expect(await screen.findByRole('columnheader', { name: 'Nom' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Municipi' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Estat' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Origen' })).toBeInTheDocument();
    expect(screen.getByLabelText('Cerca per nom o municipi')).toBeInTheDocument();
    expect(screen.getByLabelText('Filtra per estat')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nou punt' })).toBeInTheDocument();
    expect(screen.getByText('Àger')).toBeInTheDocument();
    expect(screen.getByRole('row', { name: /Mirador del Montsec/ })).toHaveTextContent('Publicat');
    expect(screen.getByText('Oficial')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Nou punt' }));
    expect(onCreate).toHaveBeenCalledOnce();
    await user.click(screen.getByRole('button', { name: 'Edita Mirador del Montsec' }));
    expect(onEdit).toHaveBeenCalledWith(PUNTS[0]!.id);
  });

  it('cerca també pel municipi i filtra pels estats', async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify(PUNTS), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
      ),
    );

    render(
      <PuntsList
        accessToken="token-admin"
        onAccessDenied={vi.fn()}
        onCreate={vi.fn()}
        onEdit={vi.fn()}
      />,
    );

    await screen.findByText('Parc de Collserola');
    await user.selectOptions(screen.getByLabelText('Filtra per estat'), 'DESACTIVAT');
    expect(screen.getByText('Parc de Collserola')).toBeInTheDocument();
    expect(screen.queryByText('Mirador del Montsec')).not.toBeInTheDocument();

    await user.type(screen.getByLabelText('Cerca per nom o municipi'), 'Àger');
    expect(screen.getByRole('status')).toHaveTextContent('No s’han trobat punts');
  });
});
