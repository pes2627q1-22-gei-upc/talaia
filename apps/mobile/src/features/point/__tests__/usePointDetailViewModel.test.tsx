import { act, renderHook, waitFor } from '@testing-library/react-native';

import { ApiError, apiGet } from '@/core/api/httpClient';
import i18n from '@/core/i18n';
import { createQueryWrapper } from '@/test-utils/queryWrapper';

import {
  fetchPointBreakdown,
  fetchPointDetail,
  millisecondsUntilNextPointRefresh,
} from '../pointRepository';
import { skyDarknessBand } from '../skyDarkness';
import { usePointDetailViewModel } from '../usePointDetailViewModel';
import { asPointResponse, hour, point, respond } from '../__fixtures__/point';

jest.mock('@/core/api/httpClient', () => ({
  ...jest.requireActual('@/core/api/httpClient'),
  apiGet: jest.fn(),
}));
const get = jest.mocked(apiGet);
const renderVm = (id = 'montsec') =>
  renderHook(() => usePointDetailViewModel(id), { wrapper: createQueryWrapper() });

beforeEach(async () => {
  get.mockReset();
  // Per defecte, com l'API: la fitxa o el desglossament segons la ruta.
  get.mockImplementation(respond());
  await i18n.changeLanguage('ca');
});

it('codifica l’identificador i transmet el senyal de cancel·lació', async () => {
  get.mockResolvedValue(asPointResponse());
  const controller = new AbortController();
  expect(await fetchPointDetail('id/amb espais', controller.signal)).toEqual(point);
  expect(get).toHaveBeenCalledWith('/punts/id%2Famb%20espais', undefined, {
    signal: controller.signal,
  });
});

it('demana el desglossament d’aquesta nit del punt (TG-104)', async () => {
  get.mockImplementation(respond());
  const controller = new AbortController();
  await fetchPointBreakdown('id/amb espais', controller.signal);
  expect(get).toHaveBeenCalledWith('/punts/id%2Famb%20espais/index', undefined, {
    signal: controller.signal,
  });
});

it('mostra càrrega mentre espera la resposta', async () => {
  get.mockReturnValue(new Promise(() => undefined));
  const { result } = await renderVm();
  expect(result.current.status).toBe('loading');
});

it('ordena hores, respecta les franges del backend i converteix a l’hora de Catalunya', async () => {
  get.mockImplementation(respond());
  const { result } = await renderVm();
  await waitFor(() => expect(result.current.status).toBe('ok'));
  expect(result.current.title).toBe('Serra del Montsec');
  expect(result.current.hours.map((h) => h.label)).toEqual(['23', '00', '01']);
  expect(result.current.hours.map((h) => h.level)).toEqual(['ras', 'tap', 'ras']);
  expect(result.current.hours.map((h) => h.isBest)).toEqual([false, false, true]);
  expect(result.current.hours[2]?.accessibilityLabel).toContain('Dins del millor moment');
  expect(result.current.bestWindow?.to).toBe('02:00');
  // Per defecte, la millor hora de la nit, amb els factors de l'API ×100 (el Sol, ple, no surt).
  expect(result.current.defaultHourId).toBe('2026-10-18T23:00:00Z');
  expect(
    result.current.hours[2]?.factors.map((factor) => [factor.key, factor.value, factor.hint]),
  ).toEqual([
    ['nuvols', 95, 'Cel ras'],
    ['foscor', 94, 'Lluny de la contaminació lumínica'],
    ['lluna', 68, 'La Lluna aclareix el cel'],
  ]);
  expect(result.current.accessibility).toBe(point.accessibilitat);
  expect(result.current.skyDarkness).toBe('21,4 mag/arcsec²');
  expect(result.current.skyDarknessQuality).toBe('Cel molt fosc · qualitat excel·lent');
  expect(result.current.horizon).toBe('Cap al sud i al sud-oest');
});

