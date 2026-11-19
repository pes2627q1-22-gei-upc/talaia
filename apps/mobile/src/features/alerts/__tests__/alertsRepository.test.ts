import { apiGet, apiPatch, apiPost } from '@/core/api/httpClient';

import { alertsRepository } from '../alertsRepository';

jest.mock('@/core/api/httpClient', () => ({
  apiGet: jest.fn(),
  apiPatch: jest.fn(),
  apiPost: jest.fn(),
}));

const NEW_ALERT = {
  objectiu: 'cel_estrellat',
  origen: { lat: 41.387, lon: 2.169 },
  distanciaMaxKm: 50,
  indexMinim: 70,
  avisaEnArribar: false,
  horaAvis: 18,
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

  it('activa o desactiva una alerta amb PATCH /alertes/{id} i només { activa }', async () => {
    const saved = { id: 'a1', ...NEW_ALERT, activa: false };
    jest.mocked(apiPatch).mockResolvedValue(saved);
    await expect(alertsRepository.setActive('a1', false)).resolves.toBe(saved);
    expect(apiPatch).toHaveBeenCalledWith('/alertes/a1', { activa: false });
  });

  it('els canvis només porten els camps que canvien i l’id va codificat a la ruta', async () => {
    jest.mocked(apiPatch).mockResolvedValue({});
    await alertsRepository.update('a/1', { indexMinim: 80, horaAvis: null });
    expect(apiPatch).toHaveBeenCalledWith('/alertes/a%2F1', { indexMinim: 80, horaAvis: null });
  });
});
