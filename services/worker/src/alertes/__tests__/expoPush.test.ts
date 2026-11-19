import { createExpoPushClient, ExpoPushError, URL_EXPO_PUSH, type MissatgePush } from '../expoPush';

const missatge = (to: string): MissatgePush => ({
  to,
  title: 'Bona nit per observar a Montsec',
  body: 'Índex de visibilitat 75 a les 23:00. Toca per veure el punt.',
  data: { puntId: 'montsec' },
  sound: 'default',
  channelId: 'alertes',
  priority: 'high',
});

const resposta = (cos: unknown, status = 200) =>
  new Response(JSON.stringify(cos), { status, headers: { 'content-type': 'application/json' } });

describe('createExpoPushClient', () => {
  it('fa un POST amb tots els missatges i torna un ticket per missatge, en ordre', async () => {
    const fetch = jest.fn(async () =>
      resposta({
        data: [
          { status: 'ok', id: 'ticket-1' },
          {
            status: 'error',
            message: '"ExponentPushToken[b]" is not a registered push notification recipient',
            details: { error: 'DeviceNotRegistered' },
          },
        ],
      }),
    );
    const client = createExpoPushClient({ fetch });

    await expect(
      client.send([missatge('ExponentPushToken[a]'), missatge('ExponentPushToken[b]')]),
    ).resolves.toEqual([
      { status: 'ok', id: 'ticket-1' },
      {
        status: 'error',
        message: '"ExponentPushToken[b]" is not a registered push notification recipient',
        error: 'DeviceNotRegistered',
      },
    ]);
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(URL_EXPO_PUSH);
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({
      accept: 'application/json',
      'content-type': 'application/json',
    });
    expect(JSON.parse(init.body as string)).toEqual([
      missatge('ExponentPushToken[a]'),
      missatge('ExponentPushToken[b]'),
    ]);
  });

  it("amb l'access token, l'envia com a Bearer", async () => {
    const fetch = jest.fn(async () => resposta({ data: [{ status: 'ok', id: 't' }] }));
    await createExpoPushClient({ fetch, accessToken: 'secret' }).send([missatge('a')]);
    const [, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.headers).toMatchObject({ authorization: 'Bearer secret' });
  });

  it('sense missatges no fa cap petició, i amb més de 100 no la fa', async () => {
    const fetch = jest.fn();
    const client = createExpoPushClient({ fetch });
    await expect(client.send([])).resolves.toEqual([]);
    await expect(
      client.send(Array.from({ length: 101 }, (_, i) => missatge(`t${i}`))),
    ).rejects.toThrow(RangeError);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("un error HTTP és un ExpoPushError amb l'estat i el missatge d'Expo", async () => {
    const fetch = jest.fn(async () =>
      resposta({ errors: [{ code: 'UNAUTHORIZED', message: 'Push security is enabled' }] }, 401),
    );
    const error = await createExpoPushClient({ fetch })
      .send([missatge('a')])
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ExpoPushError);
    expect(error).toMatchObject({
      status: 401,
      message: 'Expo Push ha respost 401: Push security is enabled',
    });
  });

  it('un error HTTP sense cos JSON fa servir el text de l’estat', async () => {
    const fetch = jest.fn(
      async () => new Response('<html>', { status: 502, statusText: 'Bad Gateway' }),
    );
    await expect(createExpoPushClient({ fetch }).send([missatge('a')])).rejects.toThrow(
      'Expo Push ha respost 502: Bad Gateway',
    );
  });

  it('un error de xarxa és un ExpoPushError sense estat', async () => {
    const fetch = jest.fn(async () => {
      throw new TypeError('fetch failed');
    });
    await expect(createExpoPushClient({ fetch }).send([missatge('a')])).rejects.toMatchObject({
      name: 'ExpoPushError',
      status: undefined,
      message: "No s'ha pogut contactar amb Expo Push: fetch failed",
    });
  });

  it('una resposta amb un altre nombre de tickets és inesperada', async () => {
    const fetch = jest.fn(async () => resposta({ data: [] }));
    await expect(createExpoPushClient({ fetch }).send([missatge('a')])).rejects.toThrow(
      "Resposta inesperada d'Expo Push",
    );
  });
});
