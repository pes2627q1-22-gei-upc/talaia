import { apiGet } from '@/core/api/httpClient';

import { fetchRecommendations } from '../recommendationsRepository';

jest.mock('@/core/api/httpClient', () => ({ apiGet: jest.fn() }));

it('crida GET /recomanacions amb l’origen pla, com el valida l’API', async () => {
  await fetchRecommendations({
    objectiu: 'pluja_estels',
    origen: { lat: 41.98, lon: 2.82 },
    data: '2026-10-22',
    desDe: 22,
    finsA: 6,
    tempsMaxim: 150,
  });
  expect(apiGet).toHaveBeenCalledWith('/recomanacions', {
    objectiu: 'pluja_estels',
    lat: 41.98,
    lon: 2.82,
    data: '2026-10-22',
    desDe: 22,
    finsA: 6,
    tempsMaxim: 150,
  });
});
