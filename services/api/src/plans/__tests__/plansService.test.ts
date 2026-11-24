import type { PlaNou } from '@talaia/shared';

import type { PlaAmbTextos, PlansRepository } from '../plansRepository';
import { createPlansService, fiEfectiu, validaCanvis } from '../plansService';

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
    setCalendarEvent: jest.fn(async () => true),
    update: jest.fn(async () => ({ ok: true, pla: PLA_AMB_TEXTOS }) as const),
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
    await service(repo).setCalendarEvent(PERFIL, PLA, 'event-1');

    expect(repo.create).toHaveBeenCalledWith(PERFIL, NOU, ARA);
    expect(repo.list).toHaveBeenCalledWith(PERFIL, 'futurs', ARA);
    expect(repo.findById).toHaveBeenCalledWith(PERFIL, PLA);
    expect(repo.setCalendarEvent).toHaveBeenCalledWith(PERFIL, PLA, 'event-1');
  });

  it('sense rellotge injectat, fa servir l’hora actual', async () => {
    jest.useFakeTimers({ now: ARA });
    try {
      const repo = repository();
      await createPlansService(repo).list(PERFIL, 'passats');
      expect(repo.list).toHaveBeenCalledWith(PERFIL, 'passats', ARA);
    } finally {
      jest.useRealTimers();
    }
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

  it.each([
    ['limit', 'plan_limit_reached'],
    ['duplicate', 'plan_already_exists'],
  ] as const)('amb %s del repositori respon 409 %s', async (reason, code) => {
    const repo = repository({ create: jest.fn(async () => ({ ok: false, reason }) as const) });
    await expect(service(repo).create(PERFIL, NOU)).rejects.toMatchObject({ status: 409, code });
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
    const repo = repository({
      create: falla,
      list: falla,
      findById: falla,
      setCalendarEvent: falla,
    });
    for (const crida of [
      service(repo).create(PERFIL, NOU),
      service(repo).list(PERFIL),
      service(repo).get(PERFIL, PLA),
      service(repo).setCalendarEvent(PERFIL, PLA, 'event-1'),
    ]) {
      await expect(crida).rejects.toMatchObject({ status: 503, code: 'database_unavailable' });
    }
    error.mockRestore();
  });

  it('un vincle a un pla inexistent o aliè retorna 404', async () => {
    const repo = repository({ setCalendarEvent: jest.fn(async () => false) });
    await expect(service(repo).setCalendarEvent(PERFIL, PLA, 'event-1')).rejects.toMatchObject({
      status: 404,
      code: 'plan_not_found',
    });
  });
});

