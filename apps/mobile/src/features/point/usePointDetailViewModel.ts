import { Alert, Linking } from 'react-native';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { DireccioHoritzo, IndexHora } from '@talaia/shared';

import { ApiError } from '@/core/api/httpClient';
import { nightStyle } from '@/features/map/style/nightStyle';

import { usePointBreakdownQuery, usePointDetailQuery } from './pointRepository';
import { skyDarknessBand } from './skyDarkness';

/** Els factors de l'índex v1 (ADR-0018), en l'ordre del mockup 05. El Sol, al final. */
const FACTORS = [
  { key: 'nuvols', icon: 'cloud', label: 'clouds' },
  { key: 'foscor', icon: 'sparkle', label: 'darkness' },
  { key: 'lluna', icon: 'moon', label: 'moon' },
  { key: 'sol', icon: 'sun', label: 'sun' },
] as const;

export function usePointDetailViewModel(pointId: string) {
  const { t, i18n } = useTranslation();
  const query = usePointDetailQuery(pointId);
  const breakdown = usePointBreakdownQuery(pointId);
  const point = query.data;
  const invalidId = !pointId.trim();
  const notFound =
    invalidId || (query.error instanceof ApiError && [400, 404].includes(query.error.status));
  const status = point ? 'ok' : query.isFetching ? 'loading' : notFound ? 'notFound' : 'error';
  const locale = i18n.resolvedLanguage ?? 'ca';
  const dateTimeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        timeZone: 'Europe/Madrid',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      }),
    [locale],
  );
  const hourFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        timeZone: 'Europe/Madrid',
        hour: '2-digit',
        hourCycle: 'h23',
      }),
    [locale],
  );
  const clockFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        timeZone: 'Europe/Madrid',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      }),
    [locale],
  );
  // Desglossament d'aquesta nit (HU04, mockup 05): només les hores de nit, és a dir, les que el
  // Sol no anul·la; cada hora porta els seus factors tal com els dona l'API, de 0 a 100.
  const hours = useMemo(() => {
    const factorRows = (entry: IndexHora) =>
      FACTORS.flatMap(({ key, icon, label }) => {
        const raw = entry.factors[key];
        if (typeof raw !== 'number' || !Number.isFinite(raw)) return [];
        const value = Math.round(Math.min(1, Math.max(0, raw)) * 100);
        // El Sol només s'explica quan resta: al crepuscle.
        if (key === 'sol' && value === 100) return [];
        const level: 'tap' | 'jus' | 'ras' = value < 40 ? 'tap' : value < 70 ? 'jus' : 'ras';
        const hint =
          key === 'foscor' && entry.foscorEstimada
            ? t('point.darknessEstimated')
            : key === 'sol'
              ? t('point.factorHints.sol')
              : key === 'lluna' && value === 100
                ? t('point.factorHints.lluna.none')
                : t(`point.factorHints.${key}.${level}`);
        return [{ key, icon, label: t(`point.${label}`), hint, value, level }];
      });
    return [...(breakdown.data?.hores ?? [])]
      .filter((entry) => Number.isFinite(Date.parse(entry.hora)) && entry.factors?.sol > 0)
      .sort((a, b) => Date.parse(a.hora) - Date.parse(b.hora))
      .map((entry) => ({
        id: entry.hora,
        label: hourFormatter.format(new Date(entry.hora)),
        date: dateTimeFormatter.format(new Date(entry.hora)),
        value: Math.round(Math.min(100, Math.max(0, entry.valor))),
        level: entry.franja,
        factors: factorRows(entry),
        factorsTitle: t('point.factorsAt', { time: clockFormatter.format(new Date(entry.hora)) }),
        accessibilityLabel: t('point.hourA11y', {
          time: dateTimeFormatter.format(new Date(entry.hora)),
          value: Math.round(Math.min(100, Math.max(0, entry.valor))),
          level: t(`index.level.${entry.franja}`),
        }),
      }));
  }, [breakdown.data?.hores, clockFormatter, dateTimeFormatter, hourFormatter, t]);
  const bestPeriod = useMemo(() => {
    const best = hours.reduce<(typeof hours)[number] | undefined>(
      (current, hour) => (!current || hour.value > current.value ? hour : current),
      undefined,
    );
    return best && best.level !== 'tap'
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
          const formatTime = (timestamp: number) => clockFormatter.format(new Date(timestamp));
          return {
            from: formatTime(Date.parse(hours[first]!.id)),
            to: formatTime(finalTimestamp + duration),
            hourIds: new Set(hours.slice(first, last + 1).map((hour) => hour.id)),
          };
        })()
      : undefined;
  }, [hours, clockFormatter]);
  const displayHours = useMemo(
    () =>
      hours.map((hour) => ({
        ...hour,
        isBest: bestPeriod?.hourIds.has(hour.id) ?? false,
        accessibilityLabel: bestPeriod?.hourIds.has(hour.id)
          ? t('point.bestHourWithStatusA11y', { label: hour.accessibilityLabel })
          : hour.accessibilityLabel,
      })),
    [hours, bestPeriod, t],
  );
  const bestWindow = bestPeriod ? { from: bestPeriod.from, to: bestPeriod.to } : undefined;
  // Per defecte, la millor hora de la nit (la primera si n'hi ha d'empatades).
  const defaultHourId = hours.reduce<(typeof hours)[number] | undefined>(
    (best, hour) => (!best || hour.value > best.value ? hour : best),
    undefined,
  )?.id;
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
          time: dateTimeFormatter.format(new Date(indexTime)),
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
    skyDarkness:
      point?.sqm == null || !Number.isFinite(point.sqm)
        ? undefined
        : t('point.sqmValue', {
            value: point.sqm.toLocaleString(locale, { maximumFractionDigits: 2 }),
          }),
    skyDarknessLabel: t('point.sqmLabel'),
    skyDarknessQuality:
      point?.sqm == null || !Number.isFinite(point.sqm)
        ? undefined
        : t(`point.sqmQuality.${skyDarknessBand(point.sqm)}`),
    skyDarknessHint: t('point.sqmHint'),
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
    hoursLabel: t('point.tonight'),
    timezoneLabel: t('point.timezone'),
    noHours: t('point.noHours'),
    hours: displayHours,
    defaultHourId,
    hoursLoading: breakdown.isPending,
    hoursError: breakdown.isError && !breakdown.data ? t('point.hoursError') : undefined,
    errorTitle: notFound ? t('point.notFoundTitle') : t('point.errorTitle'),
    errorMessage: notFound ? t('point.notFoundMessage') : t('point.errorMessage'),
    staleMessage: point && query.isError ? t('point.refreshError') : undefined,
    retryLabel: t('point.retry'),
    refreshing: query.isFetching,
    retry: () => {
      if (invalidId) return;
      void query.refetch();
      void breakdown.refetch();
    },
  };
}
