import type { Favorit } from '@talaia/shared';

import type { FavoritsRepository } from '../favoritsRepository';
import { createFavoritsService } from '../favoritsService';

const PERFIL = 'aaaaaaaa-0000-4000-8000-000000000001';
const MONTSEC = 'bbbbbbbb-0000-4000-8000-000000000001';
/** Les 21:35 UTC: l'índex que es demana és el de les 21:00. */
const ARA = new Date('2026-11-11T21:35:12.000Z');
const HORA = new Date('2026-11-11T21:00:00.000Z');

const FAVORIT: Favorit = {
  id: MONTSEC,
  nom: 'Observatori del Montsec',
  municipi: 'Àger',
  lat: 42.0244,
  lon: 0.7364,
  index: { valor: 82, franja: 'ras', deDia: false },
  dataCreacio: '2026-11-11T18:00:00.000Z',
};

function repository(overrides: Partial<FavoritsRepository> = {}): jest.Mocked<FavoritsRepository> {
  return {
    list: jest.fn(async () => [FAVORIT]),
    add: jest.fn(async () => ({ created: true, favorit: FAVORIT })),
    remove: jest.fn(async () => undefined),
    ...overrides,
  } as jest.Mocked<FavoritsRepository>;
}

const service = (repo: FavoritsRepository) => createFavoritsService(repo, { now: () => ARA });

describe('favoritsService', () => {
  it("llista els favorits del perfil amb l'índex de l'hora en curs", async () => {
    const repo = repository();
    await expect(service(repo).list(PERFIL)).resolves.toEqual([FAVORIT]);
    expect(repo.list).toHaveBeenCalledWith(PERFIL, HORA);
  });

  it('desa el favorit i diu si és nou', async () => {
    const repo = repository({ add: jest.fn(async () => ({ created: false, favorit: FAVORIT })) });
    await expect(service(repo).add(PERFIL, MONTSEC)).resolves.toEqual({
      created: false,
      favorit: FAVORIT,
    });
    expect(repo.add).toHaveBeenCalledWith(PERFIL, MONTSEC, HORA);
  });

  it('respon 404 punt_not_found si el punt no és publicat', async () => {
    const repo = repository({ add: jest.fn(async () => undefined) });
    await expect(service(repo).add(PERFIL, MONTSEC)).rejects.toMatchObject({
      status: 404,
      code: 'punt_not_found',
    });
  });

  it('treu el favorit del perfil', async () => {
    const repo = repository();
    await expect(service(repo).remove(PERFIL, MONTSEC)).resolves.toBeUndefined();
    expect(repo.remove).toHaveBeenCalledWith(PERFIL, MONTSEC);
  });

  it.each(['list', 'add', 'remove'] as const)(
    'si la base de dades falla, %s respon 503 database_unavailable i ho deixa al log',
    async (method) => {
      const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
      const caiguda = jest.fn(async () => {
        throw new Error('connect ECONNREFUSED');
      });
      const favorits = service(repository({ [method]: caiguda }));

      await expect(favorits[method](PERFIL, MONTSEC)).rejects.toMatchObject({
        status: 503,
        code: 'database_unavailable',
      });
      expect(error).toHaveBeenCalledWith(expect.stringContaining('[favorits]'), expect.any(Error));
      error.mockRestore();
    },
  );
});
