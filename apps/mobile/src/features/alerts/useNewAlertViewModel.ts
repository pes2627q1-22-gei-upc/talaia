import type { ObjectiuObservacio } from '@talaia/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ApiError } from '@/core/api/httpClient';
import {
  formatHour,
  GRID_GOALS,
  HOURS,
  roundCoord,
  SOON_GOALS,
  TRAVEL,
  travelParts,
} from '@/features/explore/exploreModel';
import { placeName } from '@/features/explore/locationRepository';
import { useOriginField } from '@/features/explore/useOriginField';
import { nightStyle } from '@/features/map/style/nightStyle';
import { camera } from '@/features/map/useMapViewModel';

import { ALERT_LIMIT_REACHED, ALERTS_KEY, alertsRepository } from './alertsRepository';
import { bandOf, DEFAULT_NOTIFY_HOUR, INDEX_BANDS, MIN_INDEX, travelToKm } from './newAlertModel';

type Coordinates = { lat: number; lon: number };
type Zone = Coordinates & { name: string };

const ORIGIN_MODES = ['current', 'zone'] as const;
type OriginMode = (typeof ORIGIN_MODES)[number];

/** Prou a prop per triar un municipi quan el mapa ja surt centrat en un lloc. */
const ZONE_ZOOM = 10;

