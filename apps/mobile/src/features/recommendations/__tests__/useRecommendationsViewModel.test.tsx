import type { RecomanacionsResposta } from '@talaia/shared';
import { renderHook } from '@testing-library/react-native';

import i18n from '@/core/i18n';

import { addDays, nightOf } from '../../explore/exploreModel';
import type { RecommendationParams } from '../recommendationsModel';
import { useRecommendationsViewModel } from '../useRecommendationsViewModel';

let mockParams: RecommendationParams = {};
jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  useLocalSearchParams: () => mockParams,
}));
let mockResult: {
  data?: RecomanacionsResposta;
  isPending: boolean;
  isError: boolean;
  isFetching: boolean;
} = { isPending: true, isError: false, isFetching: true };
jest.mock('../recommendationsRepository', () => ({
  useRecommendationsQuery: () => mockResult,
}));

const search = (overrides: RecommendationParams = {}): RecommendationParams => ({
  objectiu: 'cel_estrellat',
  lat: '41.98',
  lon: '2.82',
  data: nightOf(new Date()),
  desDe: '22',
  finsA: '6',
  tempsMaxim: '45',
  ...overrides,
});

describe('useRecommendationsViewModel', () => {
  beforeEach(async () => {
    mockResult = { isPending: true, isError: false, isFetching: true };
    await i18n.changeLanguage('ca');
  });

  it('sense cerca a la ruta no hi ha rànquing', async () => {
    mockParams = {};
    const { result } = await renderHook(() => useRecommendationsViewModel());
    expect(result.current).toBeNull();
  });

  it('demà, i sense nom de lloc', async () => {
    mockParams = search({ data: addDays(nightOf(new Date()), 1) });
    const { result } = await renderHook(() => useRecommendationsViewModel());
    expect(result.current?.header).toMatchObject({
      title: 'Cel estrellat, demà a la nit',
      subtitle: "Des d'on ets, fins a 45 min",
    });
    expect(result.current?.sheet).toMatchObject({
      title: 'Millors punts per a demà a la nit',
      state: 'loading',
    });
  });

  it('una altra nit, amb el dia de la setmana i el mes', async () => {
    mockParams = search({ data: '2026-12-13', tempsMaxim: '120', lloc: 'Vic' });
    const { result } = await renderHook(() => useRecommendationsViewModel());
    expect(result.current?.header).toMatchObject({
      title: 'Cel estrellat, dg. 13 des.',
      subtitle: 'Des de Vic, fins a 2 h',
    });
  });

  describe('«A prop meu» (HU02)', () => {
    const resolta = (overrides: Partial<RecomanacionsResposta> = {}): RecomanacionsResposta => ({
      data: nightOf(new Date()),
      tempsMaxim: 60,
      radiKm: 46.2,
      franja: { desDe: '2026-11-12T20:00:00Z', finsA: '2026-11-13T11:00:00Z' },
      total: 0,
      punts: [],
      ...overrides,
    });

    it('mentre l’API tria la nit i la distància, diu d’on surt i que busca', async () => {
      mockParams = { aprop: 'aqui', lat: '41.98', lon: '2.82' };
      const { result } = await renderHook(() => useRecommendationsViewModel());
      expect(result.current?.header).toMatchObject({
        title: 'A prop meu',
        subtitle: "Des d'on ets",
      });
      expect(result.current?.sheet).toMatchObject({
        title: 'Millors punts a prop',
        state: 'loading',
      });
      mockParams = { aprop: 'aqui', lat: '41.98', lon: '2.82', lloc: 'Girona' };
      const { result: named } = await renderHook(() => useRecommendationsViewModel());
      expect(named.current?.header.subtitle).toBe('Des de Girona');
      mockParams = { aprop: 'aqui', lat: '41.58', lon: '1.62', lloc: 'Igualada' };
      const { result: vowel } = await renderHook(() => useRecommendationsViewModel());
      expect(vowel.current?.header.subtitle).toBe("Des d'Igualada");
      mockParams = { aprop: 'triat', lat: '41.98', lon: '2.82' };
      const { result: picked } = await renderHook(() => useRecommendationsViewModel());
      expect(picked.current?.header.subtitle).toBe('Des del punt triat');
    });

    it('amb la resposta, ensenya la nit i la distància que ha fet servir l’API', async () => {
      mockResult = { data: resolta(), isPending: false, isError: false, isFetching: false };
      mockParams = { aprop: 'aqui', lat: '41.98', lon: '2.82' };
      const { result } = await renderHook(() => useRecommendationsViewModel());
      expect(result.current?.header).toMatchObject({
        title: 'A prop meu, aquesta nit',
        subtitle: "Des d'on ets, fins a 1 h",
      });
      expect(result.current?.sheet).toMatchObject({
        title: 'Millors punts per a aquesta nit',
        state: 'empty',
        emptyTitle: "No hi ha cap punt a menys d'1 h",
        emptyHint: 'Per anar més lluny, tria la distància a «Què vols veure?».',
      });
      mockResult = {
        data: resolta({ data: addDays(nightOf(new Date()), 1), tempsMaxim: 90 }),
        isPending: false,
        isError: false,
        isFetching: false,
      };
      mockParams = { aprop: 'triat', lat: '41.98', lon: '2.82' };
      const { result: picked } = await renderHook(() => useRecommendationsViewModel());
      expect(picked.current?.header).toMatchObject({
        title: 'A prop meu, demà a la nit',
        subtitle: 'Des del punt triat, fins a 1 h 30 min',
      });
    });

    it('en castellà i en anglès', async () => {
      mockResult = { data: resolta(), isPending: false, isError: false, isFetching: false };
      mockParams = { aprop: 'triat', lat: '41.98', lon: '2.82' };
      await i18n.changeLanguage('es');
      const { result: es } = await renderHook(() => useRecommendationsViewModel());
      expect(es.current?.header).toMatchObject({
        title: 'Cerca de mí, esta noche',
        subtitle: 'Desde el punto elegido, hasta 1 h',
      });
      await i18n.changeLanguage('en');
      const { result: en } = await renderHook(() => useRecommendationsViewModel());
      expect(en.current?.header).toMatchObject({
        title: 'Near me, tonight',
        subtitle: 'From the chosen spot, up to 1 h',
      });
    });
  });
});
