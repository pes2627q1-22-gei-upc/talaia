import { apiPost } from '@/core/api/httpClient';

import type { ProfileHints } from './authRepository';

/** Resposta de `POST /api/v1/perfil` (TG-84); l'app només en necessita saber si és nou. */
type ProfileEnsureResponse = { created: boolean };

export const profileRepository = {
  /** Idempotent: crea el perfil el primer cop i, després, només el retorna. */
  async ensure(hints: ProfileHints = {}): Promise<{ created: boolean }> {
    const body = hints.nom ? { nom: hints.nom } : undefined;
    const { created } = await apiPost<ProfileEnsureResponse>('/perfil', body);
    return { created };
  },
};
