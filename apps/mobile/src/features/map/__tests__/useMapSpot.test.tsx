import type { VisibilitatUbicacio } from '@talaia/shared';
import { act, renderHook } from '@testing-library/react-native';

import { ApiError } from '@/core/api/httpClient';
import i18n from '@/core/i18n';

import { distanceKm, travelMinutes, useMapSpot } from '../useMapSpot';
import type { Spot } from '../visibilityRepository';

let mockQuery: {
  data?: VisibilitatUbicacio;
  isError: boolean;
  error: unknown;
  refetch: jest.Mock;
};
const mockUseVisibilityQuery = jest.fn((_spot: Spot | null) => mockQuery);
jest.mock('../visibilityRepository', () => ({
  useVisibilityQuery: (spot: Spot | null) => mockUseVisibilityQuery(spot),
}));

const barcelona = { name: 'Barcelona', lat: 41.38712, lon: 2.16994 };
const result = (overrides: Partial<VisibilitatUbicacio> = {}): VisibilitatUbicacio => ({
  lat: 42.01,
  lon: 1.31,
  sqm: 21.4,
  deDia: false,
  index: {
    valor: 81,
    franja: 'ras',
    hora: '2026-11-16T20:00:00Z',
    foscorEstimada: false,
    factors: { nuvols: 1, foscor: 0.9, lluna: 0.95, sol: 1 },
  },
  ...overrides,
});

/** Prem «Calcula l'índex aquí». */
function press(card: ReturnType<typeof useMapSpot>['card']) {
  if (card?.state.kind !== 'idle') throw new Error('la targeta no ofereix calcular');
  card.state.action.onPress();
}

describe('useMapSpot (HU05, mockup 04)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('ca');
    mockQuery = { data: undefined, isError: false, error: null, refetch: jest.fn() };
    mockUseVisibilityQuery.mockClear();
  });

  it('sense cap toc no hi ha targeta', async () => {
    const { result: hook } = await renderHook(() => useMapSpot(barcelona));
    expect(hook.current.card).toBeNull();
    expect(mockUseVisibilityQuery).toHaveBeenLastCalledWith(null);
  });

  it('el toc ensenya on és i a quant d’on ets, i no demana l’índex fins que es prem', async () => {
    const { result: hook } = await renderHook(() => useMapSpot(barcelona));
    await act(async () => hook.current.pick(42.0112, 1.3089));
    expect(hook.current.card).toMatchObject({
      title: 'Punt triat al mapa',
      coords: 'Lat 42,01 · Lon 1,31',
      travel: expect.stringMatching(/^A \d+ h( \d+ min)? de Barcelona$/),
      state: { kind: 'idle', action: { label: "Calcula l'índex aquí" } },
    });
    expect(mockUseVisibilityQuery).toHaveBeenLastCalledWith(null);

    await act(async () => press(hook.current.card));
    expect(mockUseVisibilityQuery).toHaveBeenLastCalledWith({ lat: 42.0112, lon: 1.3089 });
    expect(hook.current.card?.state).toEqual({
      kind: 'loading',
      label: "S'està calculant l'índex…",
    });
  });

  it('amb el resultat, l’índex i l’hora; i un toc nou torna a demanar el botó', async () => {
    mockQuery = {
      ...mockQuery,
      data: result({ index: { ...result().index, foscorEstimada: true } }),
    };
    const { result: hook } = await renderHook(() => useMapSpot(null));
    await act(async () => hook.current.pick(42.01, 1.31));
    expect(hook.current.card?.travel).toBeNull();
    await act(async () => press(hook.current.card));
    expect(hook.current.card?.state).toEqual({
      kind: 'result',
      index: { valor: 81, franja: 'ras' },
      at: "Índex de l'hora en curs (21:00)",
      notes: ['La foscor del cel és estimada: no hi ha cap punt mesurat a prop.'],
    });
    // Cada consulta nova compta per al límit de l'API: un altre lloc torna a demanar el botó.
    await act(async () => hook.current.pick(41.9, 2.1));
    expect(hook.current.card?.state.kind).toBe('idle');
    expect(mockUseVisibilityQuery).toHaveBeenLastCalledWith(null);
  });

  it('de dia no ensenya cap índex, sinó que compta a partir del vespre', async () => {
    mockQuery = {
      ...mockQuery,
      data: result({ deDia: true, index: { ...result().index, valor: 0, franja: 'tap' } }),
    };
    const { result: hook } = await renderHook(() => useMapSpot(barcelona));
    await act(async () => hook.current.pick(42.01, 1.31));
    await act(async () => press(hook.current.card));
    expect(hook.current.card?.state).toMatchObject({
      kind: 'result',
      index: null,
      notes: ["És de dia: l'índex compta a partir del vespre."],
    });
  });

  it.each([
    [
      'fora de Catalunya',
      new ApiError(422, 'fora_de_catalunya', ''),
      'Aquest lloc és fora de Catalunya',
      false,
    ],
    [
      'massa consultes',
      new ApiError(429, 'too_many_requests', ''),
      'Has fet moltes consultes aquesta hora',
      false,
    ],
    [
      'un error de l’API',
      new ApiError(503, 'meteo_unavailable', ''),
      "No hem pogut calcular l'índex",
      true,
    ],
    ['sense xarxa', new TypeError('Network request failed'), "No hem pogut calcular l'índex", true],
  ])(
    '%s: ho diu i només deixa tornar-ho a provar si té sentit',
    async (_case, error, title, retry) => {
      mockQuery = { ...mockQuery, isError: true, error };
      const { result: hook } = await renderHook(() => useMapSpot(barcelona));
      await act(async () => hook.current.pick(42.01, 1.31));
      await act(async () => press(hook.current.card));
      const state = hook.current.card?.state;
      expect(state).toMatchObject({ kind: 'problem', title });
      if (state?.kind !== 'problem') throw new Error('estat inesperat');
      expect(state.action !== null).toBe(retry);
      state.action?.onPress();
      expect(mockQuery.refetch).toHaveBeenCalledTimes(retry ? 1 : 0);
    },
  );

  it('es tanca', async () => {
    const { result: hook } = await renderHook(() => useMapSpot(barcelona));
    await act(async () => hook.current.pick(42.01, 1.31));
    await act(async () => hook.current.card?.onClose());
    expect(hook.current.card).toBeNull();
  });

  it('en anglès, les coordenades porten punt i el temps va davant', async () => {
    await i18n.changeLanguage('en');
    const { result: hook } = await renderHook(() => useMapSpot(barcelona));
    await act(async () => hook.current.pick(42.01, 1.31));
    expect(hook.current.card?.coords).toBe('Lat 42.01 · Lon 1.31');
    expect(hook.current.card?.travel).toMatch(/ from Barcelona$/);
  });
});

describe('distància i temps en cotxe', () => {
  it('fa la mateixa estimació que l’API: línia recta ×1,3 a 60 km/h', () => {
    const km = distanceKm({ lat: 41.38712, lon: 2.16994 }, { lat: 41.98123, lon: 2.82456 });
    expect(km).toBeGreaterThan(84);
    expect(km).toBeLessThan(86);
    expect(travelMinutes(100)).toBe(130);
    expect(travelMinutes(0)).toBe(0);
  });
});
