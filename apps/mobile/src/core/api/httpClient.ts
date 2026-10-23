import type { ApiErrorBody } from '@talaia/shared';

import { getAccessToken } from '@/core/auth/accessToken';
import { env } from '@/core/config/env';

/** Error de l'API de Talaia: el servidor sempre respon `{ error: { code, message } }`. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type Query = Record<string, string | number | boolean | undefined>;

/** Una API que no respon no ha de deixar una pantalla carregant per sempre. */
export const REQUEST_TIMEOUT_MS = 15_000;

export function buildUrl(path: string, query?: Query, baseUrl: string = env.apiUrl): string {
  const url = new URL(path.replace(/^\//, ''), baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }
  return url.toString();
}

/**
 * Únic punt d'accés HTTP de l'app. Només el fan servir els Repository (MVVM):
 * les pantalles i els ViewModels no criden mai `fetch` directament.
 */
export async function apiGet<T>(path: string, query?: Query, init?: RequestInit): Promise<T> {
  return apiRequest<T>(buildUrl(path, query), { ...init, method: 'GET' });
}

/** Per als endpoints amb cos JSON, inclòs el primer accés de TG-84. */
export async function apiPost<T>(path: string, body?: unknown, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set('Content-Type', 'application/json');
  return apiRequest<T>(buildUrl(path), {
    ...init,
    method: 'POST',
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function apiRequest<T>(url: string, init: RequestInit): Promise<T> {
  // Els repositories només poden enviar el JWT a l'API configurada.
  if (new URL(url).origin !== new URL(env.apiUrl).origin) {
    throw new Error('API requests must target the configured API origin');
  }
  const headers = new Headers(init.headers);
  if (!headers.has('Accept')) headers.set('Accept', 'application/json');
  const token = await getAccessToken();
  // La sessió actual és l'única font d'autorització, també després d'un logout.
  headers.delete('Authorization');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  // ponytail: AbortController a mà; React Native no té AbortSignal.timeout ni AbortSignal.any.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const cancel = () => controller.abort();
  if (init.signal?.aborted) cancel();
  init.signal?.addEventListener('abort', cancel);
  try {
    const response = await fetch(url, { ...init, headers, signal: controller.signal });
    if (!response.ok) throw await toApiError(response);
    return (await response.json()) as T;
  } finally {
    clearTimeout(timer);
    init.signal?.removeEventListener('abort', cancel);
  }
}

async function toApiError(response: Response): Promise<ApiError> {
  try {
    // Un proxy o un error de xarxa poden respondre amb un cos que no és de l'API.
    const body = (await response.json()) as { error?: Partial<ApiErrorBody['error']> };
    return new ApiError(
      response.status,
      body.error?.code ?? 'unknown',
      body.error?.message ?? response.statusText,
    );
  } catch {
    return new ApiError(response.status, 'unknown', response.statusText);
  }
}