it('no inventa índex ni altitud quan falten dades', async () => {
  get.mockResolvedValue({
    ...asPointResponse({
      ...point,
      altitud: null,
      accessibilitat: null,
      horitzoObert: null,
      indexActual: null,
      properesHores: [],
    }),
    sqm: null,
  });
  const { result } = await renderVm();
  await waitFor(() => expect(result.current.status).toBe('ok'));
  expect(result.current.currentIndex).toBeNull();
  expect(result.current.altitude).toBe('Sense dades');
  expect(result.current.horizon).toBeUndefined();
  expect(result.current.accessibility).toBeUndefined();
  expect(result.current.skyDarkness).toBeUndefined();
  expect(result.current.skyDarknessQuality).toBeUndefined();
  expect(result.current.hours).toEqual([]);
  expect(result.current.bestWindow).toBeUndefined();
});

it.each([
  [17.49, 'veryPoor'],
  [17.5, 'poor'],
  [18, 'low'],
  [19, 'moderate'],
  [20, 'good'],
  [21, 'veryGood'],
  [21.4, 'excellent'],
])('classifica %s mag/arcsec² com %s', (sqm, band) => {
  expect(skyDarknessBand(sqm)).toBe(band);
});

it('no proposa un millor moment si totes les hores tenen la franja tap', async () => {
  get.mockImplementation(
    respond(point, [
      { ...hour, hora: '2026-10-18T21:00:00Z', valor: 0, franja: 'tap' },
      { ...hour, hora: '2026-10-18T22:00:00Z', valor: 18, franja: 'tap' },
    ]),
  );
  const { result } = await renderVm();
  await waitFor(() => expect(result.current.hours).toHaveLength(2));
  expect(result.current.bestWindow).toBeUndefined();
  expect(result.current.hours.every((hour) => !hour.isBest)).toBe(true);
});

it('distingeix una altitud zero i una foscor estimada', async () => {
  get.mockImplementation(respond({ ...point, altitud: 0 }, [{ ...hour, foscorEstimada: true }]));
  const { result } = await renderVm();
  await waitFor(() => expect(result.current.hours).toHaveLength(1));
  expect(result.current.altitude).toBe('0 m');
  expect(
    result.current.hours[0]?.factors.find((factor) => factor.key === 'foscor')?.hint,
  ).toContain('estimat');
});

it('només ensenya les hores de nit, i el Sol només quan resta (crepuscle)', async () => {
  get.mockImplementation(
    respond(point, [
      // De dia el Sol anul·la l'índex: no és una hora de la nit.
      {
        ...hour,
        hora: '2026-10-18T16:00:00Z',
        valor: 0,
        franja: 'tap',
        factors: { ...hour.factors, sol: 0 },
      },
      {
        ...hour,
        hora: '2026-10-18T18:00:00Z',
        valor: 20,
        franja: 'tap',
        factors: { nuvols: 0.3, sol: 0.5, foscor: 0.5, lluna: 1 },
      },
      hour,
    ]),
  );
  const { result } = await renderVm();
  await waitFor(() => expect(result.current.hours).toHaveLength(2));
  expect(result.current.hours.map((h) => h.label)).toEqual(['20', '23']);
  expect(
    result.current.hours[0]?.factors.map((factor) => [factor.key, factor.value, factor.hint]),
  ).toEqual([
    ['nuvols', 30, 'Molt ennuvolat'],
    ['foscor', 50, 'Una mica de contaminació lumínica'],
    ['lluna', 100, 'La Lluna no molesta'],
    ['sol', 50, 'Encara queda llum del crepuscle'],
  ]);
});

it('si el desglossament falla, ho diu i el reintent el torna a demanar', async () => {
  get.mockImplementation(async (path: string) => {
    if (path.endsWith('/index')) throw new Error('offline');
    return asPointResponse();
  });
  const { result } = await renderVm();
  await waitFor(() => expect(result.current.hoursError).toBeDefined());
  expect(result.current.status).toBe('ok');
  get.mockImplementation(respond());
  await act(() => result.current.retry());
  await waitFor(() => expect(result.current.hours).toHaveLength(3));
  expect(result.current.hoursError).toBeUndefined();
});

it.each([400, 404])('tracta el %i com un punt inexistent', async (status) => {
  get.mockRejectedValue(new ApiError(status, 'punt_not_found', 'Not found'));
  const { result } = await renderVm();
  await waitFor(() => expect(result.current.status).toBe('notFound'));
  expect(result.current.errorTitle).toBe('No hem trobat aquest punt');
});

