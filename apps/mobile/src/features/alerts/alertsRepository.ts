import type { Alerta, AlertaCanvis, AlertaNova } from '@talaia/shared';
import { useQuery } from '@tanstack/react-query';

import { ApiError, apiDelete, apiGet, apiPatch, apiPost } from '@/core/api/httpClient';

/** Clau de TanStack Query de la llista d'alertes de l'usuari: crear-ne una la invalida. */
export const ALERTS_KEY = ['alertes'] as const;

/** Codi de l'API quan l'usuari ja té el màxim d'alertes (TG-145). */
export const ALERT_LIMIT_REACHED = 'alert_limit_reached';

/** Codi de l'API quan l'alerta no existeix o no és de l'usuari (TG-150). */
export const ALERT_NOT_FOUND = 'alert_not_found';

/** Les alertes de l'usuari autenticat (`/api/v1/alertes`, TG-145): l'API treu l'usuari del JWT. */
export const alertsRepository = {
  list(): Promise<Alerta[]> {
    return apiGet<Alerta[]>('/alertes');
  },

  create(alert: AlertaNova): Promise<Alerta> {
    return apiPost<Alerta>('/alertes', alert);
  },

  /**
   * Canvia una alerta (`PATCH /alertes/{id}`, TG-147): només hi van els camps que canvien. Retorna
   * l'alerta sencera ja desada.
   */
  update(id: string, canvis: AlertaCanvis): Promise<Alerta> {
    return apiPatch<Alerta>(`/alertes/${encodeURIComponent(id)}`, canvis);
  },

  /** Activa o desactiva una alerta (HU19). */
  setActive(id: string, activa: boolean): Promise<Alerta> {
    return alertsRepository.update(id, { activa });
  },

  /**
   * Elimina una alerta (`DELETE /alertes/{id}`, TG-150; HU20). Un 404 `alert_not_found` vol dir
   * que ja no hi és (p. ex. eliminada des d'un altre mòbil): el resultat és el mateix i no és un
   * error per a l'usuari.
   */
  async remove(id: string): Promise<void> {
    try {
      await apiDelete(`/alertes/${encodeURIComponent(id)}`);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404 && error.code === ALERT_NOT_FOUND) {
        return;
      }
      throw error;
    }
  },
};

/** Les alertes de l'usuari, la més nova primer (com les retorna l'API). */
export function useAlertsQuery() {
  return useQuery({ queryKey: ALERTS_KEY, queryFn: alertsRepository.list });
}
