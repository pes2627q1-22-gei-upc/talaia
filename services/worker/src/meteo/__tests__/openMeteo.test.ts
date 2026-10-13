import { OpenMeteoError, createOpenMeteoClient, toHores } from '../openMeteo';

const BASE_URL = 'https://api.open-meteo.com/v1';

/** Un lloc tal com el retorna Open-Meteo amb `timeformat=unixtime` (2 hores). */
function lloc(overrides: Partial<Record<string, (number | null)[]>> = {}) {
  return {
    latitude: 42.0294,
    longitude: 0.7112,
    hourly: {
      time: [1791763200, 1791766800],
      cloud_cover: [11, 90],
      cloud_cover_low: [0, 0],
      cloud_cover_mid: [0, 5],
      cloud_cover_high: [11, 90],
      relative_humidity_2m: [78, 80],
      visibility: [35720, 33180],
      ...overrides,
    },
  };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/** `fetch` fals que recorda les URL i les opcions de cada petició. */
function fakeFetch(handler: (url: URL, crida: number) => Response | Promise<Response>) {
  const urls: URL[] = [];
  const inits: (RequestInit | undefined)[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : input);
    urls.push(url);
    inits.push(init);
    return handler(url, urls.length);
  };
  return { fetch, urls, inits };
}

/** `fetch` que no respon mai: només acaba quan el senyal d'abort s'activa. */
function fetchPenjat(): typeof globalThis.fetch {
  return (_input, init) =>
    new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
    });
}

describe('toHores', () => {
  it('converteix les sèries paral·leles en hores ISO en UTC amb les variables del domini', () => {
    expect(toHores(lloc().hourly)).toEqual([
      {
        hora: '2026-10-12T00:00:00.000Z',
        nuvolsTotal: 11,
        nuvolsBaixos: 0,
        nuvolsMitjans: 0,
        nuvolsAlts: 11,
        humitat: 78,
        visibilitat: 35720,
      },
      {
        hora: '2026-10-12T01:00:00.000Z',
        nuvolsTotal: 90,
        nuvolsBaixos: 0,
        nuvolsMitjans: 5,
        nuvolsAlts: 90,
        humitat: 80,
        visibilitat: 33180,
      },
    ]);
  });

  it('conserva els `null` de la font (i els `0`)', () => {
    const hores = toHores(lloc({ visibility: [null, 33180], cloud_cover_low: [0, null] }).hourly);
    expect(hores[0]).toMatchObject({ visibilitat: null, nuvolsBaixos: 0 });
    expect(hores[1]).toMatchObject({ visibilitat: 33180, nuvolsBaixos: null });
  });
});

