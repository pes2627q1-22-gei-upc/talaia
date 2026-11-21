import type { UsuariAdmin } from '@talaia/shared';

export class UsersApiError extends Error {
  constructor(readonly status: number) {
    super(`La petició ha fallat (${status})`);
    this.name = 'UsersApiError';
  }
}

export async function getAdminUsers(
  accessToken: string,
  signal: AbortSignal,
): Promise<UsuariAdmin[]> {
  const response = await fetch('/api/v1/admin/usuaris', {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
    signal,
  });
  if (!response.ok) throw new UsersApiError(response.status);
  const users: unknown = await response.json();
  if (!Array.isArray(users)) throw new Error('La resposta no conté una llista d’usuaris');
  return users as UsuariAdmin[];
}
