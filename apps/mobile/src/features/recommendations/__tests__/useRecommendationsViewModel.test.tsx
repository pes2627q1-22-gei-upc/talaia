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
jest.mock('../recommendationsRepository', () => ({
  useRecommendationsQuery: () => ({ isPending: true, isError: false, isFetching: true }),
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
});