describe('createOpenMeteoClient', () => {
  it('demana les variables de TG-95 en UTC i unixtime, amb els llocs en llistes', async () => {
    const { fetch, urls } = fakeFetch(() => json([lloc(), lloc()]));
    const client = createOpenMeteoClient({ baseUrl: BASE_URL, fetch, diesPrevisio: 2 });

    await client.previsio([
      { lat: 42.0294, lon: 0.7112 },
      { lat: 41.3851, lon: 2.1734 },
    ]);

    expect(urls).toHaveLength(1);
    const url = urls[0]!;
    expect(url.origin + url.pathname).toBe('https://api.open-meteo.com/v1/forecast');
    expect(url.searchParams.get('latitude')).toBe('42.0294,41.3851');
    expect(url.searchParams.get('longitude')).toBe('0.7112,2.1734');
    expect(url.searchParams.get('hourly')).toBe(
      'cloud_cover,cloud_cover_low,cloud_cover_mid,cloud_cover_high,relative_humidity_2m,visibility',
    );
    expect(url.searchParams.get('timezone')).toBe('UTC');
    expect(url.searchParams.get('timeformat')).toBe('unixtime');
    expect(url.searchParams.get('forecast_days')).toBe('2');
  });

  it('per defecte demana 4 dies: amb 3, la nit de demà passat quedaria tallada (dies en UTC)', async () => {
    const { fetch, urls, inits } = fakeFetch(() => json(lloc()));
    await createOpenMeteoClient({ baseUrl: BASE_URL, fetch }).previsio([{ lat: 42, lon: 0.7 }]);
    expect(urls[0]!.searchParams.get('forecast_days')).toBe('4');
    expect(inits[0]?.signal).toBeInstanceOf(AbortSignal);
  });

  it('admet una URL base amb barra final', async () => {
    const { fetch, urls } = fakeFetch(() => json(lloc()));
    await createOpenMeteoClient({ baseUrl: `${BASE_URL}/`, fetch }).previsio([
      { lat: 42, lon: 0.7 },
    ]);
    expect(urls[0]!.pathname).toBe('/v1/forecast');
  });

  it("amb un sol lloc Open-Meteo respon un objecte: en surt una sola sèrie d'hores", async () => {
    const { fetch } = fakeFetch(() => json(lloc()));
    const client = createOpenMeteoClient({ baseUrl: BASE_URL, fetch });

    const previsions = await client.previsio([{ lat: 42.0294, lon: 0.7112 }]);

    expect(previsions).toHaveLength(1);
    expect(previsions[0]).toHaveLength(2);
    expect(previsions[0]![0]!.hora).toBe('2026-10-12T00:00:00.000Z');
  });

  it('amb diversos llocs respon un array: una sèrie per lloc, en el mateix ordre', async () => {
    const { fetch } = fakeFetch(() => json([lloc(), lloc({ cloud_cover: [50, 60] })]));
    const client = createOpenMeteoClient({ baseUrl: BASE_URL, fetch });

    const previsions = await client.previsio([
      { lat: 42, lon: 0.7 },
      { lat: 41, lon: 2.1 },
    ]);

    expect(previsions.map((hores) => hores[0]!.nuvolsTotal)).toEqual([11, 50]);
  });

  it('parteix els llocs en lots de `llocsPerPeticio` i concatena els resultats en ordre', async () => {
    const { fetch, urls } = fakeFetch((url) => {
      const lats = url.searchParams.get('latitude')!.split(',');
      return json(lats.length === 1 ? lloc() : lats.map(() => lloc()));
    });
    const client = createOpenMeteoClient({ baseUrl: BASE_URL, fetch, llocsPerPeticio: 2 });

    const previsions = await client.previsio([
      { lat: 1, lon: 1 },
      { lat: 2, lon: 2 },
      { lat: 3, lon: 3 },
    ]);

    expect(previsions).toHaveLength(3);
    expect(urls.map((url) => url.searchParams.get('latitude'))).toEqual(['1,2', '3']);
  });

  it('si falla un lot, `previsio` rebutja sencer i no retorna els lots que havien anat bé', async () => {
    const { fetch, urls } = fakeFetch((_url, crida) =>
      crida === 1
        ? json([lloc(), lloc()])
        : json({ error: true, reason: 'Too Many Requests' }, 429),
    );
    const client = createOpenMeteoClient({ baseUrl: BASE_URL, fetch, llocsPerPeticio: 2 });

    await expect(
      client.previsio([
        { lat: 1, lon: 1 },
        { lat: 2, lon: 2 },
        { lat: 3, lon: 3 },
      ]),
    ).rejects.toMatchObject({ name: 'OpenMeteoError', status: 429 });
    expect(urls).toHaveLength(2);
  });

  it('sense llocs no fa cap petició', async () => {
    const { fetch, urls } = fakeFetch(() => json([]));
    await expect(createOpenMeteoClient({ baseUrl: BASE_URL, fetch }).previsio([])).resolves.toEqual(
      [],
    );
    expect(urls).toHaveLength(0);
  });

  it("un error HTTP d'Open-Meteo arriba com a OpenMeteoError amb el motiu i l'estat", async () => {
    const { fetch } = fakeFetch(() =>
      json({ error: true, reason: 'Invalid value: Cannot initialize Float' }, 400),
    );
    const client = createOpenMeteoClient({ baseUrl: BASE_URL, fetch });

    const error = await client.previsio([{ lat: 42, lon: 0.7 }]).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(OpenMeteoError);
    expect(error).toMatchObject({ status: 400 });
    expect((error as Error).message).toContain('Invalid value');
  });

  it('un error HTTP sense cos JSON també és un OpenMeteoError', async () => {
    const { fetch } = fakeFetch(
      () => new Response('Service Unavailable', { status: 503, statusText: 'Service Unavailable' }),
    );
    await expect(
      createOpenMeteoClient({ baseUrl: BASE_URL, fetch }).previsio([{ lat: 42, lon: 0.7 }]),
    ).rejects.toMatchObject({ name: 'OpenMeteoError', status: 503 });
  });

  it('si Open-Meteo no respon dins de `timeoutMs`, és un OpenMeteoError sense `status`', async () => {
    const client = createOpenMeteoClient({
      baseUrl: BASE_URL,
      fetch: fetchPenjat(),
      timeoutMs: 20,
    });

    const error = await client.previsio([{ lat: 42, lon: 0.7 }]).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(OpenMeteoError);
    expect((error as OpenMeteoError).status).toBeUndefined();
    expect((error as Error).message).toMatch(/contactar amb Open-Meteo.*timeout/i);
  });

  it('un error de xarxa (DNS, connexió tallada) també és un OpenMeteoError', async () => {
    const fetch: typeof globalThis.fetch = async () => {
      throw new TypeError('fetch failed');
    };
    await expect(
      createOpenMeteoClient({ baseUrl: BASE_URL, fetch }).previsio([{ lat: 42, lon: 0.7 }]),
    ).rejects.toMatchObject({
      name: 'OpenMeteoError',
      status: undefined,
      message: expect.stringContaining('fetch failed'),
    });
  });

  it('una sèrie més curta que `time` és una resposta mal formada, no hores amb `null`', async () => {
    const { fetch } = fakeFetch(() => json(lloc({ relative_humidity_2m: [78] })));
    await expect(
      createOpenMeteoClient({ baseUrl: BASE_URL, fetch }).previsio([{ lat: 42, lon: 0.7 }]),
    ).rejects.toThrow('mateixa llargada');
  });

  it('un cos amb una forma inesperada és un OpenMeteoError', async () => {
    const { fetch } = fakeFetch(() => json({ hourly: { time: 'avui' } }));
    await expect(
      createOpenMeteoClient({ baseUrl: BASE_URL, fetch }).previsio([{ lat: 42, lon: 0.7 }]),
    ).rejects.toThrow(OpenMeteoError);
  });

  it('si el nombre de llocs retornats no coincideix amb els demanats, falla', async () => {
    const { fetch } = fakeFetch(() => json([lloc()]));
    await expect(
      createOpenMeteoClient({ baseUrl: BASE_URL, fetch }).previsio([
        { lat: 1, lon: 1 },
        { lat: 2, lon: 2 },
      ]),
    ).rejects.toThrow('ha retornat 1');
  });

  it('rebutja opcions fora de rang en crear el client', () => {
    expect(() => createOpenMeteoClient({ baseUrl: BASE_URL, diesPrevisio: 0 })).toThrow(RangeError);
    expect(() => createOpenMeteoClient({ baseUrl: BASE_URL, diesPrevisio: 17 })).toThrow(
      RangeError,
    );
    expect(() => createOpenMeteoClient({ baseUrl: BASE_URL, llocsPerPeticio: 0 })).toThrow(
      RangeError,
    );
    expect(() => createOpenMeteoClient({ baseUrl: BASE_URL, timeoutMs: 0 })).toThrow(RangeError);
  });
});
