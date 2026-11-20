import { ApiError } from '../../middleware/errors';
import type { MobilicatRoutesClient, MobilicatRoute } from '../routesClient';
import { MobilicatRoutesError } from '../routesClient';
import { createRutesService } from '../rutesService';
import type { PuntDetall, PuntsRepository } from '../../punts/puntsRepository';

const ID = '6f1c2b7e-3a9d-4c58-9e0b-2d7f1a4c8b35';
const USUARI_A = 'usuari-a';
const USUARI_B = 'usuari-b';
const PUNT: PuntDetall = {
  id: ID,
  nom: 'Observatori del Montsec',
  municipi: 'Àger',
  descripcio: 'Observatori del Montsec.',
  altitud: null,
  horitzoObert: null,
  accessibilitat: null,
  sqm: null,
  lat: 42.0244,
  lon: 0.7364,
};

const ROUTE: MobilicatRoute = {
  startTime: '2026-11-18T11:00:00+01:00',
  endTime: '2026-11-18T11:27:00+01:00',
  durationSeconds: 1620,
  distanceMeters: 9400,
  transfers: 1,
  stretches: [
    { sequence: 0, mode: 'WALK' },
    { sequence: 1, mode: 'PUBLIC_TRANSPORT', transitMode: 'RAIL', lineShortName: 'R1' },
  ],
};

type RepositoryOptions = { punt?: PuntDetall; error?: Error };

function repositoryWith(options: RepositoryOptions = {}) {
  const punt = Object.prototype.hasOwnProperty.call(options, 'punt') ? options.punt : PUNT;
  const repository: Pick<PuntsRepository, 'findPublished'> = {
    async findPublished() {
      if (options.error) throw options.error;
      return punt;
    },
  };
  return repository;
}

function clientWith(routes: MobilicatRoute[] = [ROUTE]) {
  const getRoutes: jest.MockedFunction<MobilicatRoutesClient['getRoutes']> = jest.fn();
  getRoutes.mockResolvedValue(routes);
  const client: MobilicatRoutesClient = { getRoutes };
  return { client, getRoutes };
}

describe('createRutesService', () => {
  afterEach(() => jest.restoreAllMocks());

  it('arrodoneix l’origen, consulta els modes i retorna l’alternativa normalitzada a UTC', async () => {
    const { client, getRoutes } = clientWith();
    const now = new Date('2026-11-18T10:00:00.000Z');
    const service = createRutesService(repositoryWith(), client, { now: () => now });

    const result = await service.getRutes(ID, { lat: 41.3851, lon: 2.1734 }, USUARI_A);

    expect(getRoutes).toHaveBeenCalledWith({
      from: { lat: 41.385, lon: 2.173 },
      to: { lat: PUNT.lat, lon: PUNT.lon },
      time: now.toISOString(),
      timePreference: 'DEPART_AT',
      modes: ['WALK', 'BIKE', 'BIKE_SHARE', 'CAR', 'PUBLIC_TRANSPORT'],
      limit: 5,
    });
    expect(result).toEqual({
      estat: 'disponible',
      destacada: {
        sortida: '2026-11-18T10:00:00.000Z',
        arribada: '2026-11-18T10:27:00.000Z',
        duradaSegons: 1620,
        distanciaMetres: 9400,
        transbordaments: 1,
        trams: [
          { sequence: 0, mode: 'WALK' },
          { sequence: 1, mode: 'PUBLIC_TRANSPORT', transitMode: 'RAIL', lineShortName: 'R1' },
        ],
      },
      alternatives: [expect.any(Object)],
    });
  });

  it('retorna sense_rutes quan la resposta vàlida és buida', async () => {
    const { client, getRoutes } = clientWith([]);
    const service = createRutesService(repositoryWith(), client);

    await expect(service.getRutes(ID, { lat: 41, lon: 2 }, USUARI_A)).resolves.toEqual({
      estat: 'sense_rutes',
      destacada: null,
      alternatives: [],
    });
    expect(getRoutes).toHaveBeenCalledTimes(1);
  });

  it('retorna no_disponible per a un error tipat de Mobilicat', async () => {
    const { client, getRoutes } = clientWith();
    getRoutes.mockRejectedValue(new MobilicatRoutesError('timeout', 'timeout'));
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const service = createRutesService(repositoryWith(), client);

    await expect(service.getRutes(ID, { lat: 41, lon: 2 }, USUARI_A)).resolves.toEqual({
      estat: 'no_disponible',
      destacada: null,
      alternatives: [],
    });
  });

  it('retorna 404 si el punt no existeix o no està publicat', async () => {
    const { client, getRoutes } = clientWith();
    const service = createRutesService(repositoryWith({ punt: undefined }), client);

    await expect(service.getRutes(ID, { lat: 41, lon: 2 }, USUARI_A)).rejects.toMatchObject({
      status: 404,
      code: 'punt_not_found',
    } satisfies Partial<ApiError>);
    expect(getRoutes).not.toHaveBeenCalled();
  });

  it('tradueix una fallada del repositori a 503 i no consulta Mobilicat', async () => {
    const { client, getRoutes } = clientWith();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const service = createRutesService(
      repositoryWith({ error: new Error('connexió tancada') }),
      client,
    );

    await expect(service.getRutes(ID, { lat: 41, lon: 2 }, USUARI_A)).rejects.toMatchObject({
      status: 503,
      code: 'database_unavailable',
    });
    expect(getRoutes).not.toHaveBeenCalled();
  });

  it('limita les consultes a Mobilicat per usuari i globalment a cinc segons', async () => {
    const { client, getRoutes } = clientWith();
    let instant = Date.parse('2026-11-19T12:00:00.000Z');
    const service = createRutesService(repositoryWith(), client, {
      now: () => new Date(instant),
    });

    await service.getRutes(ID, { lat: 41, lon: 2 }, USUARI_A);

    instant += 1_000;
    await expect(service.getRutes(ID, { lat: 41, lon: 2 }, USUARI_B)).rejects.toMatchObject({
      status: 429,
      code: 'too_many_requests',
      headers: { 'Retry-After': '4' },
    } satisfies Partial<ApiError>);
    expect(getRoutes).toHaveBeenCalledTimes(1);

    instant += 4_000;
    await service.getRutes(ID, { lat: 41, lon: 2 }, USUARI_B);

    instant += 1_000;
    await expect(service.getRutes(ID, { lat: 41, lon: 2 }, USUARI_B)).rejects.toMatchObject({
      status: 429,
      code: 'too_many_requests',
      headers: { 'Retry-After': '4' },
    } satisfies Partial<ApiError>);
    expect(getRoutes).toHaveBeenCalledTimes(2);
  });
});
