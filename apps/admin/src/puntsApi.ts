import type { PuntAdmin, PuntAdminCanvis, PuntAdminNou } from '@talaia/shared';

export class PuntsApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'PuntsApiError';
  }
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH';
  body?: unknown;
  signal?: AbortSignal;
};

async function errorFromResponse(response: Response): Promise<PuntsApiError> {
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = undefined;
  }

  if (body && typeof body === 'object' && 'error' in body) {
    const detail = body.error;
    if (detail && typeof detail === 'object') {
      const code = 'code' in detail && typeof detail.code === 'string' ? detail.code : undefined;
      const message =
        'message' in detail && typeof detail.message === 'string' ? detail.message : undefined;
      return new PuntsApiError(
        message ?? `La petició ha fallat (${response.status})`,
        response.status,
        code,
      );
    }
  }

  return new PuntsApiError(`La petició ha fallat (${response.status})`, response.status);
}

async function requestJson<T>(
  path: string,
  accessToken: string,
  options: RequestOptions = {},
): Promise<T> {
  const headers = new Headers({ Authorization: `Bearer ${accessToken}` });
  if (options.body !== undefined) headers.set('Content-Type', 'application/json');

  const response = await fetch(path, {
    method: options.method ?? 'GET',
    headers,
    cache: 'no-store',
    signal: options.signal,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  if (!response.ok) throw await errorFromResponse(response);

  try {
    return (await response.json()) as T;
  } catch {
    throw new PuntsApiError('L’API ha retornat una resposta que no es pot llegir', response.status);
  }
}

export async function getAdminPunts(
  accessToken: string,
  signal: AbortSignal,
): Promise<PuntAdmin[]> {
  const result = await requestJson<unknown>('/api/v1/admin/punts', accessToken, { signal });
  if (!Array.isArray(result)) {
    throw new PuntsApiError('La resposta de l’API no conté una llista de punts', 200);
  }

  return result as PuntAdmin[];
}

export function getAdminPunt(
  accessToken: string,
  id: string,
  signal: AbortSignal,
): Promise<PuntAdmin> {
  return requestJson(`/api/v1/admin/punts/${encodeURIComponent(id)}`, accessToken, { signal });
}

export function createAdminPunt(accessToken: string, punt: PuntAdminNou): Promise<PuntAdmin> {
  return requestJson('/api/v1/admin/punts', accessToken, { method: 'POST', body: punt });
}

export function patchAdminPunt(
  accessToken: string,
  id: string,
  changes: PuntAdminCanvis,
): Promise<PuntAdmin> {
  return requestJson(`/api/v1/admin/punts/${encodeURIComponent(id)}`, accessToken, {
    method: 'PATCH',
    body: changes,
  });
}
