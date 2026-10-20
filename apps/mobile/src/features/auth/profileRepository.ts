import { apiPost } from '@/core/api/httpClient';

/** Resposta de `POST /api/v1/perfil` (TG-84); l'app només en necessita saber si és nou. */
type ProfileEnsureResponse = { created: boolean };

export const profileRepository = {
  /** Idempotent: crea el perfil el primer cop i, després, només el retorna. */
  async ensure(): Promise<{ created: boolean }> {
    const { created } = await apiPost<ProfileEnsureResponse>('/perfil');
    return { created };
  },
};
