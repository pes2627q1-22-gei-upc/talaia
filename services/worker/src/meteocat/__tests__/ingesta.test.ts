import { actualitzaEstacionsXema, ingestaLecturesXema } from '../ingesta';
import { createInMemoryXemaRepository } from '../repository';
import { XemaError, type VariableXema, type XemaClient } from '../xema';

const ARA = new Date('2026-10-19T06:15:00.000Z');

type Lectura = Awaited<ReturnType<XemaClient['lectures']>>[number];

/** XEMA falsa: dues lectures per estació i variable, i les variables de `fallen` donen error. */
function xemaFalsa(fallen: VariableXema[] = []) {
  const valors: Record<VariableXema, number> = {
    temperatura: 8.3,
    humitat: 81,
    precipitacio: 0.2,
    ventVelocitat: 2,
    ventDireccio: 270,
    irradiancia: 0,
  };
  const client: XemaClient = {
    estacionsOperatives: jest.fn(async () => [
      { codi: 'CC', nom: 'Orís', lat: 42.07, lon: 2.2, altitud: 626 },
    ]),
    lectures: jest.fn(async (variable: VariableXema, dia: string): Promise<Lectura[]> => {
      if (fallen.includes(variable)) throw new XemaError('La XEMA ha respost 503', 503);
      return ['CC', 'UG', 'Z9'].flatMap((estacio) =>
        ['21:00', '21:30'].map((hora) => ({
          estacio,
          data: `${dia}T${hora}:00.000Z`,
          valor: valors[variable],
          validada: !(estacio === 'UG' && variable === 'humitat'),
        })),
      );
    }),
  };
  return client;
}

describe('ingestaLecturesXema', () => {
  it('baixa ahir, una petició per variable, i només desa les estacions dels punts', async () => {
    const client = xemaFalsa();
    const repository = createInMemoryXemaRepository(['CC', 'UG']);

    const resum = await ingestaLecturesXema({ client, repository, ara: () => ARA });

    expect(resum).toEqual({ dia: '2026-10-18', estacions: 2, lectures: 4, errors: [] });
    expect(client.lectures).toHaveBeenCalledTimes(6);
    expect(jest.mocked(client.lectures).mock.calls.every(([, dia]) => dia === '2026-10-18')).toBe(
      true,
    );
    const cc = repository.lectures().find((l) => l.estacio === 'CC');
    expect(cc).toEqual({
      estacio: 'CC',
      data: '2026-10-18T21:00:00.000Z',
      temperatura: 8.3,
      humitat: 81,
      precipitacio: 0.2,
      ventVelocitat: 7.2, // 2 m/s
      ventDireccio: 270,
      irradiancia: 0,
      validada: true,
    });
    expect(
      repository
        .lectures()
        .filter((l) => l.estacio === 'UG')
        .every((l) => !l.validada),
    ).toBe(true);
  });

  it('si falla una variable, desa les altres i ho diu al resum', async () => {
    const repository = createInMemoryXemaRepository(['CC']);
    const resum = await ingestaLecturesXema({
      client: xemaFalsa(['humitat']),
      repository,
      ara: () => ARA,
    });
    expect(resum.errors).toEqual(['humitat: La XEMA ha respost 503']);
    expect(repository.lectures()[0]).toMatchObject({ temperatura: 8.3, humitat: null });
  });

  it('una ingesta parcial no esborra els valors que ja hi havia', async () => {
    const repository = createInMemoryXemaRepository(['CC']);
    await ingestaLecturesXema({ client: xemaFalsa(), repository, ara: () => ARA });
    await ingestaLecturesXema({ client: xemaFalsa(['humitat']), repository, ara: () => ARA });
    expect(repository.lectures()[0]).toMatchObject({ humitat: 81 });
  });

  it('sense estacions assignades no fa cap petició', async () => {
    const client = xemaFalsa();
    const resum = await ingestaLecturesXema({
      client,
      repository: createInMemoryXemaRepository(),
      ara: () => ARA,
    });
    expect(resum.lectures).toBe(0);
    expect(client.lectures).not.toHaveBeenCalled();
  });

  it('esborra les lectures de fa més de 90 dies', async () => {
    const repository = createInMemoryXemaRepository(['CC']);
    await repository.desaLectures([
      { ...(await primeraLectura()), data: '2026-07-01T00:00:00.000Z' },
    ]);
    await ingestaLecturesXema({ client: xemaFalsa(), repository, ara: () => ARA });
    expect(repository.lectures().some((l) => l.data.startsWith('2026-07-01'))).toBe(false);
  });

  it('es pot demanar un dia concret', async () => {
    const client = xemaFalsa();
    await ingestaLecturesXema(
      { client, repository: createInMemoryXemaRepository(['CC']), ara: () => ARA },
      '2026-10-10',
    );
    expect(jest.mocked(client.lectures).mock.calls[0]?.[1]).toBe('2026-10-10');
  });
});

describe('actualitzaEstacionsXema', () => {
  it("desa les estacions operatives d'avui i torna a assignar la més propera als punts", async () => {
    const client = xemaFalsa();
    const repository = createInMemoryXemaRepository(['CC']);
    await expect(actualitzaEstacionsXema({ client, repository, ara: () => ARA })).resolves.toEqual({
      estacions: 1,
      puntsAmbEstacio: 1,
    });
    expect(client.estacionsOperatives).toHaveBeenCalledWith('2026-10-19');
  });
});

async function primeraLectura() {
  const repository = createInMemoryXemaRepository(['CC']);
  await ingestaLecturesXema({ client: xemaFalsa(), repository, ara: () => ARA });
  const [lectura] = repository.lectures();
  if (!lectura) throw new Error('cap lectura');
  return lectura;
}
