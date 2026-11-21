import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('Llista de punts', () => {
  it('permet reintentar la càrrega quan falla la petició', async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('Connexió interrompuda'))
      .mockResolvedValueOnce(response(PUNTS));
    vi.stubGlobal('fetch', fetchMock);

    render(
      <PuntsList
        accessToken="token-admin"
        onAccessDenied={vi.fn()}
        onCreate={vi.fn()}
        onEdit={vi.fn()}
      />,
    );

    expect(await screen.findByRole('alert')).toHaveTextContent('No s’ha pogut carregar la llista');
    await user.click(screen.getByRole('button', { name: 'Torna-ho a provar' }));
    expect(await screen.findByText('Mirador del Montsec')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('retorna a la pantalla d’inici quan la càrrega no està autoritzada', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => response({ error: { code: 'forbidden', message: 'Accés denegat' } }, 403)),
    );
    const onAccessDenied = vi.fn();

    render(
      <PuntsList
        accessToken="token-admin"
        onAccessDenied={onAccessDenied}
        onCreate={vi.fn()}
        onEdit={vi.fn()}
      />,
    );

    await waitFor(() => expect(onAccessDenied).toHaveBeenCalledOnce());
  });

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

  it('cerca sense distingir accents i conserva la llista en canviar el token', async () => {
    const user = userEvent.setup();
    const point = { ...PUNTS[0]!, municipi: 'Sant Llorenç' };
    const fetch = vi.fn(async () => response([point]));
    vi.stubGlobal('fetch', fetch);
    const props = {
      onAccessDenied: vi.fn(),
      onCreate: vi.fn(),
      onEdit: vi.fn(),
    };
    const { rerender } = render(<PuntsList {...props} accessToken="token-admin" />);

    await screen.findByText('Sant Llorenç');
    await user.type(screen.getByLabelText('Cerca per nom o municipi'), 'llorenc');
    expect(screen.getByText('Sant Llorenç')).toBeInTheDocument();

    rerender(<PuntsList {...props} accessToken="token-renovat" />);

    expect(screen.getByText('Sant Llorenç')).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledOnce();
  });

  it('demana confirmació en retirar i actualitza l’estat quan respon l’API', async () => {
    const user = userEvent.setup();
    const updatedPoint = { ...PUNTS[0]!, estat: 'DESACTIVAT' as const };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(PUNTS))
      .mockResolvedValueOnce(response(updatedPoint));
    vi.stubGlobal('fetch', fetchMock);

    render(
      <PuntsList
        accessToken="token-admin"
        onAccessDenied={vi.fn()}
        onCreate={vi.fn()}
        onEdit={vi.fn()}
      />,
    );

    await user.click(await screen.findByRole('button', { name: 'Retira Mirador del Montsec' }));
    expect(screen.getByRole('alertdialog')).toHaveTextContent('Mirador del Montsec');
    expect(screen.getByRole('alertdialog')).toHaveTextContent('Deixarà d’aparèixer a l’aplicació');

    await user.click(screen.getByRole('button', { name: 'Confirma la retirada' }));

    expect(
      await screen.findByText('Mirador del Montsec s’ha retirat i ja no apareix a l’aplicació.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('row', { name: /Mirador del Montsec/ })).toHaveTextContent(
      'Desactivat',
    );
    expect(
      screen.getByRole('button', { name: 'Torna a publicar Mirador del Montsec' }),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenLastCalledWith(
      `/api/v1/admin/punts/${PUNTS[0]!.id}`,
      expect.objectContaining({ method: 'PATCH', body: '{"estat":"DESACTIVAT"}' }),
    );
  });

  it('permet cancel·lar la retirada sense enviar una petició de canvi', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async () => response(PUNTS));
    vi.stubGlobal('fetch', fetchMock);

    render(
      <PuntsList
        accessToken="token-admin"
        onAccessDenied={vi.fn()}
        onCreate={vi.fn()}
        onEdit={vi.fn()}
      />,
    );

    await user.click(await screen.findByRole('button', { name: 'Retira Mirador del Montsec' }));
    await user.click(screen.getByRole('button', { name: 'Cancel·la' }));

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('manté el focus dins del diàleg i permet tancar-lo amb Escape', async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => response(PUNTS)),
    );

    render(
      <PuntsList
        accessToken="token-admin"
        onAccessDenied={vi.fn()}
        onCreate={vi.fn()}
        onEdit={vi.fn()}
      />,
    );

    await user.click(await screen.findByRole('button', { name: 'Retira Mirador del Montsec' }));
    const cancelButton = screen.getByRole('button', { name: 'Cancel·la' });
    const confirmButton = screen.getByRole('button', { name: 'Confirma la retirada' });
    expect(cancelButton).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(confirmButton).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(cancelButton).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('desactiva les accions mentre espera la resposta de l’API', async () => {
    const user = userEvent.setup();
    const updatedPoint = { ...PUNTS[0]!, estat: 'DESACTIVAT' as const };
    let resolvePatch: (value: Response) => void = () => undefined;
    const pendingResponse = new Promise<Response>((resolve) => {
      resolvePatch = resolve;
    });
    const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) =>
      init?.method === 'PATCH' ? pendingResponse : Promise.resolve(response(PUNTS)),
    );
    vi.stubGlobal('fetch', fetchMock);

    render(
      <PuntsList
        accessToken="token-admin"
        onAccessDenied={vi.fn()}
        onCreate={vi.fn()}
        onEdit={vi.fn()}
      />,
    );

    await user.click(await screen.findByRole('button', { name: 'Retira Mirador del Montsec' }));
    await user.click(screen.getByRole('button', { name: 'Confirma la retirada' }));

    expect(screen.getByRole('button', { name: 'Retirant…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel·la' })).toBeDisabled();
    expect(fetchMock).toHaveBeenCalledTimes(2);

    resolvePatch(response(updatedPoint));
    expect(
      await screen.findByText('Mirador del Montsec s’ha retirat i ja no apareix a l’aplicació.'),
    ).toBeInTheDocument();
  });

  it('torna a publicar directament, sense obrir un diàleg de confirmació', async () => {
    const user = userEvent.setup();
    const updatedPoint = { ...PUNTS[1]!, estat: 'PUBLICAT' as const };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(PUNTS))
      .mockResolvedValueOnce(response(updatedPoint));
    vi.stubGlobal('fetch', fetchMock);

    render(
      <PuntsList
        accessToken="token-admin"
        onAccessDenied={vi.fn()}
        onCreate={vi.fn()}
        onEdit={vi.fn()}
      />,
    );

    await user.click(
      await screen.findByRole('button', { name: 'Torna a publicar Parc de Collserola' }),
    );

    expect(
      await screen.findByText('Parc de Collserola s’ha tornat a publicar.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByRole('row', { name: /Parc de Collserola/ })).toHaveTextContent('Publicat');
    expect(fetchMock).toHaveBeenLastCalledWith(
      `/api/v1/admin/punts/${PUNTS[1]!.id}`,
      expect.objectContaining({ method: 'PATCH', body: '{"estat":"PUBLICAT"}' }),
    );
  });

  it('manté el punt desactivat i explica un error de l’API en tornar-lo a publicar', async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(PUNTS))
      .mockResolvedValueOnce(
        response(
          {
            error: { code: 'temporarily_unavailable', message: 'Servei temporalment indisponible' },
          },
          503,
        ),
      );
    vi.stubGlobal('fetch', fetchMock);

    render(
      <PuntsList
        accessToken="token-admin"
        onAccessDenied={vi.fn()}
        onCreate={vi.fn()}
        onEdit={vi.fn()}
      />,
    );

    await user.click(
      await screen.findByRole('button', { name: 'Torna a publicar Parc de Collserola' }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No s’ha pogut tornar a publicar Parc de Collserola. Servei temporalment indisponible',
    );
    expect(screen.getByRole('row', { name: /Parc de Collserola/ })).toHaveTextContent('Desactivat');
  });

  it('no ofereix retirar el punt de referència d’Aprop', async () => {
    const referencePoint = {
      ...PUNTS[0]!,
      id: '5f4e3d2c-1b0a-4987-9c6d-5e4f3a2b1c0d',
      slug: 'centre-observacio-univers',
      nom: 'Centre d’Observació de l’Univers',
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => response([referencePoint])),
    );

    render(
      <PuntsList
        accessToken="token-admin"
        onAccessDenied={vi.fn()}
        onCreate={vi.fn()}
        onEdit={vi.fn()}
      />,
    );

    expect(
      await screen.findByRole('row', { name: /Centre d’Observació de l’Univers/ }),
    ).toHaveTextContent('Publicat');
    expect(
      screen.queryByRole('button', { name: 'Retira Centre d’Observació de l’Univers' }),
    ).not.toBeInTheDocument();
  });

  it("conserva l'estat si l’API rebutja la retirada i n’explica el motiu", async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(PUNTS))
      .mockResolvedValueOnce(
        response(
          {
            error: {
              code: 'reference_point_required',
              message: 'Aquest punt no es pot retirar',
            },
          },
          409,
        ),
      );
    vi.stubGlobal('fetch', fetchMock);

    render(
      <PuntsList
        accessToken="token-admin"
        onAccessDenied={vi.fn()}
        onCreate={vi.fn()}
        onEdit={vi.fn()}
      />,
    );

    await user.click(await screen.findByRole('button', { name: 'Retira Mirador del Montsec' }));
    await user.click(screen.getByRole('button', { name: 'Confirma la retirada' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Aquest és el punt de referència del calendari d’Aprop i no es pot retirar.',
    );
    expect(screen.getByRole('row', { name: /Mirador del Montsec/ })).toHaveTextContent('Publicat');
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });

  it('explica que els punts pendents o rebutjats només es canvien des de moderació', async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(PUNTS))
      .mockResolvedValueOnce(
        response(
          {
            error: {
              code: 'moderation_required',
              message: 'Cal fer servir la moderació',
            },
          },
          409,
        ),
      );
    vi.stubGlobal('fetch', fetchMock);

    render(
      <PuntsList
        accessToken="token-admin"
        onAccessDenied={vi.fn()}
        onCreate={vi.fn()}
        onEdit={vi.fn()}
      />,
    );

    await user.click(await screen.findByRole('button', { name: 'Retira Mirador del Montsec' }));
    await user.click(screen.getByRole('button', { name: 'Confirma la retirada' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Aquest punt és pendent o rebutjat; el seu estat només es pot canviar des de moderació.',
    );
    expect(screen.getByRole('row', { name: /Mirador del Montsec/ })).toHaveTextContent('Publicat');
  });
});
