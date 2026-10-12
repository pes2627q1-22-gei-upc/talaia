import type { PrevisioMeteoHora } from '@talaia/shared';

import { ingestaPrevisioMeteo } from '../ingesta';
import type { Coordenades, OpenMeteoClient } from '../openMeteo';
import { createInMemoryPrevisioMeteoRepository } from '../repository';

const ARA = new Date('2026-10-12T20:05:00.000Z');

function hora(hora: string, nuvolsTotal: number): PrevisioMeteoHora {
  return {
    hora,
    nuvolsTotal,
    nuvolsBaixos: 0,
    nuvolsMitjans: 0,
    nuvolsAlts: nuvolsTotal,
    humitat: 70,
    visibilitat: 30000,
  };
}

/** Client fals: una hora per lloc, amb la nuvolositat igual a la latitud per distingir-los. */
function fakeClient() {
  const crides: Coordenades[][] = [];
  const client: OpenMeteoClient = {
    async previsio(llocs) {
      crides.push(llocs);
      return llocs.map((lloc) => [hora('2026-10-12T21:00:00.000Z', lloc.lat)]);
    },
  };
  return { client, crides };
}

const PUNTS = [
  { id: 'montsec', lat: 42, lon: 0.7 },
  { id: 'barcelona', lat: 41, lon: 2.1 },
];

describe('ingestaPrevisioMeteo', () => {
  it('demana la previsió de tots els punts en una sola crida al client', async () => {
    const { client, crides } = fakeClient();
    const repository = createInMemoryPrevisioMeteoRepository();

    await ingestaPrevisioMeteo(PUNTS, { client, repository, ara: () => ARA });

    expect(crides).toEqual([
      [
        { lat: 42, lon: 0.7 },
        { lat: 41, lon: 2.1 },
      ],
    ]);
  });

  it('desa una previsió per punt amb la font, el moment de la ingesta i les seves hores', async () => {
    const { client } = fakeClient();
    const repository = createInMemoryPrevisioMeteoRepository();

    await ingestaPrevisioMeteo(PUNTS, { client, repository, ara: () => ARA });

    await expect(repository.previsioDe('montsec')).resolves.toEqual({
      puntId: 'montsec',
      font: 'open_meteo',
      obtingudaEl: '2026-10-12T20:05:00.000Z',
      hores: [hora('2026-10-12T21:00:00.000Z', 42)],
    });
    await expect(repository.previsioDe('barcelona')).resolves.toMatchObject({
      hores: [expect.objectContaining({ nuvolsTotal: 41 })],
    });
  });

  it('retorna un resum amb punts, hores totals i moment de la ingesta', async () => {
    const { client } = fakeClient();
    const resum = await ingestaPrevisioMeteo(PUNTS, {
      client,
      repository: createInMemoryPrevisioMeteoRepository(),
      ara: () => ARA,
    });
    expect(resum).toEqual({ punts: 2, hores: 2, obtingudaEl: '2026-10-12T20:05:00.000Z' });
  });

  it('una ingesta nova substitueix la previsió anterior del mateix punt', async () => {
    const { client } = fakeClient();
    const repository = createInMemoryPrevisioMeteoRepository();
    const despres = new Date('2026-10-12T21:05:00.000Z');

    await ingestaPrevisioMeteo(PUNTS, { client, repository, ara: () => ARA });
    await ingestaPrevisioMeteo([PUNTS[0]!], { client, repository, ara: () => despres });

    expect(repository.totes()).toHaveLength(2);
    await expect(repository.previsioDe('montsec')).resolves.toMatchObject({
      obtingudaEl: despres.toISOString(),
    });
    await expect(repository.previsioDe('barcelona')).resolves.toMatchObject({
      obtingudaEl: ARA.toISOString(),
    });
  });

  it('sense punts no crida la font ni desa res', async () => {
    const { client, crides } = fakeClient();
    const repository = createInMemoryPrevisioMeteoRepository();

    const resum = await ingestaPrevisioMeteo([], { client, repository, ara: () => ARA });

    expect(crides).toHaveLength(0);
    expect(repository.totes()).toEqual([]);
    expect(resum).toEqual({ punts: 0, hores: 0, obtingudaEl: ARA.toISOString() });
  });

  it('si el client torna menys previsions que punts, falla sense desar res', async () => {
    const client: OpenMeteoClient = { previsio: async () => [] };
    const repository = createInMemoryPrevisioMeteoRepository();

    await expect(ingestaPrevisioMeteo(PUNTS, { client, repository })).rejects.toThrow('montsec');
    expect(repository.totes()).toEqual([]);
  });
});
