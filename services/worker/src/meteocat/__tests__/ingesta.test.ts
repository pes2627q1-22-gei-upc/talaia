import { actualitzaEstacionsXema, ingestaLecturesXema } from '../ingesta';
import { createInMemoryXemaRepository } from '../repository';
import { XemaError, type VariableXema, type XemaClient } from '../xema';

const ARA = new Date('2026-10-19T06:15:00.000Z');

type Lectura = Awaited<ReturnType<XemaClient['lectures']>>[number];

/** XEMA falsa: dues lectures per estació i variable, i les variables de `fallen` donen error. */
function xemaFalsa(
  fallen: VariableXema[] = [],
  {
    error = () => new XemaError('La XEMA ha respost 503', 503),
    valorDe = () => undefined,
    invalidaDe = () => false,
    estacionsOperatives = [{ codi: 'CC', nom: 'Orís', lat: 42.07, lon: 2.2, altitud: 626 }],
  }: {
    error?: () => Error;
    /** Valor per a una estació i variable concretes; si no, el de `valors`. */
    valorDe?: (estacio: string, variable: VariableXema) => number | undefined;
    /** Lectures que Meteocat marca com a invàlides («N»). */
    invalidaDe?: (estacio: string, variable: VariableXema) => boolean;
    estacionsOperatives?: Awaited<ReturnType<XemaClient['estacionsOperatives']>>;
  } = {},
) {
  const valors: Record<VariableXema, number> = {
    temperatura: 8.3,
    humitat: 81,
    precipitacio: 0.2,
    ventVelocitat: 2,
    ventDireccio: 270,
    irradiancia: 0,
  };
  const client: XemaClient = {
    estacionsOperatives: jest.fn(async () => estacionsOperatives),
    lectures: jest.fn(async (variable: VariableXema, dia: string): Promise<Lectura[]> => {
      if (fallen.includes(variable)) throw error();
      return ['CC', 'UG', 'Z9'].flatMap((estacio) =>
        ['21:00', '21:30'].map((hora) => ({
          estacio,
          data: `${dia}T${hora}:00.000Z`,
          valor: valorDe(estacio, variable) ?? valors[variable],
          validada: !(estacio === 'UG' && variable === 'humitat'),
          invalida: invalidaDe(estacio, variable),
        })),
      );
    }),
  };
  return client;
}

