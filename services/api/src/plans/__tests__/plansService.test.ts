import type { PlaNou } from '@talaia/shared';

import type { PlaAmbTextos, PlansRepository } from '../plansRepository';
import { createPlansService } from '../plansService';

const PERFIL = 'aaaaaaaa-0000-4000-8000-000000000001';
const PLA = 'cccccccc-0000-4000-8000-000000000001';
const MONTSEC = 'bbbbbbbb-0000-4000-8000-000000000001';
const ARA = new Date('2026-11-16T12:00:00.000Z');

const PLA_AMB_TEXTOS: PlaAmbTextos = {
  id: PLA,
  punt: {
    id: MONTSEC,
    nom: 'Observatori del Montsec',
    municipi: 'Àger',
    textos: { ca: { nom: 'Observatori del Montsec' }, es: { nom: 'Observatorio del Montsec' } },
    publicat: true,
  },
  esdevenimentId: null,
  dataHoraInici: '2026-11-20T21:00:00.000Z',
  dataHoraFi: null,
  calendariEventId: null,
  notes: null,
  dataCreacio: '2026-11-16T10:00:00.000Z',
  dataActualitzacio: '2026-11-16T10:00:00.000Z',
};

/** El `Pla` de la resposta: el punt sense textos, amb el nom de l'idioma. */
const PUNT = {
  id: MONTSEC,
  nom: 'Observatori del Montsec',
  municipi: 'Àger',
  publicat: true,
};
const PLA_CA = { ...PLA_AMB_TEXTOS, punt: PUNT };

const NOU: PlaNou = { puntId: MONTSEC, dataHoraInici: '2026-11-20T21:00:00Z' };

function repository(overrides: Partial<PlansRepository> = {}): jest.Mocked<PlansRepository> {
  return {
    create: jest.fn(async () => ({ ok: true, pla: PLA_AMB_TEXTOS }) as const),
    list: jest.fn(async () => [PLA_AMB_TEXTOS]),
    findById: jest.fn(async () => PLA_AMB_TEXTOS),
    ...overrides,
  } as jest.Mocked<PlansRepository>;
}

const service = (repo: PlansRepository) => createPlansService(repo, { now: () => ARA });

describe('plansService', () => {
  // La garantia d'aïllament és el `where perfil_id` del repositori: el servei li ha de passar
  // sempre el perfil que rep (el del JWT), a totes les operacions.
  it('passa el perfil al repositori a totes les crides', async () => {
    const repo = repository();
    await service(repo).create(PERFIL, NOU);
    await service(repo).list(PERFIL, 'futurs');
    await service(repo).get(PERFIL, PLA);

    expect(repo.create).toHaveBeenCalledWith(PERFIL, NOU);
    expect(repo.list).toHaveBeenCalledWith(PERFIL, 'futurs', ARA);
    expect(repo.findById).toHaveBeenCalledWith(PERFIL, PLA);
  });

  it('retorna el pla amb el nom del punt en l’idioma de l’usuari, sense els textos', async () => {
    const repo = repository();
    await expect(service(repo).create(PERFIL, NOU, 'es')).resolves.toEqual({
      ...PLA_CA,
      punt: { ...PUNT, nom: 'Observatorio del Montsec' },
    });
    // Sense traducció a l'anglès, el català.
    await expect(service(repo).list(PERFIL, undefined, 'en')).resolves.toEqual([PLA_CA]);
    await expect(service(repo).get(PERFIL, PLA)).resolves.toEqual(PLA_CA);
  });

  it.each([
    ['punt_not_found', 'punt_not_found'],
    ['event_not_found', 'event_not_found'],
  ] as const)('amb %s del repositori respon 422 %s', async (reason, code) => {
    const repo = repository({ create: jest.fn(async () => ({ ok: false, reason }) as const) });
    await expect(
      service(repo).create(PERFIL, { ...NOU, esdevenimentId: 'leonides-2026' }),
    ).rejects.toMatchObject({ status: 422, code });
  });

  it('un pla que no és del perfil respon 404 plan_not_found', async () => {
    const repo = repository({ findById: jest.fn(async () => undefined) });
    await expect(service(repo).get(PERFIL, PLA)).rejects.toMatchObject({
      status: 404,
      code: 'plan_not_found',
    });
  });

  it('un error de la base de dades és un 503 database_unavailable', async () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const falla = jest.fn(async () => {
      throw new Error('connection refused');
    });
    const repo = repository({ create: falla, list: falla, findById: falla });
    for (const crida of [
      service(repo).create(PERFIL, NOU),
      service(repo).list(PERFIL),
      service(repo).get(PERFIL, PLA),
    ]) {
      await expect(crida).rejects.toMatchObject({ status: 503, code: 'database_unavailable' });
    }
    error.mockRestore();
  });
});
