import { XemaError, createXemaClient } from '../xema';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/** Un client amb un `fetch` fals que torna `resposta` i guarda les crides. */
function clientAmb(resposta: () => Promise<Response> | Response) {
  const crides: Array<{ url: string; init?: RequestInit }> = [];
  const client = createXemaClient({
    apiKey: 'clau-de-prova',
    fetch: async (url, init) => {
      crides.push({ url: String(url), init });
      return resposta();
    },
  });
  return { client, crides };
}

describe('createXemaClient', () => {
  it('sense clau no es pot crear', () => {
    expect(() => createXemaClient({ apiKey: '' })).toThrow('METEOCAT_API_KEY');
  });

  it('demana les estacions operatives amb la clau i en treu les coordenades', async () => {
    const { client, crides } = clientAmb(() =>
      json([
        {
          codi: 'CC',
          nom: 'Orís',
          tipus: 'A',
          coordenades: { latitud: 42.075052799, longitud: 2.20980884646 },
          altitud: 626,
          estats: [],
        },
      ]),
    );

    await expect(client.estacionsOperatives('2026-10-18')).resolves.toEqual([
      { codi: 'CC', nom: 'Orís', lat: 42.075052799, lon: 2.20980884646, altitud: 626 },
    ]);
    expect(crides[0]?.url).toBe(
      'https://api.meteo.cat/xema/v1/estacions/metadades?estat=ope&data=2026-10-18Z',
    );
    expect(new Headers(crides[0]?.init?.headers).get('x-api-key')).toBe('clau-de-prova');
  });

  it("demana una variable de totes les estacions d'un dia, marca les validades i treu les «N»", async () => {
    const { client, crides } = clientAmb(() =>
      json([
        {
          codi: 'CC',
          variables: [
            {
              codi: 32,
              lectures: [
                { data: '2026-10-18T21:00Z', valor: 8.3, estat: 'V', baseHoraria: 'SH' },
                { data: '2026-10-18T21:30Z', valor: 8.1, estat: 'T', baseHoraria: 'SH' },
                { data: '2026-10-18T22:00Z', valor: 7.9, estat: '', baseHoraria: 'SH' },
                { data: '2026-10-18T22:30Z', valor: 99.9, estat: 'N', baseHoraria: 'SH' },
              ],
            },
          ],
        },
      ]),
    );

    await expect(client.lectures('temperatura', '2026-10-18')).resolves.toEqual([
      { estacio: 'CC', data: '2026-10-18T21:00:00.000Z', valor: 8.3, validada: true },
      { estacio: 'CC', data: '2026-10-18T21:30:00.000Z', valor: 8.1, validada: false },
      { estacio: 'CC', data: '2026-10-18T22:00:00.000Z', valor: 7.9, validada: false },
    ]);
    expect(crides[0]?.url).toBe('https://api.meteo.cat/xema/v1/variables/mesurades/32/2026/10/18');
  });

  it('rebutja una data mal formada sense fer cap petició', async () => {
    const { client, crides } = clientAmb(() => json([]));
    await expect(client.lectures('humitat', '18/10/2026')).rejects.toThrow(RangeError);
    expect(crides).toHaveLength(0);
  });

  it("un error HTTP porta l'status i el missatge de Meteocat", async () => {
    const { client } = clientAmb(() => json({ message: 'Quota exhaurida' }, 429));
    const error = await client.lectures('humitat', '2026-10-18').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(XemaError);
    expect(error).toMatchObject({
      status: 429,
      message: 'La XEMA ha respost 429: Quota exhaurida',
    });
  });

  it('un cos inesperat és un XemaError', async () => {
    const { client } = clientAmb(() => json({ res: 'no és una llista' }));
    await expect(client.estacionsOperatives('2026-10-18')).rejects.toThrow(
      'Resposta inesperada de la XEMA',
    );
  });

  it('un error de xarxa és un XemaError sense status', async () => {
    const { client } = clientAmb(() => Promise.reject(new TypeError('fetch failed')));
    const error = await client.estacionsOperatives('2026-10-18').catch((e: unknown) => e);
    expect(error).toMatchObject({ name: 'XemaError', status: undefined });
  });
});
