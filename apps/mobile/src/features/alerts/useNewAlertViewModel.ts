import type { ObjectiuObservacio } from '@talaia/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ApiError } from '@/core/api/httpClient';
import { GRID_GOALS, roundCoord, SOON_GOALS } from '@/features/explore/exploreModel';
import { useOriginField } from '@/features/explore/useOriginField';

import { ALERT_LIMIT_REACHED, ALERTS_KEY, alertsRepository } from './alertsRepository';
import { DISTANCE, MIN_INDEX } from './newAlertModel';

/** «Nova alerta» (HU16, mockup 11): fenomen, distància màxima des d'on ets i índex mínim. */
export function useNewAlertViewModel() {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [goal, setGoal] = useState<ObjectiuObservacio>('cel_estrellat');
  const [distance, setDistance] = useState<number>(DISTANCE.initial);
  const [minIndex, setMinIndex] = useState<number>(MIN_INDEX.initial);
  const { origin, place } = useOriginField();

  const create = useMutation({
    mutationFn: alertsRepository.create,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ALERTS_KEY });
      router.back();
    },
  });

  const submit = () => {
    if (!place || create.isPending) return;
    create.mutate({
      objectiu: goal,
      // Tres decimals (~100 m): prou per a un radi en km i no guarda on viu l'usuari exactament.
      origen: { lat: roundCoord(place.lat), lon: roundCoord(place.lon) },
      distanciaMaxKm: distance,
      indexMinim: minIndex,
    });
  };

  const error = !create.error
    ? null
    : create.error instanceof ApiError && create.error.code === ALERT_LIMIT_REACHED
      ? t('alerts.new.errors.limit')
      : t('alerts.new.errors.generic');

  return {
    title: t('alerts.new.title'),
    back: { label: t('alerts.new.back'), onPress: () => router.back() },
    goalTitle: t('alerts.new.goalTitle'),
    goals: GRID_GOALS.map((id) => {
      const soon = SOON_GOALS.includes(id);
      return {
        id,
        label: t(`explore.goals.${id}`),
        badge: soon ? t('explore.soon') : undefined,
        disabled: soon,
        selected: goal === id,
        onPress: () => {
          if (!soon) setGoal(id);
        },
      };
    }),
    originTitle: t('alerts.new.originTitle'),
    origin,
    distance: {
      title: t('alerts.new.distance.title'),
      label: t('alerts.new.distance.value', { km: distance }),
      value: distance,
      min: DISTANCE.min,
      max: DISTANCE.max,
      step: DISTANCE.step,
      minLabel: t('alerts.new.distance.value', { km: DISTANCE.min }),
      maxLabel: t('alerts.new.distance.value', { km: DISTANCE.max }),
      onChange: setDistance,
    },
    minIndex: {
      title: t('alerts.new.minIndex.title'),
      label: t('alerts.new.minIndex.value', { index: minIndex }),
      value: minIndex,
      min: MIN_INDEX.min,
      max: MIN_INDEX.max,
      step: MIN_INDEX.step,
      minLabel: String(MIN_INDEX.min),
      maxLabel: String(MIN_INDEX.max),
      hint: t('alerts.new.minIndex.hint'),
      onChange: setMinIndex,
    },
    error,
    cta: {
      label: create.isPending ? t('alerts.new.saving') : t('alerts.new.cta'),
      disabled: !place || create.isPending,
      onPress: submit,
    },
  };
}
