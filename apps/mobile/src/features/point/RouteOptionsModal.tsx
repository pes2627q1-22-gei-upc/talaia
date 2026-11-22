import { Image } from 'expo-image';
import type { AlternativaRuta, ModeRuta } from '@talaia/shared';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, ScrollView, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { makeStyles, useNightTint, useTheme } from '@/core/theme/theme';
import { fonts, radii, sizes, spacing } from '@/core/theme/tokens';
import { AppText } from '@/shared/ui/AppText';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { PressableScale } from '@/shared/ui/PressableScale';

import { RouteDepartureControl, RouteDeparturePicker } from './RouteDeparturePicker';

const backIcon = require('@/assets/images/event/back.svg');
const chevronDownIcon = require('@/assets/images/calendar/chevron-down.svg');
const infoIcon = require('@/assets/images/point/info.svg');
const routeDate = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Madrid',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function daysAfterDeparture(departure: string, arrival: string): number {
  const calendarDay = (instant: string) => {
    const parts = routeDate.formatToParts(new Date(instant));
    const value = (type: string) => Number(parts.find((part) => part.type === type)?.value);
    return Date.UTC(value('year'), value('month') - 1, value('day'));
  };
  return Math.max(0, Math.round((calendarDay(arrival) - calendarDay(departure)) / 86_400_000));
}
const modeIcons: Record<ModeRuta, number> = {
  WALK: require('@/assets/images/point/route-walk.svg'),
  BIKE: require('@/assets/images/point/route-bike.svg'),
  BIKE_SHARE: require('@/assets/images/point/route-bike.svg'),
  CAR: require('@/assets/images/point/route-car.svg'),
  PUBLIC_TRANSPORT: require('@/assets/images/point/route-transit.svg'),
};

type Props = {
  visible: boolean;
  alternatives: AlternativaRuta[];
  departure?: string;
  onDepartureChange: (departure?: string) => void;
  loading: boolean;
  error: boolean;
  onClose: () => void;
  onOpenMaps: () => void;
};