/** «Nova alerta» (HU16, mockup 11): fenomen, des d'on, fins on, índex mínim i quan avisar. */
export function useNewAlertViewModel() {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [goal, setGoal] = useState<ObjectiuObservacio>('cel_estrellat');
  const [originMode, setOriginMode] = useState<OriginMode>('current');
  const [zone, setZone] = useState<Zone | null>(null);
  const [zoneOpen, setZoneOpen] = useState(false);
  const [zoneDraft, setZoneDraft] = useState<Coordinates | null>(null);
  const [zoneNaming, setZoneNaming] = useState(false);
  const [travel, setTravel] = useState<number>(TRAVEL.initial);
  const [minIndex, setMinIndex] = useState<number>(MIN_INDEX.initial);
  const [notifyOnReach, setNotifyOnReach] = useState(false);
  const [notifyAtHour, setNotifyAtHour] = useState(true);
  const [notifyHour, setNotifyHour] = useState(DEFAULT_NOTIFY_HOUR);
  const [hourOpen, setHourOpen] = useState(false);
  const { origin: current, place } = useOriginField();

  // On comença el mapa de la zona: la triada abans, on és l'usuari o tota Catalunya.
  const zoneStart = zone ?? place;
  const mapStart = zoneStart
    ? { center: { lat: zoneStart.lat, lon: zoneStart.lon }, zoom: ZONE_ZOOM }
    : { center: { lat: camera.center[1], lon: camera.center[0] }, zoom: camera.zoom };

  const originPoint: Coordinates | null = originMode === 'current' ? place : zone;
  const notifyChosen = notifyOnReach || notifyAtHour;

  const create = useMutation({
    mutationFn: alertsRepository.create,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ALERTS_KEY });
      router.back();
    },
  });

  const submit = () => {
    if (!originPoint || !notifyChosen || create.isPending) return;
    create.mutate({
      objectiu: goal,
      // Tres decimals (~100 m): prou per a un radi en km i no guarda on viu l'usuari exactament.
      origen: { lat: roundCoord(originPoint.lat), lon: roundCoord(originPoint.lon) },
      distanciaMaxKm: travelToKm(travel),
      indexMinim: minIndex,
      avisaEnArribar: notifyOnReach,
      horaAvis: notifyAtHour ? notifyHour : null,
    });
  };

  const confirmZone = async () => {
    const picked = zoneDraft ?? mapStart.center;
    setZoneNaming(true);
    const name = await placeName(picked.lat, picked.lon);
    setZone({ ...picked, name });
    setZoneNaming(false);
    setZoneOpen(false);
  };

  const zoneField = zone
    ? {
        state: 'ready' as const,
        label: zone.name || t('alerts.new.zone.unnamed'),
        hint: t('alerts.new.zone.change'),
        onPress: () => setZoneOpen(true),
      }
    : {
        state: 'empty' as const,
        label: t('alerts.new.zone.empty'),
        hint: t('alerts.new.zone.pick'),
        onPress: () => setZoneOpen(true),
      };

  const { hours, minutes } = travelParts(travel);
  const travelLabel = !hours
    ? t('alerts.new.travel.minutes', { minutes })
    : minutes
      ? t('alerts.new.travel.hoursMinutes', { hours, minutes })
      : t('alerts.new.travel.hours', { hours });
  const band = bandOf(minIndex);

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
    originModes: {
      options: ORIGIN_MODES.map((mode) => t(`alerts.new.originModes.${mode}`)),
      selectedIndex: ORIGIN_MODES.indexOf(originMode),
      onChange: (index: number) => {
        const mode = ORIGIN_MODES[index] ?? 'current';
        setOriginMode(mode);
        // La primera vegada que es tria una zona, el mapa s'obre de seguida.
        if (mode === 'zone' && !zone) setZoneOpen(true);
      },
    },
    origin: originMode === 'current' ? current : zoneField,
    zoneSheet: {
      visible: zoneOpen,
      title: t('alerts.new.zone.title'),
      hint: t('alerts.new.zone.hint'),
      mapLabel: t('alerts.new.zone.map'),
      mapStyle: nightStyle,
      center: mapStart.center,
      zoom: mapStart.zoom,
      // El pont DOM espera una funció asíncrona.
      onCenterChange: async (center: Coordinates) => setZoneDraft(center),
      confirm: {
        label: zoneNaming ? t('alerts.new.zone.naming') : t('alerts.new.zone.confirm'),
        disabled: zoneNaming,
        onPress: () => void confirmZone(),
      },
      closeLabel: t('alerts.new.zone.close'),
      onClose: () => setZoneOpen(false),
    },
    travel: {
      title: t('alerts.new.travel.title'),
      label: travelLabel,
      value: travel,
      min: TRAVEL.min,
      max: TRAVEL.max,
      step: TRAVEL.step,
      minLabel: t('explore.travel.min'),
      maxLabel: t('explore.travel.max'),
      onChange: setTravel,
    },
    minIndex: {
      title: t('alerts.new.minIndex.title'),
      label: t('alerts.new.minIndex.value', {
        index: minIndex,
        level: t(`index.level.${band}`).toLowerCase(),
      }),
      color: band,
      value: minIndex,
      min: MIN_INDEX.min,
      max: MIN_INDEX.max,
      step: MIN_INDEX.step,
      segments: INDEX_BANDS,
      minLabel: String(MIN_INDEX.min),
      maxLabel: String(MIN_INDEX.max),
      onChange: setMinIndex,
    },
    notifyTitle: t('alerts.new.notify.title'),
    notifyOptions: [
      {
        id: 'reach' as const,
        label: t('alerts.new.notify.onReach'),
        selected: notifyOnReach,
        onPress: () => setNotifyOnReach((on) => !on),
      },
      {
        id: 'hour' as const,
        label: t('alerts.new.notify.atHour'),
        selected: notifyAtHour,
        onPress: () => setNotifyAtHour((on) => !on),
      },
    ],
    notifyHour: notifyAtHour
      ? {
          label: t('alerts.new.notify.hourValue', { hour: formatHour(notifyHour) }),
          hint: t('alerts.new.notify.change'),
          onPress: () => setHourOpen(true),
        }
      : null,
    notifyHint: notifyChosen ? null : t('alerts.new.notify.required'),
    hourSheet: {
      visible: hourOpen,
      title: t('alerts.new.notify.hourTitle'),
      hours: HOURS,
      format: formatHour,
      value: notifyHour,
      onChange: setNotifyHour,
      doneLabel: t('alerts.new.notify.done'),
      onClose: () => setHourOpen(false),
    },
    error,
    cta: {
      label: create.isPending ? t('alerts.new.saving') : t('alerts.new.cta'),
      disabled: !originPoint || !notifyChosen || create.isPending,
      onPress: submit,
    },
  };
}
