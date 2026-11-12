import type { Alerta, AlertaNova } from '@talaia/shared';

import { useQuery } from '@tanstack/react-query';

import { apiGet, apiPatch, apiPost } from '@/core/api/httpClient';

/** Clau de TanStack Query de la llista d'alertes de l'usuari: crear-ne una la invalida. */
export const ALERTS_KEY = ['alertes'] as const;

/** Codi de l'API quan l'usuari ja té el màxim d'alertes (TG-145). */
export const ALERT_LIMIT_REACHED = 'alert_limit_reached';

/** Les alertes de l'usuari autenticat (`/api/v1/alertes`, TG-145): l'API treu l'usuari del JWT. */
export const alertsRepository = {
  list(): Promise<Alerta[]> {
    return apiGet<Alerta[]>('/alertes');
  },

  create(alert: AlertaNova): Promise<Alerta> {
    return apiPost<Alerta>('/alertes', alert);
  },

  /** Activa o desactiva una alerta (`PATCH /alertes/{id}`, TG-147). */
  setActive(id: string, activa: boolean): Promise<Alerta> {
    return apiPatch<Alerta>(`/alertes/${encodeURIComponent(id)}`, { activa });
  },
};

/** Les alertes de l'usuari, la més nova primer (com les retorna l'API). */
export function useAlertsQuery() {
  return useQuery({ queryKey: ALERTS_KEY, queryFn: alertsRepository.list });
}
