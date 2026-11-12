import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking } from 'react-native';

import { colors } from '@/core/theme/tokens';

import { roundCoord } from '../explore/exploreModel';
import { useCurrentPlaceQuery } from '../explore/locationRepository';
import {
  type NearbyOrigin,
  parseQuery,
  type RecommendationParams,
} from '../recommendations/recommendationsModel';
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

/**
 * «A prop meu» (HU02) des del mapa sense cerca: `waiting` mentre es busca on és l'usuari i
 * `picking` si no se sap, per triar l'origen tocant el mapa.
 */
type Nearby = 'idle' | 'waiting' | 'picking';

/** El rànquing «A prop meu» des d'un origen: s'obre a sobre del mapa, i enrere hi torna. */
function openNearby(origin: NearbyOrigin, lat: number, lon: number, place = '') {
  router.push({
    pathname: '/recomanacions',
    params: {
      aprop: origin,
      lat: String(roundCoord(lat)),
      lon: String(roundCoord(lon)),
      // Només per a la capçalera («Des de Girona…»): no va a l'API.
      ...(place ? { lloc: place } : {}),
    },
  });
}

export function useMapViewModel() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<RecommendationParams>();
  const location = useCurrentPlaceQuery();
  const { refetch } = location;
  const place = !location.isError && location.data?.status === 'ready' ? location.data.place : null;
  const userLocation = place ? { lat: place.lat, lon: place.lon } : null;
  const [nearby, setNearby] = useState<Nearby>('idle');
  // Si mentre tria al mapa arriba la ubicació (ha donat el permís a la configuració), torna el botó.
  const mode = place && nearby === 'picking' ? 'idle' : nearby;

  /** Busca on és l'usuari (o espera la cerca en curs) i obre el rànquing; si no se sap, a triar. */
  const findMe = async () => {
    setNearby('waiting');
    const result = await refetch({ cancelRefetch: false });
    const current = result.isError ? undefined : result.data;
    if (current?.status === 'ready') {
      setNearby('idle');
      openNearby('aqui', current.place.lat, current.place.lon, current.place.name);
    } else {
      setNearby('picking');
    }
  };

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
          : points.features.some((f) => f.properties.index?.deDia)
            ? {
                kind: 'daytime' as const,
                title: t('map.daytime'),
                description: t('map.daytimeHint'),
              }
            : null;
  const denied = location.data?.status === 'denied' ? location.data : null;
  // L'origen d'un rànquing «A prop meu» triat al mapa: la ubicació de l'usuari ja es veu sola.
  const picked = params.aprop === 'triat' ? parseQuery(params) : null;

  return {
    userLocation,
    userHeading: heading,
    locationActive,
    userLocationLabel: t('map.userLocation'),
    points,
    notice,
    recommendations,
    origin: picked ? { ...picked.origen, label: t('map.origin'), color: colors.far } : null,
    nearby:
      recommendations || mode === 'picking'
        ? null
        : {
            label: t('recommendations.nearby.label'),
            hint: t('map.nearby'),
            loading: mode === 'waiting',
            onPress: () => {
              if (place) openNearby('aqui', place.lat, place.lon, place.name);
              else if (mode === 'idle') void findMe();
            },
          },
    picker:
      mode === 'picking'
        ? {
            title: t('map.pick.title'),
            description: t(denied ? 'map.pick.denied' : 'map.pick.error'),
            // Si el sistema encara ho deixa, es torna a demanar el permís; si no, a la configuració.
            action: !denied
              ? { label: t('map.retry'), onPress: () => void findMe() }
              : denied.canAskAgain
                ? { label: t('map.pick.allow'), onPress: () => void findMe() }
                : { label: t('map.pick.settings'), onPress: () => void Linking.openSettings() },
            closeLabel: t('map.pick.close'),
            onClose: () => setNearby('idle'),
          }
        : null,
    onMapPress:
      mode === 'picking'
        ? async (lat: number, lon: number) => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setNearby('idle');
            openNearby('triat', lat, lon);
          }
        : undefined,
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
