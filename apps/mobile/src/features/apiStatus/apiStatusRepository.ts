import type { HealthResponse } from '@talaia/shared';
import { useQuery } from '@tanstack/react-query';

import { apiGet } from '@/core/api/httpClient';

/** Claus de la memòria cau d'aquest Repository. Invalidar-ne una refresca totes les pantalles que la fan servir. */
export const apiStatusKeys = {
  health: ['health'] as const,
};

/** Crida a l'API: l'única funció de la feature que sap quina ruta i quin tipus té. */
export function fetchHealth(): Promise<HealthResponse> {
  return apiGet<HealthResponse>('/health');
}

/** Model de la feature: el ViewModel només en veu les dades i l'estat de càrrega. */
export function useHealthQuery() {
  return useQuery({ queryKey: apiStatusKeys.health, queryFn: fetchHealth });
}
