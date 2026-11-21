import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { PuntAdmin } from '@talaia/shared';

import { PuntForm } from '../PuntForm';

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
  sqm: 21.56,
  estat: 'PUBLICAT',
  origen: 'OFICIAL',
  dataCreacio: '2026-10-12T10:00:00.000Z',
  dataActualitzacio: '2026-10-12T10:00:00.000Z',
  lat: 42.0244,
  lon: 0.7364,
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('Formulari de punts', () => {
  it('mostra els camps, les vuit direccions, l’estat inicial i les accions de creació', () => {
    render(
      <PuntForm
        accessToken={TOKEN}
        onCancel={vi.fn()}
        onSaved={vi.fn()}
        onAccessDenied={vi.fn()}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Nou punt' })).toBeInTheDocument();
    expect(screen.getByLabelText('Identificador (slug)')).toBeInTheDocument();
    expect(screen.getByLabelText('Nom')).toBeInTheDocument();
    expect(screen.getByLabelText('Municipi')).toBeInTheDocument();
    expect(screen.getByLabelText('Descripció')).toBeInTheDocument();
    expect(screen.getByLabelText('Latitud')).toBeInTheDocument();
    expect(screen.getByLabelText('Longitud')).toBeInTheDocument();
    expect(screen.getByLabelText('Estat inicial')).toHaveValue('PUBLICAT');
    expect(screen.getByRole('option', { name: 'Desactivat' })).toBeInTheDocument();
    expect(screen.getAllByRole('checkbox')).toHaveLength(8);
    expect(screen.getByRole('button', { name: 'Crea el punt' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel·la' })).toBeInTheDocument();
  });

  it('carrega l’edició i envia un PATCH parcial amb les dues coordenades, sense el SQM antic', async () => {
    const user = userEvent.setup();
    const fetch = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
      if (String(input) === `/api/v1/admin/punts/${PUNT.id}`) return jsonResponse(PUNT, 200);
      return jsonResponse({ ...PUNT, nom: 'Observatori del Montsec', lat: 42.03 }, 200);
    });
    vi.stubGlobal('fetch', fetch);
    const onSaved = vi.fn();

    render(
      <PuntForm
        accessToken={TOKEN}
        puntId={PUNT.id}
        onCancel={vi.fn()}
        onSaved={onSaved}
        onAccessDenied={vi.fn()}
      />,
    );

    expect(await screen.findByRole('heading', { name: 'Edita el punt' })).toBeInTheDocument();
    expect(screen.getByLabelText('Identificador (slug)')).toHaveValue(PUNT.slug);
    expect(screen.getByLabelText('Identificador (slug)')).toHaveAttribute('readonly');
    expect(screen.queryByLabelText('Estat inicial')).not.toBeInTheDocument();

    await user.clear(screen.getByLabelText('Nom'));
    await user.type(screen.getByLabelText('Nom'), 'Observatori del Montsec');
    await user.clear(screen.getByLabelText('Latitud'));
    await user.type(screen.getByLabelText('Latitud'), '42.03');
    await user.click(screen.getByRole('button', { name: 'Desa els canvis' }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith('updated'));
    expect(fetch).toHaveBeenCalledTimes(2);
    const [url, init] = fetch.mock.calls[1]!;
    expect(url).toBe(`/api/v1/admin/punts/${PUNT.id}`);
    expect(init?.method).toBe('PATCH');
    expect(new Headers(init?.headers).get('Authorization')).toBe(`Bearer ${TOKEN}`);
    expect(JSON.parse(String(init?.body))).toEqual({
      nom: 'Observatori del Montsec',
      lat: 42.03,
      lon: PUNT.lon,
    });
  });

  it('conserva els canvis i no torna a carregar el punt quan es renova el token', async () => {
    const user = userEvent.setup();
    const fetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) =>
      jsonResponse(init?.method === 'PATCH' ? { ...PUNT, nom: 'Observatori del Montsec' } : PUNT),
    );
    vi.stubGlobal('fetch', fetch);
    const props = {
      puntId: PUNT.id,
      onCancel: vi.fn(),
      onSaved: vi.fn(),
      onAccessDenied: vi.fn(),
    };
    const { rerender } = render(<PuntForm {...props} accessToken={TOKEN} />);

    expect(await screen.findByLabelText('Nom')).toHaveValue(PUNT.nom);
    await user.clear(screen.getByLabelText('Nom'));
    await user.type(screen.getByLabelText('Nom'), 'Observatori del Montsec');

    rerender(<PuntForm {...props} accessToken="token-renovat" />);

    expect(screen.getByLabelText('Nom')).toHaveValue('Observatori del Montsec');
    expect(fetch).toHaveBeenCalledOnce();
    await user.click(screen.getByRole('button', { name: 'Desa els canvis' }));

    await waitFor(() => expect(props.onSaved).toHaveBeenCalledWith('updated'));
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(new Headers(fetch.mock.calls[1]?.[1]?.headers).get('Authorization')).toBe(
      'Bearer token-renovat',
    );
  });

  it('permet editar les dades complementàries i crear el punt desactivat', async () => {
    const user = userEvent.setup();
    const fetch = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse(PUNT, 201),
    );
    vi.stubGlobal('fetch', fetch);
    const onSaved = vi.fn();

    render(
      <PuntForm
        accessToken={TOKEN}
        onCancel={vi.fn()}
        onSaved={onSaved}
        onAccessDenied={vi.fn()}
      />,
    );

    await user.type(screen.getByLabelText('Identificador (slug)'), 'mirador-prova');
    await user.type(screen.getByLabelText('Nom'), 'Mirador de prova');
    await user.type(screen.getByLabelText('Municipi'), 'Àger');
    await user.type(screen.getByLabelText('Descripció'), 'Punt de prova.');
    await user.type(screen.getByLabelText('Latitud'), '41.8');
    await user.type(screen.getByLabelText('Longitud'), '1.1');
    await user.type(screen.getByLabelText('Altitud (metres, opcional)'), '850');
    await user.click(screen.getByLabelText('N'));
    await user.click(screen.getByLabelText('N'));
    await user.click(screen.getByLabelText('SW'));
    await user.type(screen.getByLabelText('Accessibilitat (opcional)'), 'Accés a peu.');
    await user.type(screen.getByLabelText('Foscor del cel SQM (10–23, opcional)'), '21.5');
    await user.selectOptions(screen.getByLabelText('Estat inicial'), 'DESACTIVAT');
    await user.click(screen.getByRole('button', { name: 'Crea el punt' }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith('created'));
    expect(JSON.parse(String(fetch.mock.calls[0]?.[1]?.body))).toMatchObject({
      slug: 'mirador-prova',
      altitud: 850,
      horitzoObert: ['SW'],
      accessibilitat: 'Accés a peu.',
      sqm: 21.5,
      estat: 'DESACTIVAT',
    });
  });

  it('mostra errors de càrrega amb opció de reintent i acaba mostrant les dades', async () => {
    const user = userEvent.setup();
    const fetch = vi
      .fn((_input: RequestInfo | URL) => Promise.resolve(jsonResponse(PUNT)))
      .mockResolvedValueOnce(
        jsonResponse(
          { error: { code: 'unavailable', message: 'Servei temporalment indisponible' } },
          503,
        ),
      )
      .mockResolvedValueOnce(jsonResponse(PUNT));
    vi.stubGlobal('fetch', fetch);

    render(
      <PuntForm
        accessToken={TOKEN}
        puntId={PUNT.id}
        onCancel={vi.fn()}
        onSaved={vi.fn()}
        onAccessDenied={vi.fn()}
      />,
    );

    expect(await screen.findByRole('alert')).toHaveTextContent('Servei temporalment indisponible');
    await user.click(screen.getByRole('button', { name: 'Torna-ho a provar' }));
    expect(await screen.findByLabelText('Nom')).toHaveValue(PUNT.nom);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('informa quan no hi ha canvis i quan l’estat pendent es gestiona des de moderació', async () => {
    const user = userEvent.setup();
    const pendingPoint = { ...PUNT, estat: 'PENDENT' as const };
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: RequestInfo | URL) => jsonResponse(pendingPoint)),
    );

    render(
      <PuntForm
        accessToken={TOKEN}
        puntId={PUNT.id}
        onCancel={vi.fn()}
        onSaved={vi.fn()}
        onAccessDenied={vi.fn()}
      />,
    );

    expect(await screen.findByText(/només es pot canviar des de la moderació/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Desa els canvis' }));
    expect(await screen.findByRole('status')).toHaveTextContent('No hi ha canvis per desar.');
  });

  it('informa si el token deixa de tenir accés mentre es desa', async () => {
    const user = userEvent.setup();
    const fetch = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse({ error: { code: 'unauthorized', message: 'Accés denegat' } }, 403),
    );
    vi.stubGlobal('fetch', fetch);
    const onAccessDenied = vi.fn();

    render(
      <PuntForm
        accessToken={TOKEN}
        onCancel={vi.fn()}
        onSaved={vi.fn()}
        onAccessDenied={onAccessDenied}
      />,
    );

    await user.type(screen.getByLabelText('Identificador (slug)'), 'mirador-prova');
    await user.type(screen.getByLabelText('Nom'), 'Mirador de prova');
    await user.type(screen.getByLabelText('Municipi'), 'Àger');
    await user.type(screen.getByLabelText('Descripció'), 'Punt de prova.');
    await user.type(screen.getByLabelText('Latitud'), '41.8');
    await user.type(screen.getByLabelText('Longitud'), '1.1');
    await user.click(screen.getByRole('button', { name: 'Crea el punt' }));

    await waitFor(() => expect(onAccessDenied).toHaveBeenCalledOnce());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('crea un punt amb els camps obligatoris i conserva el text si l’API rebutja l’identificador', async () => {
    const user = userEvent.setup();
    const fetch = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      jsonResponse(
        { error: { code: 'slug_already_exists', message: 'Ja hi ha un punt amb aquest slug' } },
        409,
      ),
    );
    vi.stubGlobal('fetch', fetch);

    render(
      <PuntForm
        accessToken={TOKEN}
        onCancel={vi.fn()}
        onSaved={vi.fn()}
        onAccessDenied={vi.fn()}
      />,
    );

    await user.type(screen.getByLabelText('Identificador (slug)'), 'mirador-prova');
    await user.type(screen.getByLabelText('Nom'), 'Mirador de prova');
    await user.type(screen.getByLabelText('Municipi'), 'Àger');
    await user.type(screen.getByLabelText('Descripció'), 'Punt de prova.');
    await user.type(screen.getByLabelText('Latitud'), '41.8');
    await user.type(screen.getByLabelText('Longitud'), '1.1');
    await user.click(screen.getByRole('button', { name: 'Crea el punt' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Ja existeix un punt amb aquest identificador.',
    );
    expect(screen.getByLabelText('Nom')).toHaveValue('Mirador de prova');
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0]?.[1]?.method).toBe('POST');
    expect(JSON.parse(String(fetch.mock.calls[0]?.[1]?.body))).toMatchObject({
      slug: 'mirador-prova',
      nom: 'Mirador de prova',
      estat: 'PUBLICAT',
    });
  });
});
