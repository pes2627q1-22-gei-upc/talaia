import type { EstatPunt, EstatPuntAdmin, PuntAdmin } from '@talaia/shared';

import { SLUG_PUNT_REFERENCIA } from '../../esdeveniments/esdevenimentsRepository';
import type { PuntsAdminRepository } from '../puntsAdminRepository';
import { createPuntsAdminService } from '../puntsAdminService';

const ID = '7d3f2c1a-5b4e-4f6a-9c8d-1e2f3a4b5c6d';

const PUNT: PuntAdmin = {
  id: ID,
  slug: 'mirador-del-montsec',
  nom: 'Mirador del Montsec',
  municipi: 'Àger',
  descripcio: 'Mirador sobre la Noguera.',
  altitud: null,
  horitzoObert: null,
  accessibilitat: null,
  sqm: null,
  estat: 'PUBLICAT',
  origen: 'OFICIAL',
  dataCreacio: '2026-11-11T10:00:00.000Z',
  dataActualitzacio: '2026-11-11T10:00:00.000Z',
  lat: 42.0244,
  lon: 0.7364,
};

/**
 * Repositori fals. `update` fa com el de debò: passa a `comprova` el punt d'abans (`actual`) i, si
 * no llança, hi aplica els canvis.
 */
function setup(overrides: Partial<PuntsAdminRepository> = {}, actual: PuntAdmin = PUNT) {
  const repository: PuntsAdminRepository = {
    list: jest.fn(async () => [PUNT]),
    find: jest.fn(async (id: string) => (id === ID ? PUNT : undefined)),
    create: jest.fn(async (nou) => ({ ...PUNT, ...nou })),
    update: jest.fn(async (id, canvis, comprova) => {
      if (id !== ID) return undefined;
      comprova?.(actual);
      return { ...actual, ...canvis };
    }),
    ...overrides,
  };
  const mapa = { invalidateMapDocument: jest.fn() };
  return { repository, mapa, service: createPuntsAdminService(repository, { mapa }) };
}

const NOU = {
  slug: PUNT.slug,
  nom: PUNT.nom,
  municipi: PUNT.municipi,
  descripcio: PUNT.descripcio,
  lat: PUNT.lat,
  lon: PUNT.lon,
};

describe('puntsAdminService.create', () => {
  it('sense estat, el crea PUBLICAT i descarta el document del mapa', async () => {
    const { repository, mapa, service } = setup();

    await expect(service.create(NOU)).resolves.toMatchObject({ estat: 'PUBLICAT' });

    expect(repository.create).toHaveBeenCalledWith({ ...NOU, estat: 'PUBLICAT' });
    expect(mapa.invalidateMapDocument).toHaveBeenCalledTimes(1);
  });

  it("respecta l'estat que se li dona", async () => {
    const { repository, service } = setup();
    await service.create({ ...NOU, estat: 'DESACTIVAT' });
    expect(repository.create).toHaveBeenCalledWith({ ...NOU, estat: 'DESACTIVAT' });
  });

  it('409 slug_already_exists si el slug ja existeix, sense tocar el mapa', async () => {
    const { mapa, service } = setup({ create: async () => undefined });

    await expect(service.create(NOU)).rejects.toMatchObject({
      status: 409,
      code: 'slug_already_exists',
    });
    expect(mapa.invalidateMapDocument).not.toHaveBeenCalled();
  });
});

