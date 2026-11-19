import {
  createMobilicatRoutesClient,
  MobilicatRoutesError,
  MobilicatRoutesQuerySchema,
  type MobilicatRoutesQuery,
} from '../routesClient';

const QUERY: MobilicatRoutesQuery = {
  from: { lat: 41.3851, lon: 2.1734 },
  to: { lat: 41.4036, lon: 2.1744 },
  time: '2026-11-12T08:30:00+01:00',
  timePreference: 'ARRIVE_BY',
  modes: ['BIKE', 'WALK'],
  limit: 3,
};

const ROUTE = {
  startTime: '2026-11-12T08:00:00+01:00',
  endTime: '2026-11-12T08:30:00+01:00',
  durationSeconds: 1800,
  distanceMeters: 4200,
  walkDistanceMeters: 1200,
  transfers: 0,
  stretches: [{ sequence: 0, mode: 'BIKE' }],
};

const responseWith = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

describe('createMobilicatRoutesClient', () => {
  let fetchMock: jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    fetchMock = jest.fn() as jest.MockedFunction<typeof fetch>;
  });

  it.each([
    ['https://api.mobili.cat', 'https://api.mobili.cat/routes'],
    ['https://host.example/api/v1/', 'https://host.example/api/v1/routes'],
    ['https://host.example/api/v1///', 'https://host.example/api/v1/routes'],
  ])(
    'afegeix /routes a la URL base %s sense descartar-ne el camí',
    async (baseUrl, expectedUrl) => {
      fetchMock.mockResolvedValue(responseWith({ routes: [] }));
      const client = createMobilicatRoutesClient({ baseUrl, fetch: fetchMock });

      await client.getRoutes(QUERY);

      const requestedUrl = new URL(String(fetchMock.mock.calls[0]?.[0]));
      expect(`${requestedUrl.origin}${requestedUrl.pathname}`).toBe(expectedUrl);
    },
  );

  it('envia els paràmetres del contracte, accepta un offset i usa GET amb timeout', async () => {
    fetchMock.mockResolvedValue(responseWith({ routes: [] }));
    const client = createMobilicatRoutesClient({
      baseUrl: 'https://api.mobili.cat',
      timeoutMs: 2500,
      fetch: fetchMock,
    });

    await client.getRoutes(QUERY);

    const [input, init] = fetchMock.mock.calls[0] ?? [];
    const url = new URL(String(input));
    expect(url.searchParams.get('from')).toBe('41.3851,2.1734');
    expect(url.searchParams.get('to')).toBe('41.4036,2.1744');
    expect(url.searchParams.get('time')).toBe(QUERY.time);
    expect(url.searchParams.get('timePreference')).toBe('ARRIVE_BY');
    expect(url.searchParams.get('modes')).toBe('BIKE,WALK');
    expect(url.searchParams.get('limit')).toBe('3');
    expect(init).toMatchObject({ method: 'GET', headers: { Accept: 'application/json' } });
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    expect(MobilicatRoutesQuerySchema.safeParse(QUERY).success).toBe(true);
  });

  it('escriu coordenades petites en decimal, no en notació exponencial', async () => {
    fetchMock.mockResolvedValue(responseWith({ routes: [] }));
    const client = createMobilicatRoutesClient({
      baseUrl: 'https://api.mobili.cat',
      fetch: fetchMock,
    });

    await client.getRoutes({
      ...QUERY,
      from: { lat: 0.0000001, lon: -0.0000001 },
      to: { lat: 0.0000002, lon: -0.0000002 },
    });

    const url = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(url.searchParams.get('from')).toBe('0.0000001,-0.0000001');
    expect(url.searchParams.get('to')).toBe('0.0000002,-0.0000002');
    expect(url.search).not.toMatch(/[eE][+-]?\d/);
  });

  it('normalitza a UTC les hores de resposta amb offset', async () => {
    fetchMock.mockResolvedValue(responseWith({ routes: [ROUTE] }));
    const client = createMobilicatRoutesClient({
      baseUrl: 'https://api.mobili.cat',
      fetch: fetchMock,
    });

    await expect(client.getRoutes(QUERY)).resolves.toMatchObject([
      { startTime: '2026-11-12T07:00:00.000Z', endTime: '2026-11-12T07:30:00.000Z' },
    ]);
  });

  it('retorna [] quan Mobilicat no troba rutes', async () => {
    fetchMock.mockResolvedValue(responseWith({ routes: [] }));
    const client = createMobilicatRoutesClient({
      baseUrl: 'https://api.mobili.cat',
      fetch: fetchMock,
    });

    await expect(client.getRoutes(QUERY)).resolves.toEqual([]);
  });

  it('conserva les primeres limit rutes si el proveïdor n’envia més', async () => {
    fetchMock.mockResolvedValue(responseWith({ routes: [ROUTE, ROUTE, ROUTE, ROUTE] }));
    const client = createMobilicatRoutesClient({
      baseUrl: 'https://api.mobili.cat',
      fetch: fetchMock,
    });

    await expect(client.getRoutes({ ...QUERY, limit: 2 })).resolves.toHaveLength(2);
  });

  it('classifica un error HTTP i cancel·la el cos de la resposta', async () => {
    const response = new Response('upstream error', { status: 503 });
    const cancel = jest.spyOn(response.body!, 'cancel');
    fetchMock.mockResolvedValue(response);
    const client = createMobilicatRoutesClient({
      baseUrl: 'https://api.mobili.cat',
      fetch: fetchMock,
    });

    await expect(client.getRoutes(QUERY)).rejects.toMatchObject({
      name: 'MobilicatRoutesError',
      kind: 'http',
      status: 503,
    });
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it('classifica els errors de xarxa', async () => {
    fetchMock.mockRejectedValue(new Error('connexió rebutjada'));
    const client = createMobilicatRoutesClient({
      baseUrl: 'https://api.mobili.cat',
      fetch: fetchMock,
    });

    await expect(client.getRoutes(QUERY)).rejects.toMatchObject({ kind: 'network' });
  });

  it('classifica el timeout', async () => {
    fetchMock.mockRejectedValue(Object.assign(new Error('timeout'), { name: 'TimeoutError' }));
    const client = createMobilicatRoutesClient({
      baseUrl: 'https://api.mobili.cat',
      fetch: fetchMock,
    });

    await expect(client.getRoutes(QUERY)).rejects.toMatchObject({ kind: 'timeout' });
  });

  it('classifica una resposta JSON o un contracte invàlids', async () => {
    fetchMock.mockResolvedValue(new Response('{', { status: 200 }));
    const client = createMobilicatRoutesClient({
      baseUrl: 'https://api.mobili.cat',
      fetch: fetchMock,
    });

    await expect(client.getRoutes(QUERY)).rejects.toMatchObject({
      name: 'MobilicatRoutesError',
      kind: 'invalid_response',
    });

    fetchMock.mockResolvedValue(responseWith({ routes: [{ ...ROUTE, distanceMeters: 1.5 }] }));
    await expect(client.getRoutes(QUERY)).rejects.toMatchObject({
      kind: 'invalid_response',
    });
  });

  it('no fa la petició si la query és invàlida', async () => {
    const client = createMobilicatRoutesClient({
      baseUrl: 'https://api.mobili.cat',
      fetch: fetchMock,
    });

    await expect(client.getRoutes({ ...QUERY, modes: [] })).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('no accepta un timeout no positiu', () => {
    expect(() =>
      createMobilicatRoutesClient({ baseUrl: 'https://api.mobili.cat', timeoutMs: 0 }),
    ).toThrow(RangeError);
  });

  it('exporta errors tipats amb missatge estable', () => {
    const error = new MobilicatRoutesError('network', 'fallada');

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('MobilicatRoutesError');
    expect(error.kind).toBe('network');
  });
});
