import type { Esdeveniment } from '@talaia/shared';
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { AppState, Linking } from 'react-native';

import { roundCoord } from '../explore/exploreModel';
import { useCurrentPlaceQuery } from '../explore/locationRepository';

/** TG-141: demana la ubicació només quan es prem «On veure-ho». */
export function useEventRecommendations(event: Esdeveniment | undefined) {
  const { t } = useTranslation();
  const location = useCurrentPlaceQuery(false);
  const opening = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const denied = location.data?.status === 'denied' ? location.data : null;
  const settings = denied && !denied.canAskAgain;
  const { refetch } = location;
  useEffect(() => {
    if (!settings) return;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refetch();
    });
    return () => subscription.remove();
  }, [settings, refetch]);
  return {
    label: location.isFetching
      ? t('explore.origin.locating')
      : settings
        ? t('explore.origin.settings')
        : t('event.whereToWatch'),
    disabled: location.isFetching,
    message: location.isError
      ? t('explore.origin.error')
      : denied
        ? t('explore.origin.denied')
        : null,
    onPress: async (when: string) => {
      if (!event || opening.current) return;
      if (settings) {
        await Linking.openSettings();
        return;
      }
      opening.current = true;
      try {
        const result = await location.refetch();
        if (!mounted.current || result.isError || result.data?.status !== 'ready') return;
        const { place } = result.data;
        router.push({
          pathname: '/calendari/recomanacions',
          params: {
            esdevenimentId: event.id,
            eventName: event.nom,
            eventWhen: when,
            lat: String(roundCoord(place.lat)),
            lon: String(roundCoord(place.lon)),
            ...(place.name ? { lloc: place.name } : {}),
          },
        });
      } finally {
        opening.current = false;
      }
    },
  };
}
