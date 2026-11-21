import type { PuntAdmin } from '@talaia/shared';

export class PuntsApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'PuntsApiError';
  }
}

export async function getAdminPunts(
  accessToken: string,
  signal: AbortSignal,
): Promise<PuntAdmin[]> {
  const response = await fetch('/api/v1/admin/punts', {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
    signal,
  });

  if (!response.ok) {
    throw new PuntsApiError(
      `No s'han pogut carregar els punts (${response.status})`,
      response.status,
    );
  }

  const result: unknown = await response.json();
  if (!Array.isArray(result)) {
    throw new PuntsApiError('La resposta de l’API no conté una llista de punts', response.status);
  }

  return result as PuntAdmin[];
}
