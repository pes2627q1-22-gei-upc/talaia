import type { Alerta, AlertaNova } from '@talaia/shared';

import { apiGet, apiPost } from '@/core/api/httpClient';

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
};
