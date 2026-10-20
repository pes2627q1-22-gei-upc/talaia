import { Alert, Linking } from 'react-native';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { DireccioHoritzo } from '@talaia/shared';

import { ApiError } from '@/core/api/httpClient';
import { nightStyle } from '@/features/map/style/nightStyle';

import { usePointDetailQuery } from './pointRepository';

export function usePointDetailViewModel(pointId: string) {
  const { t, i18n } = useTranslation();
  const query = usePointDetailQuery(pointId);
  const point = query.data;
  const invalidId = !pointId.trim();
  const notFound =
    invalidId || (query.error instanceof ApiError && [400, 404].includes(query.error.status));
  const status = point ? 'ok' : query.isFetching ? 'loading' : notFound ? 'notFound' : 'error';
  const locale = i18n.resolvedLanguage ?? 'ca';
  const hours = useMemo(() => {
    const formatter = new Intl.DateTimeFormat(locale, {
      timeZone: 'Europe/Madrid',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
    const time = new Intl.DateTimeFormat(locale, {
      timeZone: 'Europe/Madrid',
      hour: '2-digit',
      hourCycle: 'h23',
    });
    return [...(point?.properesHores ?? [])]
      .filter((entry) => Number.isFinite(Date.parse(entry.hora)))
      .sort((a, b) => Date.parse(a.hora) - Date.parse(b.hora))
      .map((entry) => ({
        id: entry.hora,
        label: time.format(new Date(entry.hora)),
        date: formatter.format(new Date(entry.hora)),
        value: Math.round(Math.min(100, Math.max(0, entry.valor))),
        level: entry.franja,
        accessibilityLabel: t('point.hourA11y', {
          time: formatter.format(new Date(entry.hora)),
          value: Math.round(Math.min(100, Math.max(0, entry.valor))),
          level: t(`index.level.${entry.franja}`),
        }),
      }));
  }, [point?.properesHores, locale, t]);
  const best = hours.reduce<(typeof hours)[number] | undefined>(
    (current, hour) => (!current || hour.value > current.value ? hour : current),
    undefined,
  );
  const bestPeriod =
    best && best.level !== 'tap'
      ? (() => {
          const bestIndex = hours.findIndex((hour) => hour.id === best.id);
          let first = bestIndex;
          let last = bestIndex;
          while (
            first > 0 &&
            hours[first - 1]?.level === best.level &&
            Date.parse(hours[first]!.id) - Date.parse(hours[first - 1]!.id) <= 90 * 60 * 1000
          ) {
            first -= 1;
          }
          while (
            last < hours.length - 1 &&
            hours[last + 1]?.level === best.level &&
            Date.parse(hours[last + 1]!.id) - Date.parse(hours[last]!.id) <= 90 * 60 * 1000
          ) {
            last += 1;
          }
          const finalTimestamp = Date.parse(hours[last]!.id);
          const previousTimestamp = last > first ? Date.parse(hours[last - 1]!.id) : undefined;
          const duration = previousTimestamp ? finalTimestamp - previousTimestamp : 60 * 60 * 1000;
          const formatTime = (timestamp: number) =>
            new Intl.DateTimeFormat(locale, {
              timeZone: 'Europe/Madrid',
              hour: '2-digit',
              minute: '2-digit',
              hourCycle: 'h23',
            }).format(new Date(timestamp));
          return {
            from: formatTime(Date.parse(hours[first]!.id)),
            to: formatTime(finalTimestamp + duration),
            hourIds: new Set(hours.slice(first, last + 1).map((hour) => hour.id)),
          };
        })()
      : undefined;
  const bestWindow = bestPeriod ? { from: bestPeriod.from, to: bestPeriod.to } : undefined;
  const factorRows = (
    [
      { key: 'nuvols', icon: 'cloud', label: 'clouds', hint: 'cloudsHint' },
      { key: 'sol', icon: 'sun', label: 'sun', hint: 'sunHint' },
      { key: 'foscor', icon: 'sparkle', label: 'darkness', hint: 'darknessHint' },
      { key: 'lluna', icon: 'moon', label: 'moon', hint: 'moonHint' },
    ] as const
  ).flatMap(({ key, icon, label, hint }) => {
    const raw = point?.indexActual?.factors[key];
    if (typeof raw !== 'number' || !Number.isFinite(raw)) return [];
    const value = Math.round(Math.min(1, Math.max(0, raw)) * 100);
    const level: 'tap' | 'jus' | 'ras' = value < 40 ? 'tap' : value < 70 ? 'jus' : 'ras';
    return [
      {
        key,
        icon,
        label: t(`point.${label}`),
        hint:
          key === 'foscor' && point?.indexActual?.foscorEstimada
            ? t('point.darknessEstimated')
            : t(`point.${hint}`),
        value,
        level,
      },
    ];
  });
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const altitude =
    point?.altitud == null
      ? t('point.unavailable')
      : t('point.metres', { value: number.format(point.altitud) });
  const directionLabels: Record<DireccioHoritzo, string> = {
    N: t('point.directionN'),
    NE: t('point.directionNE'),
    E: t('point.directionE'),
    SE: t('point.directionSE'),
    S: t('point.directionS'),
    SW: t('point.directionSW'),
    W: t('point.directionW'),
    NW: t('point.directionNW'),
  };
  const horizonDirections = point?.horitzoObert?.map((direction) => {
    return directionLabels[direction];
  });
  const horizonList = horizonDirections?.length
    ? horizonDirections.length === 1
      ? horizonDirections[0]
      : `${horizonDirections.slice(0, -1).join(', ')} ${t('point.listAnd')} ${horizonDirections.at(-1)}`
    : undefined;
  const indexTime = point?.indexActual?.hora;
  const currentLabel =
    indexTime && Number.isFinite(Date.parse(indexTime))
      ? t('point.indexAt', {
          time: new Intl.DateTimeFormat(locale, {
            timeZone: 'Europe/Madrid',
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
            hourCycle: 'h23',
          }).format(new Date(indexTime)),
        })
      : t('point.currentIndex');
  return {
    status,
    title: point?.nom ?? t('point.title'),
    municipality: point?.municipi,
    coordinates: point ? { lat: point.lat, lon: point.lon } : undefined,
    mapLabel: t('point.mapA11y', { name: point?.nom }),
    mapCreditsLabel: t('point.mapCredits'),
    mapStyle: nightStyle,
    mapUnavailable: t('point.mapUnavailable'),
    currentIndex: point?.indexActual ?? null,
    currentLevel: point?.indexActual ? t(`index.level.${point.indexActual.franja}`) : undefined,
    currentLabel,
    noIndex: t('point.noIndex'),
    bestWindow,
    altitude,
    altitudeTag: t('point.altitudeTag', { value: altitude }),
    factorRows,
    pointInfoLabel: t('point.info'),
    horizonLabel: t('point.openHorizon'),
    horizon: horizonList ? t('point.openHorizonValue', { directions: horizonList }) : undefined,
    descriptionLabel: t('point.description'),
    description: point?.descripcio?.trim(),
    accessibilityLabel: t('point.accessibility'),
    accessibility: point?.accessibilitat?.trim(),
    directionsLabel: t('point.directions'),
    createPlanLabel: t('point.createPlan'),
    openDirections: () => {
      if (!point) return;
      const destination = `${point.lat},${point.lon}`;
      void Linking.openURL(
        `https://www.google.com/maps/dir/?api=1&destination=${destination}`,
      ).catch(() => Alert.alert(t('point.mapsErrorTitle'), t('point.mapsErrorMessage')));
    },
    createPlan: () => Alert.alert(t('point.planSoonTitle'), t('point.planSoonMessage')),
    hoursLabel: t('point.nextHours'),
    timezoneLabel: t('point.timezone'),
    noHours: t('point.noHours'),
    hours: hours.map((hour) => ({
      ...hour,
      isBest: bestPeriod?.hourIds.has(hour.id) ?? false,
      accessibilityLabel: bestPeriod?.hourIds.has(hour.id)
        ? t('point.bestHourWithStatusA11y', { label: hour.accessibilityLabel })
        : hour.accessibilityLabel,
    })),
    errorTitle: notFound ? t('point.notFoundTitle') : t('point.errorTitle'),
    errorMessage: notFound ? t('point.notFoundMessage') : t('point.errorMessage'),
    staleMessage: point && query.isError ? t('point.refreshError') : undefined,
    retryLabel: t('point.retry'),
    refreshing: query.isFetching,
    retry: () => {
      if (!invalidId) void query.refetch();
    },
  };
}
