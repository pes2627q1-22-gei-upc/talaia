import type { UsuariAdmin, UsuariAdminCanvis } from '@talaia/shared';

export class UsersApiError extends Error {
  constructor(
    readonly status: number,
    readonly code?: string,
  ) {
    super(`La petició ha fallat (${status})`);
    this.name = 'UsersApiError';
  }
}

async function responseError(response: Response): Promise<UsersApiError> {
  const body: unknown = await response.json().catch(() => null);
  const error = body && typeof body === 'object' && 'error' in body ? body.error : null;
  const code =
    error && typeof error === 'object' && 'code' in error && typeof error.code === 'string'
      ? error.code
      : undefined;
  return new UsersApiError(response.status, code);
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
  if (!response.ok) throw await responseError(response);
  const users: unknown = await response.json();
  if (!Array.isArray(users)) throw new Error('La resposta no conté una llista d’usuaris');
  return users as UsuariAdmin[];
}

export async function patchAdminUser(
  accessToken: string,
  id: string,
  changes: UsuariAdminCanvis,
): Promise<UsuariAdmin> {
  const response = await fetch(`/api/v1/admin/usuaris/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    cache: 'no-store',
    body: JSON.stringify(changes),
  });
  if (!response.ok) throw await responseError(response);
  const user: unknown = await response.json();
  if (
    !user ||
    typeof user !== 'object' ||
    !('id' in user) ||
    user.id !== id ||
    !('bloquejat' in user) ||
    user.bloquejat !== changes.bloquejat
  ) {
    throw new Error('La resposta no confirma el canvi');
  }
  return user as UsuariAdmin;
}
