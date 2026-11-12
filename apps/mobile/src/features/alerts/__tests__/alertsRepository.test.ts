import { apiGet, apiPost } from '@/core/api/httpClient';

import { alertsRepository } from '../alertsRepository';

jest.mock('@/core/api/httpClient', () => ({ apiGet: jest.fn(), apiPost: jest.fn() }));

const NEW_ALERT = {
  objectiu: 'cel_estrellat',
  origen: { lat: 41.387, lon: 2.169 },
  distanciaMaxKm: 50,
  indexMinim: 70,
} as const;

describe('alertsRepository', () => {
  beforeEach(() => jest.resetAllMocks());

  it('crea una alerta amb POST /alertes i en retorna la desada', async () => {
    const saved = { id: 'a1', ...NEW_ALERT, activa: true };
    jest.mocked(apiPost).mockResolvedValue(saved);
    await expect(alertsRepository.create(NEW_ALERT)).resolves.toBe(saved);
    expect(apiPost).toHaveBeenCalledWith('/alertes', NEW_ALERT);
  });

  it('llista les alertes de l’usuari amb GET /alertes', async () => {
    jest.mocked(apiGet).mockResolvedValue([]);
    await expect(alertsRepository.list()).resolves.toEqual([]);
    expect(apiGet).toHaveBeenCalledWith('/alertes');
  });
});
