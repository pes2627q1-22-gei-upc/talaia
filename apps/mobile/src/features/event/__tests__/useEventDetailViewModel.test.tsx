import type { Esdeveniment } from '@talaia/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import type { PropsWithChildren } from 'react';

import { ApiError, apiGet } from '@/core/api/httpClient';
import i18n from '@/core/i18n';

import { useEventDetailViewModel } from '../useEventDetailViewModel';

jest.mock('@/core/api/httpClient', () => ({
  ...jest.requireActual('@/core/api/httpClient'),
  apiGet: jest.fn(),
}));
jest.mock('expo-router', () => ({
  router: { canGoBack: jest.fn(() => true), back: jest.fn(), replace: jest.fn() },
}));
const get = jest.mocked(apiGet);

const orionids: Esdeveniment = {
  id: 'orionids-2026',
  tipus: 'pluja_estels',
  nom: 'Oriònids',
  inici: '2026-10-02T00:00:00Z',
  fi: '2026-11-07T23:59:59Z',
  maxim: '2026-10-21T12:00:00Z',
  descripcio: 'Pluja anual de meteors ràpids associada al cometa Halley.',
  ubicacio: { nom: "Centre d'Observació de l'Univers", latitud: 41.95, longitud: 1.3 },
  font: 'IMO',
};

function renderVm(id: string, calendar: Esdeveniment[] = []) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  // Com si el calendari ja hagués baixat el mes.
  if (calendar.length) client.setQueryData(['calendar', 2026, 9], { data: calendar });
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(() => useEventDetailViewModel(id), { wrapper });
}

beforeEach(async () => {
  get.mockReset();
  await i18n.changeLanguage('ca');
});

it('obre a l’instant l’esdeveniment que ja ha baixat el calendari', async () => {
  const { result } = await renderVm('orionids-2026', [orionids]);
  expect(result.current).toMatchObject({
    status: 'ok',
    headerTitle: 'Esdeveniment',
    name: 'Oriònids',
    typeLabel: "Pluja d'estels",
    dateLabel: "Nit del 21 al 22 d'octubre",
    whenTitle: 'Quan',
    when: "Activa del 2 d'octubre al 7 de novembre. El màxim és la nit del 21 al 22 d'octubre.",
    descriptionTitle: 'Què veuràs',
    description: orionids.descripcio,
    source: 'Font: IMO',
    meteors: true,
  });
  expect(get).not.toHaveBeenCalled();
});

it('si no és al calendari, demana la fitxa a l’API', async () => {
  const nova: Esdeveniment = {
    ...orionids,
    id: 'lluna-nova-2026-11-09',
    tipus: 'fase_llunar',
    nom: 'Lluna nova',
    inici: '2026-11-08T23:00:00Z',
    fi: '2026-11-09T22:59:59Z',
    maxim: '2026-11-09T07:02:12Z',
    font: 'Astronomy Engine 2.1.19',
  };
  get.mockResolvedValue(nova);
  const { result } = await renderVm('lluna-nova-2026-11-09');
  await waitFor(() => expect(result.current.status).toBe('ok'));
  expect(get).toHaveBeenCalledWith('/esdeveniments/lluna-nova-2026-11-09', undefined, {
    signal: expect.any(AbortSignal),
  });
  expect(result.current).toMatchObject({
    typeLabel: 'Fase lunar',
    dateLabel: 'Dilluns, 9 de novembre',
    when: 'El moment exacte és a les 08:02.',
    meteors: false,
  });
});

it('apostrofa l’1 i l’11 i diu «a la» per a la una', async () => {
  const taurids = {
    ...orionids,
    id: 'taurids',
    inici: '2026-11-01T00:00:00Z',
    fi: '2026-12-11T23:59:59Z',
    maxim: '2026-11-01T02:00:00Z',
  };
  const eclipsi: Esdeveniment = {
    ...orionids,
    id: 'eclipsi',
    tipus: 'eclipsi_llunar',
    inici: '2027-02-20T21:12:00Z',
    fi: '2027-02-21T01:13:00Z',
    maxim: '2027-02-21T00:13:00Z',
  };
  const { result } = await renderVm('taurids', [taurids, eclipsi]);
  expect(result.current).toMatchObject({
    dateLabel: "Nit del 31 d'octubre a l'1 de novembre",
    when: "Activa de l'1 de novembre a l'11 de desembre. El màxim és la nit del 31 d'octubre a l'1 de novembre.",
  });
  const { result: window } = await renderVm('eclipsi', [eclipsi]);
  expect(window.current).toMatchObject({
    dateLabel: 'Nit del 20 al 21 de febrer',
    when: 'De les 22:12 a les 02:13, amb el màxim a la 01:13.',
  });
});

it('també en castellà i en anglès', async () => {
  const { result } = await renderVm('orionids-2026', [orionids]);
  await act(() => i18n.changeLanguage('es'));
  expect(result.current).toMatchObject({
    headerTitle: 'Evento',
    typeLabel: 'Lluvia de estrellas',
    dateLabel: 'Noche del 21 al 22 de octubre',
    when: 'Activa del 2 de octubre al 7 de noviembre. El máximo es la noche del 21 al 22 de octubre.',
  });
  await act(() => i18n.changeLanguage('en'));
  expect(result.current).toMatchObject({
    headerTitle: 'Event',
    typeLabel: 'Meteor shower',
    dateLabel: 'Night of 21 to 22 October',
    when: 'Active from 2 October to 7 November. It peaks on the night of 21 to 22 October.',
  });
});

it('diu que l’esdeveniment no existeix, sense «torna-ho a provar»', async () => {
  get.mockRejectedValue(new ApiError(404, 'not_found', 'No existeix'));
  const { result } = await renderVm('no-hi-es');
  await waitFor(() => expect(result.current.status).toBe('notFound'));
  expect(result.current).toMatchObject({ errorTitle: 'No hem trobat aquest esdeveniment' });
});

it('si falla la xarxa, es pot tornar a provar', async () => {
  get.mockRejectedValueOnce(new ApiError(503, 'service_unavailable', 'Caigut'));
  const { result } = await renderVm('orionids-2026');
  await waitFor(() => expect(result.current.status).toBe('error'));
  get.mockResolvedValueOnce(orionids);
  await act(async () => {
    if (result.current.status === 'error') result.current.retry();
  });
  await waitFor(() => expect(result.current.status).toBe('ok'));
});

it('torna al calendari, també si s’hi ha arribat per un enllaç', async () => {
  const { result } = await renderVm('orionids-2026', [orionids]);
  result.current.back();
  expect(router.back).toHaveBeenCalled();
  jest.mocked(router.canGoBack).mockReturnValueOnce(false);
  result.current.back();
  expect(router.replace).toHaveBeenCalledWith('/calendari');
});