describe('ingestaLecturesXema', () => {
  it('baixa ahir, una petició per variable, i només desa les estacions dels punts', async () => {
    const client = xemaFalsa();
    const repository = createInMemoryXemaRepository({ estacions: ['CC', 'UG'] });

    const resum = await ingestaLecturesXema({ client, repository, ara: () => ARA });

    expect(resum).toEqual({
      dia: '2026-10-18',
      estacions: 2,
      lectures: 4,
      descartades: 0,
      errors: [],
    });
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
    const repository = createInMemoryXemaRepository({ estacions: ['CC'] });
    const resum = await ingestaLecturesXema({
      client: xemaFalsa(['humitat']),
      repository,
      ara: () => ARA,
    });
    expect(resum.errors).toEqual(['humitat: La XEMA ha respost 503']);
    expect(repository.lectures()[0]).toMatchObject({ temperatura: 8.3, humitat: null });
  });

  it('una ingesta parcial no esborra els valors que ja hi havia', async () => {
    const repository = createInMemoryXemaRepository({ estacions: ['CC'] });
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
    const repository = createInMemoryXemaRepository({ estacions: ['CC'] });
    await repository.desaLectures([
      { ...(await primeraLectura()), data: '2026-07-01T00:00:00.000Z' },
    ]);
    await ingestaLecturesXema({ client: xemaFalsa(), repository, ara: () => ARA });
    expect(repository.lectures().some((l) => l.data.startsWith('2026-07-01'))).toBe(false);
  });

  it('es pot demanar un dia concret', async () => {
    const client = xemaFalsa();
    await ingestaLecturesXema(
      { client, repository: createInMemoryXemaRepository({ estacions: ['CC'] }), ara: () => ARA },
      '2026-10-10',
    );
    expect(jest.mocked(client.lectures).mock.calls[0]?.[1]).toBe('2026-10-10');
  });
  it('descarta els valors fora de rang sense perdre la resta del dia', async () => {
    const repository = createInMemoryXemaRepository({ estacions: ['CC', 'UG'] });
    const client = xemaFalsa([], {
      valorDe: (estacio, variable) =>
        estacio === 'UG' && variable === 'humitat' ? 101 : undefined,
    });

    const resum = await ingestaLecturesXema({ client, repository, ara: () => ARA });

    expect(resum).toMatchObject({ lectures: 4, descartades: 2 });
    expect(repository.lectures().find((l) => l.estacio === 'UG')).toMatchObject({
      humitat: null,
      temperatura: 8.3,
    });
  });

  it('si no es pot baixar cap variable, llança un error', async () => {
    const repository = createInMemoryXemaRepository({ estacions: ['CC'] });
    const totes = [
      'temperatura',
      'humitat',
      'precipitacio',
      'ventVelocitat',
      'ventDireccio',
      'irradiancia',
    ] as VariableXema[];
    await expect(
      ingestaLecturesXema({ client: xemaFalsa(totes), repository, ara: () => ARA }),
    ).rejects.toThrow("No s'ha pogut baixar cap variable de la XEMA (2026-10-18)");
    expect(repository.lectures()).toHaveLength(0);
  });

  it.each([
    ['la clau és rebutjada (401)', 401],
    ['la clau no té permís (403)', 403],
    ["la quota s'ha exhaurit (429)", 429],
  ])('si %s, para de seguida sense gastar més consultes', async (_cas, status) => {
    const client = xemaFalsa(['ventVelocitat'], {
      error: () => new XemaError(`La XEMA ha respost ${status}`, status),
    });
    await expect(
      ingestaLecturesXema({
        client,
        repository: createInMemoryXemaRepository({ estacions: ['CC'] }),
        ara: () => ARA,
      }),
    ).rejects.toThrow(`${status}`);
    expect(client.lectures).toHaveBeenCalledTimes(1);
  });

  it("amb el senyal d'aturada no demana cap variable més", async () => {
    const aturada = new AbortController();
    const client = xemaFalsa();
    jest.mocked(client.lectures).mockImplementationOnce(async () => {
      aturada.abort();
      return [];
    });
    await expect(
      ingestaLecturesXema({
        client,
        repository: createInMemoryXemaRepository({ estacions: ['CC'] }),
        ara: () => ARA,
        senyal: aturada.signal,
      }),
    ).resolves.toMatchObject({
      errors: expect.arrayContaining(['humitat: aturat abans de demanar-la']),
    });
    expect(client.lectures).toHaveBeenCalledTimes(1);
  });

  it('una fila amb valors antics no validats no queda marcada com a validada', async () => {
    const repository = createInMemoryXemaRepository({ estacions: ['UG'] });
    await ingestaLecturesXema({ client: xemaFalsa(), repository, ara: () => ARA }); // humitat de UG sense validar
    const parcial = xemaFalsa(['humitat']);
    await ingestaLecturesXema({ client: parcial, repository, ara: () => ARA });
    expect(repository.lectures()[0]).toMatchObject({ humitat: 81, validada: false });
  });

  it('amb un 429 a mitja ingesta, desa les variables que ja havia baixat', async () => {
    const repository = createInMemoryXemaRepository({ estacions: ['CC'] });
    const client = xemaFalsa(['humitat'], {
      error: () => new XemaError('La XEMA ha respost 429: quota exhaurida', 429),
    });

    await expect(ingestaLecturesXema({ client, repository, ara: () => ARA })).rejects.toThrow(
      '429',
    );

    expect(client.lectures).toHaveBeenCalledTimes(4); // vent, direcció, temperatura i humitat
    expect(repository.lectures()[0]).toMatchObject({ temperatura: 8.3, humitat: null });
  });

  it('en tornar a baixar un dia, un valor que ara és «N» queda a null', async () => {
    const repository = createInMemoryXemaRepository({ estacions: ['CC'] });
    await ingestaLecturesXema({ client: xemaFalsa(), repository, ara: () => ARA });

    const resum = await ingestaLecturesXema({
      client: xemaFalsa([], { invalidaDe: (_e, variable) => variable === 'humitat' }),
      repository,
      ara: () => ARA,
    });

    expect(resum.descartades).toBe(2);
    expect(repository.lectures()[0]).toMatchObject({ humitat: null, temperatura: 8.3 });
  });

  it("amb el senyal d'aturada ja activat, no demana res i torna el resum en lloc d'un error", async () => {
    const aturada = new AbortController();
    aturada.abort();
    const client = xemaFalsa();

    const resum = await ingestaLecturesXema({
      client,
      repository: createInMemoryXemaRepository({ estacions: ['CC'] }),
      ara: () => ARA,
      senyal: aturada.signal,
    });

    expect(client.lectures).not.toHaveBeenCalled();
    expect(resum.lectures).toBe(0);
    expect(resum.errors).toHaveLength(6);
    expect(resum.errors.every((e) => e.endsWith('aturat abans de demanar-la'))).toBe(true);
  });
});

