import { useTranslation } from 'react-i18next';

import { useCurrentPlaceQuery } from '../explore/locationRepository';

import type { MapCamera } from './NightMap';
import { useMapPointsQuery } from './mapRepository';
import { EMPTY_MAP_POINTS } from './pointMarkers';
import { useDeviceHeading } from './useDeviceHeading';
import { nightStyle } from './style/nightStyle';

/**
 * Vista inicial i límits. Tota Catalunya amb la càmera inclinada perquè es vegi el relleu.
 * Les tessel·les de l'ICGC pesen molt a zoom baix (1,4 MB a z9): el mapa no s'allunya més enllà.
 * Constant de mòdul: el mapa es crea amb aquests valors i no es torna a muntar.
 */
export const camera: MapCamera = {
  center: [1.8, 41.75],
  zoom: 7.3,
  pitch: 50,
  minZoom: 6.5,
  maxZoom: 17,
  maxBounds: [-0.2, 40.3, 3.6, 43],
};

export function useMapViewModel() {
  const { t } = useTranslation();
  const location = useCurrentPlaceQuery();
  const userLocation =
    !location.isError && location.data?.status === 'ready'
      ? { lat: location.data.place.lat, lon: location.data.place.lon }
      : null;
  const { heading, active: locationActive } = useDeviceHeading(userLocation !== null);
  const query = useMapPointsQuery();
  const points = query.data ?? EMPTY_MAP_POINTS;
  const isLoading = query.isPending || (query.isError && query.isFetching);
  const notice = isLoading
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
    retryLabel: t('map.retry'),
    retry: () => {
      void query.refetch();
    },
    mapStyle: nightStyle,
    camera,
    accessibilityLabel: t('map.a11y'),
  };
}
