import type { Alerta } from '@talaia/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Linking } from 'react-native';

import { travelParts } from '@/features/explore/exploreModel';
import { usePushPermission } from '@/features/notifications/PushRegistrationProvider';

import { ALERTS_KEY, alertsRepository, useAlertsQuery } from './alertsRepository';
import { kmToTravel } from './newAlertModel';

export type PushNotice = {
  message: string;
  action?: { label: string; onPress: () => void };
};

/**
 * Pestanya «Alertes» (HU19, mockup 10): les alertes de l'usuari amb l'interruptor d'activació.
 * Prémer una alerta l'obre per editar-la (HU18).
 *
 * HU17, criteri 4: sense permís de notificacions, l'app continua igual i la pantalla d'alertes
 * ho diu. «No demanat» no es mostra: el permís es demana en crear una alerta.
 */
export function useAlertsViewModel() {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const alerts = useAlertsQuery();
  const { permission } = usePushPermission();

  const setActiveInCache = (id: string, activa: boolean) =>
    queryClient.setQueryData<Alerta[]>(ALERTS_KEY, (list) =>
      list?.map((alert) => (alert.id === id ? { ...alert, activa } : alert)),
    );

  // L'interruptor canvia a l'instant (optimista); si l'API falla, només aquella alerta torna on
  // era (les altres que s'hagin tocat mentrestant es queden com estan) i ho diu.
  const toggle = useMutation({
    mutationFn: ({ id, activa }: { id: string; activa: boolean }) =>
      alertsRepository.setActive(id, activa),
    onMutate: async ({ id, activa }) => {
      await queryClient.cancelQueries({ queryKey: ALERTS_KEY });
      setActiveInCache(id, activa);
    },
    onError: (_error, { id, activa }) => setActiveInCache(id, !activa),
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

  let pushNotice: PushNotice | null = null;
  if (permission === 'denied') {
    pushNotice = {
      message: t('alerts.pushDenied'),
      action: { label: t('alerts.openSettings'), onPress: () => void Linking.openSettings() },
    };
  } else if (permission === 'unavailable') {
    pushNotice = { message: t('alerts.pushUnavailable') };
  }

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
        editHint: t('alerts.editHint'),
        onPress: () => router.push({ pathname: '/alerta/[id]', params: { id: alert.id } }),
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
    pushNotice,
  };
}
