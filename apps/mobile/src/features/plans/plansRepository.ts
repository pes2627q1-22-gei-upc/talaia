import type { EsdevenimentsResponse, Pla, PlaNou } from '@talaia/shared';
import { useQuery } from '@tanstack/react-query';

import { apiGet, apiPost } from '@/core/api/httpClient';

import { eventWindow } from './planModel';

/** Clau de TanStack Query dels plans de l'usuari: crear-ne un la invalida («Els meus plans»). */
export const PLANS_KEY = ['plans'] as const;

/** Els plans de l'usuari autenticat (`/api/v1/plans`, TG-156): l'API treu l'usuari del JWT. */
export const plansRepository = {
  create(plan: PlaNou): Promise<Pla> {
    return apiPost<Pla>('/plans', plan);
  },
};

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
