import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useCurrentPlaceQuery } from '../explore/locationRepository';
import { useRecommendationsViewModel } from '../recommendations/useRecommendationsViewModel';

import type { MapCamera } from './NightMap';
import { useMapPointsQuery } from './mapRepository';
import { EMPTY_MAP_POINTS } from './pointMarkers';
import { useDeviceHeading } from './useDeviceHeading';
import { nightStyle } from './style/nightStyle';

/**
 * Vista inicial i límits. Tota Catalunya amb la càmera inclinada perquè es vegi el relleu.
 * Les tessel·les de l'ICGC pesen molt a zoom baix (1,4 MB a z9): el mapa no s'allunya més enllà
 * de tot Catalunya. Els límits (`maxBounds`) han de ser més grans que tota la pantalla al zoom
 * mínim: MapLibre hi vol encabir la vista sencera, també la part que tapen la capçalera i el full,
 * i amb uns límits justos no deixava allunyar-se ni enquadrar un rànquing de punta a punta.
 * Constant de mòdul: el mapa es crea amb aquests valors i no es torna a muntar.
 */
export const camera: MapCamera = {
  center: [1.8, 41.75],
  zoom: 7.3,
  pitch: 50,
  minZoom: 6,
  maxZoom: 17,
  maxBounds: [-7, 35, 11, 49],
};

export function useMapViewModel() {
  const { t } = useTranslation();
  const location = useCurrentPlaceQuery();
  const userLocation =
    !location.isError && location.data?.status === 'ready'
      ? { lat: location.data.place.lat, lon: location.data.place.lon }
      : null;
  const { heading, active: locationActive } = useDeviceHeading(userLocation !== null);
  // Amb una cerca de «Què vols veure?», el mapa ensenya el rànquing i no tot el catàleg (TG-102).
  const recommendations = useRecommendationsViewModel();
  const query = useMapPointsQuery(recommendations === null);
  const points = recommendations?.points ?? query.data ?? EMPTY_MAP_POINTS;
  const isLoading =
    query.isPending || ((query.isError || points.features.length === 0) && query.isFetching);
  const notice = recommendations
    ? null
    : isLoading
      ? { kind: 'loading' as const, title: t('map.pointsLoading'), description: null }
      : query.isError
        ? { kind: 'error' as const, title: t('map.pointsError'), description: null }
        : points.features.length === 0
          ? {
              kind: 'empty' as const,
              title: t('map.pointsEmpty'),
              description: t('map.pointsEmptyHint'),
            }
          : null;
  return {
    userLocation,
    userHeading: heading,
    locationActive,
    userLocationLabel: t('map.userLocation'),
    points,
    notice,
    recommendations,
    back: { label: t('map.back'), onPress: () => router.back() },
    retryLabel: t('map.retry'),
    retry: () => {
      void query.refetch();
    },
    openPoint: async (id: string) => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      router.push({ pathname: '/punt/[id]', params: { id } });
    },
    mapStyle: nightStyle,
    camera,
    accessibilityLabel: t('map.a11y'),
  };
}
