import { act, renderHook, waitFor } from '@testing-library/react-native';

import { ApiError, apiGet } from '@/core/api/httpClient';
import i18n from '@/core/i18n';
import { createQueryWrapper } from '@/test-utils/queryWrapper';

import { fetchPointDetail } from '../pointRepository';
import { usePointDetailViewModel } from '../usePointDetailViewModel';
import { asPointResponse, hour, point } from '../__fixtures__/point';

jest.mock('@/core/api/httpClient', () => ({
  ...jest.requireActual('@/core/api/httpClient'),
  apiGet: jest.fn(),
}));
const get = jest.mocked(apiGet);
const renderVm = (id = 'montsec') =>
  renderHook(() => usePointDetailViewModel(id), { wrapper: createQueryWrapper() });

beforeEach(async () => {
  get.mockReset();
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

it('mostra càrrega mentre espera la resposta', async () => {
  get.mockReturnValue(new Promise(() => undefined));
  const { result } = await renderVm();
  expect(result.current.status).toBe('loading');
});

it('ordena hores, respecta les franges del backend i converteix a l’hora de Catalunya', async () => {
  get.mockResolvedValue(asPointResponse());
  const { result } = await renderVm();
  await waitFor(() => expect(result.current.status).toBe('ok'));
  expect(result.current.title).toBe('Serra del Montsec');
  expect(result.current.hours.map((h) => h.label)).toEqual(['23', '00', '01']);
  expect(result.current.hours.map((h) => h.level)).toEqual(['ras', 'tap', 'ras']);
  expect(result.current.hours.map((h) => h.isBest)).toEqual([false, false, true]);
  expect(result.current.hours[2]?.accessibilityLabel).toContain('Dins del millor moment');
  expect(result.current.bestWindow?.to).toBe('02:00');
  expect(result.current.factorRows.map((factor) => [factor.key, factor.value])).toEqual([
    ['nuvols', 95],
    ['sol', 100],
    ['foscor', 94],
    ['lluna', 68],
  ]);
  expect(result.current.accessibility).toBe(point.accessibilitat);
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
  expect(result.current.hours).toEqual([]);
  expect(result.current.bestWindow).toBeUndefined();
});

it('no proposa un millor moment si totes les hores tenen la franja tap', async () => {
  get.mockResolvedValue(
    asPointResponse({
      ...point,
      properesHores: [
        { ...hour, hora: '2026-10-18T21:00:00Z', valor: 0, franja: 'tap' },
        { ...hour, hora: '2026-10-18T22:00:00Z', valor: 18, franja: 'tap' },
      ],
    }),
  );
  const { result } = await renderVm();
  await waitFor(() => expect(result.current.status).toBe('ok'));
  expect(result.current.bestWindow).toBeUndefined();
  expect(result.current.hours.every((hour) => !hour.isBest)).toBe(true);
});

it('distingeix una altitud zero i una foscor estimada', async () => {
  get.mockResolvedValue(
    asPointResponse({
      ...point,
      altitud: 0,
      indexActual: { ...hour, foscorEstimada: true },
    }),
  );
  const { result } = await renderVm();
  await waitFor(() => expect(result.current.status).toBe('ok'));
  expect(result.current.altitude).toBe('0 m');
  expect(result.current.factorRows.find((factor) => factor.key === 'foscor')?.hint).toContain(
    'estimat',
  );
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
      expect(get).toHaveBeenCalledTimes(1);
      await act(async () => {
        await jest.advanceTimersByTimeAsync(60_000);
      });
      expect(get).toHaveBeenCalledTimes(1);
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
  expect(result.current.hoursLabel).toBe('Next hours');
});

it('refresca l’índex quan la fitxa queda oberta i n’indica la data', async () => {
  jest.useFakeTimers();
  try {
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
      await jest.advanceTimersByTimeAsync(60_000);
    });
    await waitFor(() => expect(result.current.currentIndex?.valor).toBe(92));
    expect(result.current.currentLabel).toContain('00:00');
    await unmount();
  } finally {
    jest.useRealTimers();
  }
});
