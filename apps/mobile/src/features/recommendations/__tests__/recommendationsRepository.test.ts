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

it('delega la data i la franja de l’esdeveniment a l’API', async () => {
  await fetchRecommendations({
    esdevenimentId: 'leonids-2026',
    origen: { lat: 41.98, lon: 2.82 },
  });
  expect(apiGet).toHaveBeenLastCalledWith('/recomanacions', {
    esdevenimentId: 'leonids-2026',
    lat: 41.98,
    lon: 2.82,
  });
});

it('«A prop meu» només envia l’origen: la resta la tria l’API (TG-133)', async () => {
  await fetchRecommendations({ origen: { lat: 41.98, lon: 2.82 } });
  expect(apiGet).toHaveBeenLastCalledWith('/recomanacions', { lat: 41.98, lon: 2.82 });
});