describe('puntsAdminService.update', () => {
  it('aplica els canvis i descarta el document del mapa', async () => {
    const { repository, mapa, service } = setup();

    await expect(service.update(ID, { estat: 'DESACTIVAT' })).resolves.toMatchObject({
      estat: 'DESACTIVAT',
    });

    expect(repository.update).toHaveBeenCalledWith(
      ID,
      { estat: 'DESACTIVAT' },
      expect.any(Function),
    );
    expect(mapa.invalidateMapDocument).toHaveBeenCalledTimes(1);
  });

  it.each<[EstatPunt, EstatPuntAdmin]>([
    ['PUBLICAT', 'DESACTIVAT'],
    ['DESACTIVAT', 'PUBLICAT'],
    ['PUBLICAT', 'PUBLICAT'],
  ])('deixa passar un punt de %s a %s', async (abans, estat) => {
    const { service } = setup({}, { ...PUNT, estat: abans });
    await expect(service.update(ID, { estat })).resolves.toMatchObject({ estat });
  });

  it.each<[EstatPunt, EstatPuntAdmin]>([
    ['PENDENT', 'PUBLICAT'],
    ['PENDENT', 'DESACTIVAT'],
    ['REBUTJAT', 'PUBLICAT'],
  ])(
    '409 moderation_required: un punt %s no passa a %s des d’aquí (moderació, TG-220)',
    async (abans, estat) => {
      const { mapa, service } = setup({}, { ...PUNT, estat: abans, origen: 'COMUNITAT' });

      await expect(service.update(ID, { estat, nom: 'x' })).rejects.toMatchObject({
        status: 409,
        code: 'moderation_required',
      });
      expect(mapa.invalidateMapDocument).not.toHaveBeenCalled();
    },
  );

  it("d'un punt PENDENT se'n poden corregir les dades sense tocar-ne l'estat", async () => {
    const { service } = setup({}, { ...PUNT, estat: 'PENDENT', origen: 'COMUNITAT' });
    await expect(service.update(ID, { nom: 'Nom corregit' })).resolves.toMatchObject({
      nom: 'Nom corregit',
      estat: 'PENDENT',
    });
  });

  it.each([{ nom: 'x' }, { estat: 'DESACTIVAT' as const }])(
    '404 punt_not_found si no existeix, sense tocar el mapa (%o)',
    async (canvis) => {
      const { mapa, service } = setup();

      await expect(
        service.update('9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d', canvis),
      ).rejects.toMatchObject({ status: 404, code: 'punt_not_found' });
      expect(mapa.invalidateMapDocument).not.toHaveBeenCalled();
    },
  );

  it("409 reference_point_required si es vol retirar el punt de referència d'Aprop (ADR-0026)", async () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    const referencia = { ...PUNT, slug: SLUG_PUNT_REFERENCIA };
    const { mapa, service } = setup({}, referencia);

    await expect(service.update(ID, { estat: 'DESACTIVAT' })).rejects.toMatchObject({
      status: 409,
      code: 'reference_point_required',
    });
    expect(mapa.invalidateMapDocument).not.toHaveBeenCalled();
    // És una regla, no una caiguda de la base de dades: no surt al log com un 503.
    expect(error).not.toHaveBeenCalled();

    // La resta de canvis sí que s'hi poden fer.
    await expect(
      service.update(ID, { nom: 'Centre d’Observació de l’Univers', estat: 'PUBLICAT' }),
    ).resolves.toMatchObject({ estat: 'PUBLICAT' });
    error.mockRestore();
  });
});

describe('puntsAdminService.get i list', () => {
  it('get: el punt, o 404 punt_not_found', async () => {
    const { service } = setup();
    await expect(service.get(ID)).resolves.toBe(PUNT);
    await expect(service.get('9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d')).rejects.toMatchObject({
      status: 404,
      code: 'punt_not_found',
    });
  });

  it('list: tots els punts del repositori', async () => {
    const { service } = setup();
    await expect(service.list()).resolves.toEqual([PUNT]);
  });
});

describe('puntsAdminService: errors de la base de dades', () => {
  afterEach(() => jest.restoreAllMocks());

  it.each([
    ['list', (s: ReturnType<typeof setup>['service']) => s.list()],
    ['get', (s: ReturnType<typeof setup>['service']) => s.get(ID)],
    ['create', (s: ReturnType<typeof setup>['service']) => s.create(NOU)],
    ['update', (s: ReturnType<typeof setup>['service']) => s.update(ID, { nom: 'x' })],
  ])('%s: 503 database_unavailable, i el detall al log', async (_cas, crida) => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    const caiguda = async () => {
      throw new Error('connection refused');
    };
    const { mapa, service } = setup({
      list: caiguda,
      find: caiguda,
      create: caiguda,
      update: caiguda,
    });

    await expect(crida(service)).rejects.toMatchObject({
      status: 503,
      code: 'database_unavailable',
    });
    expect(error).toHaveBeenCalled();
    expect(mapa.invalidateMapDocument).not.toHaveBeenCalled();
  });
});
