import type { PlaNou } from '@talaia/shared';

import { apiGet, apiPost } from '@/core/api/httpClient';

import { fetchPlanEvents, PLANS_KEY, plansRepository } from '../plansRepository';

jest.mock('@/core/api/httpClient', () => ({
  ...jest.requireActual('@/core/api/httpClient'),
  apiGet: jest.fn(),
  apiPost: jest.fn(),
}));
const get = jest.mocked(apiGet);
const post = jest.mocked(apiPost);

beforeEach(() => {
  get.mockReset();
  post.mockReset();
});

it('crea el pla amb POST /plans i el cos exacte', async () => {
  const plan: PlaNou = {
    puntId: 'montsec',
    esdevenimentId: null,
    dataHoraInici: '2026-10-21T21:15:00.000Z',
    calendariEventId: null,
    notes: null,
  };
  post.mockResolvedValue({ id: 'p1' });
  await expect(plansRepository.create(plan)).resolves.toEqual({ id: 'p1' });
  expect(post).toHaveBeenCalledWith('/plans', plan);
});

it('la clau dels plans és la que invalidarà «Els meus plans»', () => {
  expect(PLANS_KEY).toEqual(['plans']);
});

it('demana els fenòmens del dia triat ± 1', async () => {
  get.mockResolvedValue({ data: [] });
  const controller = new AbortController();
  await fetchPlanEvents('2026-10-21', controller.signal);
  expect(get).toHaveBeenCalledWith(
    '/esdeveniments',
    { des_de: '2026-10-20', fins_a: '2026-10-22' },
    { signal: controller.signal },
  );
});
