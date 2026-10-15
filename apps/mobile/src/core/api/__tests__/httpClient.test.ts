import { getAccessToken } from '@/core/auth/accessToken';

import { ApiError, apiGet, apiPost, buildUrl } from '../httpClient';

jest.mock('@/core/auth/accessToken', () => ({ getAccessToken: jest.fn() }));

beforeEach(() => {
  jest.mocked(getAccessToken).mockReset().mockResolvedValue(null);
});

describe('buildUrl', () => {
  it('uneix la base i la ruta i ignora els paràmetres sense valor', () => {
    expect(
      buildUrl(
        '/punts',
        { bbox: '1,2,3,4', limit: 20, cursor: undefined },
        'https://api.talaia.cat/api/v1',
      ),
    ).toBe('https://api.talaia.cat/api/v1/punts?bbox=1%2C2%2C3%2C4&limit=20');
  });
});

describe('apiGet', () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('retorna el cos JSON si la resposta és correcta', async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ data: [1] }), { status: 200 }));
    await expect(apiGet<{ data: number[] }>('/punts')).resolves.toEqual({ data: [1] });
  });

  it('converteix { error: { code, message } } en un ApiError', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { code: 'not_found', message: 'No existeix' } }), {
        status: 404,
      }),
    );
    await expect(apiGet('/punts/x')).rejects.toEqual(new ApiError(404, 'not_found', 'No existeix'));
  });

  it('envia el JWT actual i conserva Headers i la cancel·lació', async () => {
    const request = jest.fn().mockResolvedValue(new Response('{}'));
    globalThis.fetch = request;
    jest.mocked(getAccessToken).mockResolvedValue('current-token');
    const controller = new AbortController();
    await apiGet('/protected', undefined, {
      headers: new Headers({ 'X-Request-Id': 'test', Authorization: 'Bearer old-token' }),
      signal: controller.signal,
    });
    const init = request.mock.calls[0]![1] as RequestInit;
    const headers = new Headers(init.headers);
    expect(headers.get('Authorization')).toBe('Bearer current-token');
    expect(headers.get('X-Request-Id')).toBe('test');
    expect(init.signal).toBe(controller.signal);
  });

  it('rellegeix el token a cada petició i deixa d’enviar-lo després del logout', async () => {
    const request = jest.fn().mockImplementation(() => Promise.resolve(new Response('{}')));
    globalThis.fetch = request;
    jest.mocked(getAccessToken).mockResolvedValueOnce('first').mockResolvedValueOnce('renewed');
    await apiGet('/protected');
    await apiGet('/protected');
    await apiGet('/public', undefined, { headers: [['Authorization', 'Bearer stale']] });
    expect(
      request.mock.calls.map((call) =>
        new Headers((call[1] as RequestInit).headers).get('Authorization'),
      ),
    ).toEqual(['Bearer first', 'Bearer renewed', null]);
  });

  it('no fa la petició si falla la recuperació de sessió', async () => {
    globalThis.fetch = jest.fn();
    jest.mocked(getAccessToken).mockRejectedValue(new Error('storage'));
    await expect(apiGet('/protected')).rejects.toThrow('storage');
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('no envia credencials a un origen extern', async () => {
    globalThis.fetch = jest.fn();
    await expect(apiGet('https://external.example/private')).rejects.toThrow(
      'configured API origin',
    );
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(getAccessToken).not.toHaveBeenCalled();
  });

  it('permet el POST autenticat que necessita el primer accés de TG-84', async () => {
    const request = jest.fn().mockResolvedValue(new Response('{"created":true}', { status: 201 }));
    globalThis.fetch = request;
    jest.mocked(getAccessToken).mockResolvedValue('jwt');
    await expect(apiPost('/profile/ensure', {})).resolves.toEqual({ created: true });
    const init = request.mock.calls[0]![1] as RequestInit;
    expect(init.method).toBe('POST');
    expect(init.body).toBe('{}');
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer jwt');
    expect(new Headers(init.headers).get('Content-Type')).toBe('application/json');
  });
});
