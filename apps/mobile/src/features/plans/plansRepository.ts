import type { CalendariPla, EsdevenimentsResponse, Pla, PlaNou, QuanPlans } from '@talaia/shared';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { apiDelete, apiGet, apiPost, apiPut } from '@/core/api/httpClient';

import { eventWindow } from './planModel';

/** Clau de TanStack Query dels plans de l'usuari: crear-ne un la invalida («Els meus plans»). */
export const PLANS_KEY = ['plans'] as const;

/** Els plans de l'usuari autenticat (`/api/v1/plans`, TG-156): l'API treu l'usuari del JWT. */
export const plansRepository = {
  create(plan: PlaNou): Promise<Pla> {
    return apiPost<Pla>('/plans', plan);
  },
  /** HU15, TG-162. L'esdeveniment del calendari del mòbil l'esborra `planCalendarRepository`. */
  remove(id: string): Promise<void> {
    return apiDelete<void>(`/plans/${encodeURIComponent(id)}`);
  },
  linkCalendar(id: string, link: CalendariPla): Promise<void> {
    return apiPut<void>(`/plans/${encodeURIComponent(id)}/calendari`, link);
  },
  /** Futurs (del més proper al més llunyà) o passats (del més recent al més antic), TG-160. */
  list(quan: QuanPlans, signal?: AbortSignal): Promise<Pla[]> {
    return apiGet<Pla[]>('/plans', { quan }, { signal });
  },
};

/**
 * «Els meus plans»: una clau per a cada llista sota `PLANS_KEY`, de manera que crear un pla
 * (`invalidateQueries({ queryKey: PLANS_KEY })`) refresca les dues. Porta l'idioma perquè el nom
 * del punt arriba traduït. Els passats només es demanen quan l'usuari els obre (`enabled`).
 */
export function usePlansQuery(quan: QuanPlans, enabled = true) {
  const { i18n } = useTranslation();
  return useQuery({
    queryKey: [...PLANS_KEY, quan, i18n.resolvedLanguage ?? 'ca'] as const,
    queryFn: ({ signal }) => plansRepository.list(quan, signal),
    enabled,
    retry: false,
  });
}

/** Fenòmens d'un interval de dies, per posar nom als plans d'una llista (`planEventsRange`). */
export function fetchEventsBetween(from: string, to: string, signal?: AbortSignal) {
  return apiGet<EsdevenimentsResponse>('/esdeveniments', { des_de: from, fins_a: to }, { signal });
}

export function useEventsBetweenQuery(range: { from: string; to: string } | null) {
  const { i18n } = useTranslation();
  return useQuery({
    queryKey: [
      'esdeveniments',
      'plans',
      i18n.resolvedLanguage ?? 'ca',
      range?.from,
      range?.to,
    ] as const,
    queryFn: ({ signal }) => fetchEventsBetween(range!.from, range!.to, signal),
    enabled: range !== null,
    staleTime: 60 * 60 * 1000,
    retry: false,
  });
}

/** Fenòmens del calendari al voltant del dia del pla (`eventWindow`), per triar-ne un. */
export function fetchPlanEvents(date: string, signal?: AbortSignal) {
  const { from, to } = eventWindow(date);
  return apiGet<EsdevenimentsResponse>('/esdeveniments', { des_de: from, fins_a: to }, { signal });
}

export function usePlanEventsQuery(date: string) {
  return useQuery({
    queryKey: ['esdeveniments', 'plan', date] as const,
    queryFn: ({ signal }) => fetchPlanEvents(date, signal),
    staleTime: 60 * 60 * 1000,
    retry: false,
  });
}