it.each([
  ['404', new ApiError(404, 'punt_not_found', 'Not found')],
  ['error de xarxa', new Error('offline')],
] as const)(
  'no torna a consultar cada minut una fitxa sense dades després de %s',
  async (_, error) => {
    jest.useFakeTimers();
    try {
      get.mockRejectedValue(error);
      const { result, unmount } = await renderVm();
      await waitFor(() => expect(['notFound', 'error']).toContain(result.current.status));
      // La fitxa i el desglossament, una vegada cadascun.
      expect(get).toHaveBeenCalledTimes(2);
      await act(async () => {
        await jest.advanceTimersByTimeAsync(60_000);
      });
      expect(get).toHaveBeenCalledTimes(2);
      await unmount();
    } finally {
      jest.useRealTimers();
    }
  },
);

it('no consulta l’endpoint amb un identificador buit', async () => {
  const { result } = await renderVm(' ');
  expect(result.current.status).toBe('notFound');
  expect(get).not.toHaveBeenCalled();
});

it('permet recuperar-se d’un error de xarxa', async () => {
  get.mockRejectedValueOnce(new Error('offline'));
  const { result } = await renderVm();
  await waitFor(() => expect(result.current.status).toBe('error'));
  get.mockResolvedValue(asPointResponse());
  await act(() => result.current.retry());
  await waitFor(() => expect(result.current.status).toBe('ok'));
});

it('conserva les dades si falla el refresc i ho indica', async () => {
  get.mockResolvedValueOnce(asPointResponse());
  const { result } = await renderVm();
  await waitFor(() => expect(result.current.status).toBe('ok'));
  get.mockRejectedValue(new Error('offline'));
  await act(() => result.current.retry());
  await waitFor(() => expect(result.current.staleMessage).toBeDefined());
  expect(result.current.status).toBe('ok');
  expect(result.current.title).toBe(point.nom);
});

it('no arrossega les dades del punt anterior quan canvia l’id', async () => {
  get.mockResolvedValueOnce(asPointResponse()).mockReturnValue(new Promise(() => undefined));
  const { result, rerender } = await renderHook(
    ({ id }: { id: string }) => usePointDetailViewModel(id),
    {
      initialProps: { id: point.id },
      wrapper: createQueryWrapper(),
    },
  );
  await waitFor(() => expect(result.current.status).toBe('ok'));
  await rerender({ id: 'altre-punt' });
  expect(result.current.status).toBe('loading');
  expect(result.current.title).not.toBe(point.nom);
});

it('tradueix els estats buits en anglès', async () => {
  await i18n.changeLanguage('en');
  get.mockResolvedValue(asPointResponse({ ...point, altitud: null }));
  const { result } = await renderVm();
  await waitFor(() => expect(result.current.status).toBe('ok'));
  expect(result.current.altitude).toBe('No data');
  expect(result.current.hoursLabel).toBe('Tonight');
});

it('refresca l’índex quan la fitxa queda oberta i n’indica la data', async () => {
  jest.useFakeTimers();
  try {
    jest.setSystemTime(new Date('2026-10-20T08:00:00Z'));
    get.mockResolvedValue(asPointResponse());
    const { result, unmount } = await renderVm();
    await waitFor(() => expect(result.current.status).toBe('ok'));
    expect(result.current.currentLabel).toContain('22:00');
    get.mockResolvedValue(
      asPointResponse({
        ...point,
        indexActual: { ...hour, valor: 92, hora: '2026-10-18T22:00:00Z' },
      }),
    );
    await act(async () => {
      await jest.advanceTimersByTimeAsync(5 * 60_000 + 29_000);
    });
    expect(get).toHaveBeenCalledTimes(2);
    await act(async () => {
      await jest.advanceTimersByTimeAsync(1_000);
    });
    await waitFor(() => expect(result.current.currentIndex?.valor).toBe(92));
    expect(result.current.currentLabel).toContain('00:00');
    await unmount();
  } finally {
    jest.useRealTimers();
  }
});

it('calcula el següent refresc després del minut 5 UTC', () => {
  expect(millisecondsUntilNextPointRefresh(Date.parse('2026-10-20T08:05:29Z'))).toBe(1_000);
  expect(millisecondsUntilNextPointRefresh(Date.parse('2026-10-20T08:05:30Z'))).toBe(3_600_000);
});