/** Mobilicat dona les opcions; el mapa del mòbil calcula la navegació per separat. */
export function RouteOptionsModal({
  visible,
  alternatives,
  departure,
  onDepartureChange,
  loading,
  error,
  onClose,
  onOpenMaps,
}: Props) {
  const { t, i18n } = useTranslation();
  const nightTint = useNightTint();
  const { colors } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editingDeparture, setEditingDeparture] = useState(false);
  const locale = i18n.resolvedLanguage ?? 'ca';
  const distance = useMemo(
    () => new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }),
    [locale],
  );
  const arrival = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        timeZone: 'Europe/Madrid',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      }),
    [locale],
  );
  const modeNames: Record<ModeRuta, string> = {
    WALK: t('point.routeMode.walk'),
    BIKE: t('point.routeMode.bike'),
    BIKE_SHARE: t('point.routeMode.bikeShare'),
    CAR: t('point.routeMode.car'),
    PUBLIC_TRANSPORT: t('point.routeMode.publicTransport'),
  };
  const transitNameFor = (mode: string) => {
    switch (mode.toUpperCase()) {
      case 'RAIL':
        return t('point.routeTransitMode.rail');
      case 'SUBWAY':
      case 'METRO':
        return t('point.routeTransitMode.metro');
      case 'TRAM':
        return t('point.routeTransitMode.tram');
      case 'BUS':
        return t('point.routeTransitMode.bus');
      case 'FERRY':
        return t('point.routeTransitMode.ferry');
      default:
        return mode;
    }
  };

  const back = () => {
    if (editingDeparture) setEditingDeparture(false);
    else onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={back} statusBarTranslucent>
      <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.root}>
        <View
          style={[
            styles.header,
            { paddingTop: Math.max(insets.top, spacing.xl + spacing.lg) + spacing.md },
          ]}
        >
          <PressableScale
            onPress={back}
            accessibilityLabel={t(
              editingDeparture ? 'point.routeDeparturePickerBack' : 'point.routeOptionsBack',
            )}
            style={styles.back}
          >
            <Image
              source={backIcon}
              tintColor={nightTint}
              style={styles.backIcon}
              accessible={false}
            />
          </PressableScale>
        </View>
        <ScrollView
          key={editingDeparture ? 'departure' : 'routes'}
          contentContainerStyle={styles.list}
        >
          {editingDeparture ? (
            <View style={styles.departureForm}>
              <View style={styles.intro}>
                <AppText variant="display" accessibilityRole="header">
                  {t('point.routeDeparturePickerTitle')}
                </AppText>
                <AppText variant="small" color="boira">
                  {t('point.timezone')}
                </AppText>
              </View>
              <RouteDeparturePicker
                departure={departure}
                onChange={(next) => {
                  onDepartureChange(next);
                  setEditingDeparture(false);
                }}
              />
            </View>
          ) : (
            <>
              <View style={styles.intro}>
                <AppText variant="display" accessibilityRole="header">
                  {t('point.routeOptionsTitle')}
                </AppText>
                <AppText variant="small" color="boira">
                  {t('point.routeOptionsIntro')}
                </AppText>
                <RouteDepartureControl
                  departure={departure}
                  onPress={() => setEditingDeparture(true)}
                />
              </View>
              {loading ? (
                <AppText variant="small" color="boira">
                  {t('point.routeLoading')}
                </AppText>
              ) : error || alternatives.length === 0 ? (
                <AppText variant="small" color="boira">
                  {t('point.routeNoResults')}
                </AppText>
              ) : (
                alternatives.map((route, index) => {
                  const orderedStretches = [...route.trams].sort((a, b) => a.sequence - b.sequence);
                  const mode =
                    orderedStretches.find((stretch) => stretch.mode !== 'WALK')?.mode ?? 'WALK';
                  const stages = orderedStretches.map((stretch) =>
                    stretch.mode === 'PUBLIC_TRANSPORT' && stretch.lineShortName
                      ? stretch.lineShortName
                      : modeNames[stretch.mode],
                  );
                  const summary = stages.filter(
                    (stage, stageIndex) => stage !== stages[stageIndex - 1],
                  );
                  const totalMinutes = Math.ceil(route.duradaSegons / 60);
                  const hours = Math.floor(totalMinutes / 60);
                  const minutes = totalMinutes % 60;
                  const duration = hours
                    ? minutes
                      ? t('point.routeDurationHoursMinutes', { hours, minutes })
                      : t('point.routeDurationHours', { hours })
                    : t('point.routeDurationMinutes', { minutes });
                  const key = `${route.sortida}-${route.arribada}-${index}`;
                  const hasDetails = orderedStretches.length > 1;
                  const isExpanded = hasDetails && expanded === key;
                  const arrivalDaysLater = daysAfterDeparture(route.sortida, route.arribada);
                  return (
                    <Card
                      key={key}
                      style={styles.option}
                      onPress={hasDetails ? () => setExpanded(isExpanded ? null : key) : undefined}
                      accessibilityLabel={
                        hasDetails
                          ? `${modeNames[mode]}, ${duration}, ${t('point.routeArrivalLabel', { context: arrival.format(new Date(route.arribada)).startsWith('01:') ? 'oneOClock' : undefined })} ${arrival.format(new Date(route.arribada))}${route.transbordaments ? `, ${t('point.routeTransfers', { count: route.transbordaments })}` : ''}`
                          : undefined
                      }
                      accessibilityHint={
                        hasDetails
                          ? t(isExpanded ? 'point.routeHideJourney' : 'point.routeShowJourney')
                          : undefined
                      }
                      accessibilityState={hasDetails ? { expanded: isExpanded } : undefined}
                    >
                      <View style={styles.optionToggle}>
                        <View style={styles.optionTop}>
                          <View style={styles.modeIconBox}>
                            <Image
                              source={modeIcons[mode]}
                              tintColor={colors.pedra}
                              style={styles.modeIcon}
                              accessible={false}
                            />
                          </View>
                          <View style={styles.modeCopy}>
                            <AppText variant="label">{modeNames[mode]}</AppText>
                            {index === 0 ? (
                              <AppText variant="tag" color="far">
                                {t('point.routeEarliest')}
                              </AppText>
                            ) : null}
                          </View>
                          <AppText variant="hourlyIndex" style={styles.duration}>
                            {duration}
                          </AppText>
                        </View>
                        {summary.length > 1 ? (
                          <AppText variant="small">{summary.join(' → ')}</AppText>
                        ) : null}
                        <View style={styles.optionMeta}>
                          <AppText variant="small" color="boira">
                            {t('point.routeDistance', {
                              value: distance.format(route.distanciaMetres / 1000),
                            })}
                            {route.transbordaments > 0
                              ? ` · ${t('point.routeTransfers', { count: route.transbordaments })}`
                              : ''}
                          </AppText>
                          <View style={styles.schedule}>
                            <AppText variant="small" color="boira">
                              {t('point.routeDeparture', {
                                context: arrival.format(new Date(route.sortida)).startsWith('01:')
                                  ? 'oneOClock'
                                  : undefined,
                                time: arrival.format(new Date(route.sortida)),
                              })}
                            </AppText>
                            <AppText variant="small" color="boira">
                              {t('point.routeArrivalLabel', {
                                context: arrival.format(new Date(route.arribada)).startsWith('01:')
                                  ? 'oneOClock'
                                  : undefined,
                              })}{' '}
                              <AppText variant="small" color="lluna" style={styles.arrivalTime}>
                                {arrival.format(new Date(route.arribada))}
                              </AppText>
                              {arrivalDaysLater > 0 ? (
                                <AppText variant="small" color="boira">
                                  {' · '}
                                  {t('point.routeDayOffset', { count: arrivalDaysLater })}
                                </AppText>
                              ) : null}
                            </AppText>
                          </View>
                        </View>
                        {hasDetails ? (
                          <View style={styles.journeyAction}>
                            <AppText variant="small" color="far">
                              {t(isExpanded ? 'point.routeHideJourney' : 'point.routeShowJourney')}
                            </AppText>
                            <Image
                              source={chevronDownIcon}
                              tintColor={colors.far}
                              style={[
                                styles.journeyChevron,
                                isExpanded && styles.journeyChevronOpen,
                              ]}
                              accessible={false}
                            />
                          </View>
                        ) : null}
                      </View>
                      {isExpanded ? (
                        <View style={styles.details}>
                          {orderedStretches.map((stretch, stageIndex) => {
                            const transitName = stretch.transitMode
                              ? transitNameFor(stretch.transitMode)
                              : null;
                            const lineName =
                              stretch.mode === 'PUBLIC_TRANSPORT'
                                ? stretch.lineShortName || stretch.lineLongName
                                : null;
                            return (
                              <View key={`${stretch.sequence}-${stageIndex}`} style={styles.stage}>
                                <View style={styles.stageRail}>
                                  <View style={styles.stageDot} />
                                  {stageIndex < orderedStretches.length - 1 ? (
                                    <View style={styles.stageConnector} />
                                  ) : null}
                                </View>
                                <View style={styles.stageCopy}>
                                  <View style={styles.stageHeading}>
                                    <AppText variant="label">
                                      {lineName || modeNames[stretch.mode]}
                                    </AppText>
                                    {transitName ? (
                                      <AppText variant="small" color="pedra">
                                        {transitName}
                                      </AppText>
                                    ) : null}
                                  </View>
                                  {stretch.lineShortName && stretch.lineLongName ? (
                                    <AppText variant="small" color="boira">
                                      {stretch.lineLongName}
                                    </AppText>
                                  ) : null}
                                  {stretch.agencyName ? (
                                    <AppText variant="small" color="boira">
                                      {stretch.agencyName}
                                    </AppText>
                                  ) : null}
                                </View>
                              </View>
                            );
                          })}
                        </View>
                      ) : null}
                    </Card>
                  );
                })
              )}
              <View style={styles.source}>
                <Image
                  source={infoIcon}
                  tintColor={colors.boira}
                  style={styles.infoIcon}
                  accessible={false}
                />
                <AppText variant="small" color="boira">
                  {t('point.routeOptionsSource')}
                </AppText>
              </View>
            </>
          )}
        </ScrollView>
        {!editingDeparture ? (
          <View style={styles.footer}>
            <Button variant="primary" label={t('point.openMaps')} onPress={onOpenMaps} />
            <AppText variant="small" color="boira" style={styles.mapsNote}>
              {t('point.routeMapsNote')}
            </AppText>
          </View>
        ) : null}
      </SafeAreaView>
    </Modal>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  root: { flex: 1, backgroundColor: colors.nit },
  header: {
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingHorizontal: spacing.ml,
    paddingBottom: spacing.md,
  },
  intro: { gap: spacing.sm },
  departureForm: { gap: spacing.lg },
  back: {
    width: sizes.touch,
    height: sizes.touch,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.vora,
    backgroundColor: colors.nit,
  },
  backIcon: { width: 7.33, height: 12.83 },
  list: { padding: spacing.ml, gap: spacing.md },
  source: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  infoIcon: { width: sizes.iconSmall, height: sizes.iconSmall },
  option: { gap: spacing.ms },
  optionToggle: { gap: spacing.ms },
  journeyAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.xs,
    paddingTop: spacing.xs,
  },
  journeyChevron: { width: sizes.iconSmall, height: sizes.iconSmall },
  journeyChevronOpen: { transform: [{ rotate: '180deg' }] },
  details: {
    borderTopWidth: 1,
    borderTopColor: colors.linia,
    paddingTop: spacing.md,
  },
  stage: { flexDirection: 'row', gap: spacing.sm, minHeight: sizes.touch },
  stageRail: { width: sizes.icon, alignItems: 'center' },
  stageDot: {
    width: spacing.sm,
    height: spacing.sm,
    borderRadius: radii.pill,
    marginTop: spacing.xs,
    backgroundColor: colors.far,
  },
  stageConnector: {
    width: 2,
    flex: 1,
    marginVertical: spacing.xxs,
    backgroundColor: colors.vora,
  },
  stageCopy: { flex: 1, gap: spacing.xxs, paddingBottom: spacing.md },
  stageHeading: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', gap: spacing.xs },
  optionTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.ms },
  modeIconBox: {
    width: sizes.touch,
    height: sizes.touch,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.field,
    backgroundColor: colors.crep,
  },
  modeIcon: { width: sizes.icon, height: sizes.icon },
  modeCopy: { flex: 1, minWidth: 0, gap: spacing.xxs },
  duration: { textAlign: 'right', flexShrink: 0 },
  optionMeta: {
    gap: spacing.xs,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.linia,
  },
  schedule: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  arrivalTime: { fontFamily: fonts.bold },
  footer: { gap: spacing.sm, padding: spacing.ml, borderTopWidth: 1, borderTopColor: colors.linia },
  mapsNote: { textAlign: 'center' },
}));