describe('actualitzaEstacionsXema', () => {
  const PUNTS = [
    { id: 'montseny', lat: 41.77, lon: 2.4 },
    { id: 'delta', lat: 40.72, lon: 0.75 },
  ];
  const ORIS = { codi: 'CC', nom: 'Orís', lat: 42.075, lon: 2.21, altitud: 626 };
  const AMPOSTA = { codi: 'U7', nom: 'Amposta', lat: 40.7, lon: 0.58, altitud: 3 };

  it("desa les operatives d'avui i assigna a cada punt la més propera", async () => {
    const client = xemaFalsa([], { estacionsOperatives: [ORIS, AMPOSTA] });
    const repository = createInMemoryXemaRepository({ punts: PUNTS });

    await expect(actualitzaEstacionsXema({ client, repository, ara: () => ARA })).resolves.toEqual({
      estacions: 2,
      puntsAmbEstacio: 2,
    });
    expect(client.estacionsOperatives).toHaveBeenCalledWith('2026-10-19');
    expect(repository.estacioDe('montseny')).toBe('CC');
    expect(repository.estacioDe('delta')).toBe('U7');
  });

  it("una estació que deixa de ser operativa es conserva, però ja no s'assigna", async () => {
    const repository = createInMemoryXemaRepository({ punts: PUNTS });
    await actualitzaEstacionsXema({
      client: xemaFalsa([], { estacionsOperatives: [ORIS, AMPOSTA] }),
      repository,
      ara: () => ARA,
    });
    await actualitzaEstacionsXema({
      client: xemaFalsa([], { estacionsOperatives: [ORIS] }),
      repository,
      ara: () => ARA,
    });

    expect(repository.estacions()).toEqual(
      expect.arrayContaining([expect.objectContaining({ codi: 'U7', operativa: false })]),
    );
    expect(repository.estacioDe('delta')).toBe('CC');
  });

  it('una resposta buida de Meteocat no deixa cap estació com a no operativa', async () => {
    const repository = createInMemoryXemaRepository({ punts: PUNTS });
    await actualitzaEstacionsXema({
      client: xemaFalsa([], { estacionsOperatives: [ORIS, AMPOSTA] }),
      repository,
      ara: () => ARA,
    });

    await actualitzaEstacionsXema({
      client: xemaFalsa([], { estacionsOperatives: [] }),
      repository,
      ara: () => ARA,
    });

    expect(repository.estacions().every((e) => e.operativa)).toBe(true);
    expect(repository.estacioDe('delta')).toBe('U7');
  });
});

async function primeraLectura() {
  const repository = createInMemoryXemaRepository({ estacions: ['CC'] });
  await ingestaLecturesXema({ client: xemaFalsa(), repository, ara: () => ARA });
  const [lectura] = repository.lectures();
  if (!lectura) throw new Error('cap lectura');
  return lectura;
}