describe('plansService.update', () => {
  it('llegeix el pla, comprova les regles amb el rellotge injectat i passa només els canvis', async () => {
    const repo = repository();
    const canvis = { notes: 'Portar el termo' };
    await expect(service(repo).update(PERFIL, PLA, canvis, 'es')).resolves.toEqual({
      ...PLA_CA,
      punt: { ...PUNT, nom: 'Observatorio del Montsec' },
    });
    expect(repo.findById).toHaveBeenCalledWith(PERFIL, PLA);
    expect(repo.update).toHaveBeenCalledWith(PERFIL, PLA, canvis);
  });

  it('un pla que no és del perfil respon 404 i no s’actualitza', async () => {
    const repo = repository({ findById: jest.fn(async () => undefined) });
    await expect(service(repo).update(PERFIL, PLA, { notes: 'x' })).rejects.toMatchObject({
      status: 404,
      code: 'plan_not_found',
    });
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('si el pla desapareix entre la lectura i l’actualització, 404', async () => {
    const repo = repository({
      update: jest.fn(async () => ({ ok: false, reason: 'not_found' }) as const),
    });
    await expect(service(repo).update(PERFIL, PLA, { notes: 'x' })).rejects.toMatchObject({
      status: 404,
      code: 'plan_not_found',
    });
  });

  it.each([
    ['punt_not_found', 422],
    ['event_not_found', 422],
    ['duplicate', 409],
  ] as const)('amb %s del repositori respon %i', async (reason, status) => {
    const repo = repository({ update: jest.fn(async () => ({ ok: false, reason }) as const) });
    const crida = service(repo).update(PERFIL, PLA, { puntId: MONTSEC });
    await expect(crida).rejects.toMatchObject({
      status,
      code: reason === 'duplicate' ? 'plan_already_exists' : reason,
    });
  });

  it('el missatge de punt_not_found nomena el punt del pla resultant, encara que no canviï', async () => {
    const repo = repository({
      update: jest.fn(async () => ({ ok: false, reason: 'punt_not_found' }) as const),
    });
    await expect(service(repo).update(PERFIL, PLA, { notes: 'x' })).rejects.toMatchObject({
      message: expect.stringContaining(MONTSEC),
    });
  });

  it('una regla de temps que falla no arriba al repositori', async () => {
    const repo = repository();
    // El pla és el 20/11 sense final: moure'l al 15/11 és al passat respecte a ARA (16/11).
    await expect(
      service(repo).update(PERFIL, PLA, { dataHoraInici: '2026-11-15T21:00:00Z' }),
    ).rejects.toMatchObject({ status: 400, code: 'validation_error' });
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('un error de la base de dades és un 503', async () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const repo = repository({
      update: jest.fn(async () => {
        throw new Error('connection refused');
      }),
    });
    await expect(service(repo).update(PERFIL, PLA, { notes: 'x' })).rejects.toMatchObject({
      status: 503,
      code: 'database_unavailable',
    });
    error.mockRestore();
  });
});

describe('validaCanvis', () => {
  const FUTUR = {
    dataHoraInici: '2026-11-20T21:00:00.000Z',
    dataHoraFi: '2026-11-21T01:00:00.000Z',
  };
  const COMENCAT = {
    dataHoraInici: '2026-11-16T11:00:00.000Z',
    dataHoraFi: '2026-11-16T14:00:00.000Z',
  };

  it('sense final, un pla acaba el migdia de després de la seva nit', () => {
    expect(fiEfectiu({ dataHoraInici: '2026-11-15T21:00:00Z', dataHoraFi: null })).toEqual(
      new Date('2026-11-16T11:00:00.000Z'),
    );
    expect(fiEfectiu(FUTUR)).toEqual(new Date(FUTUR.dataHoraFi));
  });

  it('un pla acabat és un 409 plan_finished, sigui quin sigui el canvi', () => {
    const acabat = { dataHoraInici: '2026-11-15T21:00:00Z', dataHoraFi: null };
    expect(validaCanvis(acabat, { notes: 'x' }, ARA)).toMatchObject({
      status: 409,
      code: 'plan_finished',
    });
  });

  it('el final es compara amb l’inici resultant: el nou amb l’antic i a l’inrevés', () => {
    expect(validaCanvis(FUTUR, { dataHoraInici: '2026-11-21T01:00:00Z' }, ARA)?.code).toBe(
      'validation_error',
    );
    expect(validaCanvis(FUTUR, { dataHoraFi: '2026-11-20T20:00:00Z' }, ARA)?.code).toBe(
      'validation_error',
    );
    expect(
      validaCanvis(FUTUR, { dataHoraInici: '2026-11-21T01:00:00Z', dataHoraFi: null }, ARA),
    ).toBeUndefined();
  });

  it('un pla començat es pot desar si l’inici no es mou (encara que s’enviï igual)', () => {
    expect(validaCanvis(COMENCAT, { notes: 'Hi som' }, ARA)).toBeUndefined();
    expect(
      validaCanvis(COMENCAT, { dataHoraInici: '2026-11-16T12:00:00+01:00' }, ARA),
    ).toBeUndefined();
    expect(validaCanvis(COMENCAT, { dataHoraInici: '2026-11-16T11:30:00Z' }, ARA)).toMatchObject({
      status: 400,
      message: expect.stringContaining('passada'),
    });
  });
});
