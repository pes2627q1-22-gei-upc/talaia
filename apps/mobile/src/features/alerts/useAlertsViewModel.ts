import type { Alerta } from '@talaia/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { travelParts } from '@/features/explore/exploreModel';

import { ALERTS_KEY, alertsRepository, useAlertsQuery } from './alertsRepository';
import { kmToTravel } from './newAlertModel';

/** Pestanya «Alertes» (HU19, mockup 10): les alertes de l'usuari amb l'interruptor d'activació. */
export function useAlertsViewModel() {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const alerts = useAlertsQuery();

  // L'interruptor canvia a l'instant (optimista); si l'API falla, torna on era i ho diu.
  const toggle = useMutation({
    mutationFn: ({ id, activa }: { id: string; activa: boolean }) =>
      alertsRepository.setActive(id, activa),
    onMutate: async ({ id, activa }) => {
      await queryClient.cancelQueries({ queryKey: ALERTS_KEY });
      const previous = queryClient.getQueryData<Alerta[]>(ALERTS_KEY);
      queryClient.setQueryData<Alerta[]>(ALERTS_KEY, (list) =>
        list?.map((alert) => (alert.id === id ? { ...alert, activa } : alert)),
      );
      return { previous };
    },
    onError: (_error, _vars, context) => {
      queryClient.setQueryData(ALERTS_KEY, context?.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ALERTS_KEY }),
  });

  const travelLabel = (km: number) => {
    const { hours, minutes } = travelParts(kmToTravel(km));
    return !hours
      ? t('alerts.new.travel.minutes', { minutes })
      : minutes
        ? t('alerts.new.travel.hoursMinutes', { hours, minutes })
        : t('alerts.new.travel.hours', { hours });
  };

  const state = alerts.isPending
    ? ('loading' as const)
    : alerts.isError
      ? ('error' as const)
      : alerts.data.length === 0
        ? ('empty' as const)
        : ('list' as const);

  return {
    title: t('alerts.title'),
    subtitle: t('alerts.subtitle'),
    state,
    items: (alerts.data ?? []).map((alert) => {
      const name = t(`explore.goals.${alert.objectiu}`);
      return {
        id: alert.id,
        goal: alert.objectiu,
        name,
        summary: t('alerts.summary', {
          travel: travelLabel(alert.distanciaMaxKm),
          index: alert.indexMinim,
        }),
        active: alert.activa,
        toggleLabel: t('alerts.toggle', { name }),
        onToggle: (activa: boolean) => toggle.mutate({ id: alert.id, activa }),
      };
    }),
    toggleError: toggle.isError ? t('alerts.toggleError') : null,
    empty: { title: t('alerts.emptyTitle'), message: t('alerts.emptyMessage') },
    error: {
      title: t('alerts.errorTitle'),
      retry: { label: t('alerts.retry'), onPress: () => void alerts.refetch() },
    },
    create: { label: t('alerts.create'), onPress: () => router.push('/nova-alerta') },
  };
}
