import type { IndexVisibilitat } from '@talaia/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ApiError } from '@/core/api/httpClient';

import type { Place } from '../explore/locationRepository';
import { elision, formatTravel, localTime } from '../recommendations/recommendationsModel';

import { type Spot, useVisibilityQuery } from './visibilityRepository';

const EARTH_RADIUS_KM = 6371;
const toRad = (degrees: number) => (degrees * Math.PI) / 180;

/** Distància en línia recta (haversine), en km. */
export function distanceKm(a: Spot, b: Spot): number {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

// ponytail: la mateixa estimació que l'API (`services/api/src/recomanacions/rutes.ts`: 60 km/h i
// ×1,3 de desviament). Quan arribi Mobilicat, el temps l'haurà de donar l'API.
export const travelMinutes = (km: number) => Math.round(((km * 1.3) / 60) * 60);

export type SpotState =
  | { kind: 'idle'; action: { label: string; onPress: () => void } }
  | { kind: 'loading'; label: string }
  /** `index` és `null` de dia: el Sol encara no s'ha post i l'índex no diu res del cel. */
  | { kind: 'result'; index: IndexVisibilitat | null; at: string; notes: string[] }
  | {
      kind: 'problem';
      title: string;
      description: string;
      action: { label: string; onPress: () => void } | null;
    };

/**
 * Un lloc qualsevol tocat al mapa i el seu índex a l'hora en curs (HU05, mockup 04). L'índex no es
 * demana fins que l'usuari prem «Calcula l'índex aquí»: cada consulta nova compta per al límit
 * horari de l'API (20 per client).
 */
export function useMapSpot(place: Place | null) {
  const { t, i18n } = useTranslation();
  const [spot, setSpot] = useState<Spot | null>(null);
  const [requested, setRequested] = useState(false);
  const query = useVisibilityQuery(requested ? spot : null);

  const pick = (lat: number, lon: number) => {
    setSpot({ lat, lon });
    setRequested(false);
  };
  const clear = () => {
    setSpot(null);
    setRequested(false);
  };

  if (!spot) return { spot: null, card: null, pick, clear };

  const coord = new Intl.NumberFormat(i18n.language, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const travel = place ? formatTravel(t, travelMinutes(distanceKm(place, spot))) : null;

  const state: SpotState = (() => {
    if (!requested) {
      return {
        kind: 'idle',
        action: { label: t('map.spot.calculate'), onPress: () => setRequested(true) },
      };
    }
    if (query.data) {
      const { index, deDia } = query.data;
      const notes = [
        ...(deDia ? [t('map.spot.daytime')] : []),
        ...(index.foscorEstimada ? [t('map.spot.estimated')] : []),
      ];
      return {
        kind: 'result',
        index: deDia ? null : { valor: index.valor, franja: index.franja },
        at: t('map.spot.at', { time: localTime(index.hora) }),
        notes,
      };
    }
    if (query.isError) {
      const code = query.error instanceof ApiError ? query.error.code : null;
      if (code === 'fora_de_catalunya') {
        return {
          kind: 'problem',
          title: t('map.spot.outside.title'),
          description: t('map.spot.outside.description'),
          action: null,
        };
      }
      if (code === 'too_many_requests') {
        return {
          kind: 'problem',
          title: t('map.spot.limit.title'),
          description: t('map.spot.limit.description'),
          action: null,
        };
      }
      return {
        kind: 'problem',
        title: t('map.spot.error.title'),
        description: t('map.spot.error.description'),
        action: { label: t('map.retry'), onPress: () => void query.refetch() },
      };
    }
    return { kind: 'loading', label: t('map.spot.loading') };
  })();

  return {
    spot,
    card: {
      title: t('map.spot.title'),
      coords: t('map.spot.coords', { lat: coord.format(spot.lat), lon: coord.format(spot.lon) }),
      travel: !travel
        ? null
        : place?.name
          ? t('map.spot.from', { travel, place: place.name, context: elision(place.name) })
          : t('map.spot.fromHere', { travel }),
      closeLabel: t('map.pick.close'),
      onClose: clear,
      state,
    },
    pick,
    clear,
  };
}
