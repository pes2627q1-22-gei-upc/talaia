import type { Esdeveniment, EsdevenimentDetall } from '@talaia/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import type { PropsWithChildren } from 'react';

import { ApiError, apiGet } from '@/core/api/httpClient';
import i18n from '@/core/i18n';

import type { Precision } from '../eventModel';
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
  descripcio:
    'Pluja anual de meteors ràpids associada al cometa Halley. El radiant és visible des de Catalunya.',
  ubicacio: { nom: "Centre d'Observació de l'Univers", latitud: 41.95, longitud: 1.3 },
  font: 'IMO',
};

const explicacio: EsdevenimentDetall['explicacio'] = {
  fenomen: 'Pluja anual de meteors ràpids associada al cometa Halley.',
  particularitat: 'El radiant és visible des de Catalunya.',
  observacioGeneral: 'Busqueu un cel fosc durant la segona meitat de la nit.',
  observacioEsdeveniment: "Observeu durant la matinada del 21 d'octubre.",
};

/** El que respon `GET /esdeveniments/{id}` (TG-138). */
function detail(event: Esdeveniment, precisio: Precision): EsdevenimentDetall {
  const { inici, maxim, fi } = event;
  return { ...event, horari: { inici, maxim, fi, precisio }, explicacio };
}
const perDies: Precision = { inici: 'dia', maxim: 'dia', fi: 'dia' };

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

const request = (id: string, language: string) => [
  `/esdeveniments/${id}`,
  undefined,
  { signal: expect.any(AbortSignal), headers: { 'Accept-Language': language } },
];

beforeEach(async () => {
  get.mockReset();
  // Per defecte, el detall encara no ha arribat.
  get.mockReturnValue(new Promise(() => {}));
  await i18n.changeLanguage('ca');
});

it('s’obre a l’instant amb el calendari i el detall de l’API la completa', async () => {
  let arrive!: (value: EsdevenimentDetall) => void;
  get.mockReturnValue(new Promise((resolve) => (arrive = resolve)));
  const { result } = await renderVm('orionids-2026', [orionids]);
  expect(result.current).toMatchObject({
    status: 'ok',
    headerTitle: 'Esdeveniment',
    name: 'Oriònids',
    typeLabel: "Pluja d'estels",
    dateLabel: "Dimecres, 21 d'octubre",
    whenTitle: 'Quan',
    when: "Activa del 2 d'octubre al 7 de novembre. El màxim és el 21 d'octubre.",
    descriptionTitle: 'Què veuràs',
    description: orionids.descripcio,
    particularity: null,
    howToWatch: null,
    source: 'Font: IMO',
    meteors: true,
  });
  expect(get).toHaveBeenCalledWith(...request('orionids-2026', 'ca'));

  arrive(detail(orionids, perDies));
  await waitFor(() =>
    expect(result.current).toMatchObject({
      status: 'ok',
      description: explicacio.fenomen,
      particularityTitle: 'Aquesta vegada',
      particularity: explicacio.particularitat,
      howToWatchTitle: 'Com observar-ho',
      howToWatch: `${explicacio.observacioEsdeveniment} ${explicacio.observacioGeneral}`,
    }),
  );
});

it('una pluja amb el màxim publicat al minut en dona el dia i l’hora de Catalunya', async () => {
  const leonids = {
    ...orionids,
    id: 'leonids-2026',
    inici: '2026-11-06T00:00:00Z',
    fi: '2026-11-30T23:59:59Z',
    maxim: '2026-11-17T23:45:00Z',
  };
  get.mockResolvedValue(detail(leonids, { ...perDies, maxim: 'minut' }));
  const { result } = await renderVm('leonids-2026');
  await waitFor(() => expect(result.current.status).toBe('ok'));
  expect(result.current).toMatchObject({
    dateLabel: 'Dimecres, 18 de novembre',
    when: 'Activa del 6 de novembre al 30 de novembre. El màxim és el 18 de novembre a les 00:45.',
  });
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
  get.mockResolvedValue(detail(nova, { ...perDies, maxim: 'segon' }));
  const { result } = await renderVm('lluna-nova-2026-11-09');
  await waitFor(() => expect(result.current.status).toBe('ok'));
  expect(get).toHaveBeenCalledWith(...request('lluna-nova-2026-11-09', 'ca'));
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
    dateLabel: 'Diumenge, 1 de novembre',
    when: "Activa de l'1 de novembre a l'11 de desembre. El màxim és l'1 de novembre a les 03:00.",
  });
  const { result: window } = await renderVm('eclipsi', [eclipsi]);
  expect(window.current).toMatchObject({
    dateLabel: 'Nit del 20 al 21 de febrer',
    when: 'De les 22:12 a les 02:13, amb el màxim a la 01:13.',
  });
});

it('també en castellà i en anglès, i demana el detall en aquest idioma', async () => {
  const { result } = await renderVm('orionids-2026', [orionids]);
  await act(() => i18n.changeLanguage('es'));
  expect(result.current).toMatchObject({
    headerTitle: 'Evento',
    typeLabel: 'Lluvia de estrellas',
    dateLabel: 'Miércoles, 21 de octubre',
    when: 'Activa del 2 de octubre al 7 de noviembre. El máximo es el 21 de octubre.',
  });
  expect(get).toHaveBeenLastCalledWith(...request('orionids-2026', 'es'));
  await act(() => i18n.changeLanguage('en'));
  expect(result.current).toMatchObject({
    headerTitle: 'Event',
    typeLabel: 'Meteor shower',
    dateLabel: 'Wednesday 21 October',
    when: 'Active from 2 October to 7 November. It peaks on 21 October.',
  });
  expect(get).toHaveBeenLastCalledWith(...request('orionids-2026', 'en'));
});

it('si el detall falla, es queda amb el que en sap el calendari', async () => {
  get.mockRejectedValue(new ApiError(503, 'service_unavailable', 'Caigut'));
  const { result } = await renderVm('orionids-2026', [orionids]);
  await waitFor(() => expect(get).toHaveBeenCalled());
  // TanStack Query notifica el canvi d'estat en un setTimeout.
  await act(() => new Promise((resolve) => setTimeout(resolve, 10)));
  expect(result.current).toMatchObject({ status: 'ok', description: orionids.descripcio });
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
  get.mockResolvedValueOnce(detail(orionids, perDies));
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
