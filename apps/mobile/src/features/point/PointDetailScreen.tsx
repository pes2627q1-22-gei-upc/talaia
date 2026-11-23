import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Trans } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import Animated, { FadeIn, ReduceMotion, useReducedMotion } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { makeStyles, useNightTint, useTheme } from '@/core/theme/theme';
import { fonts, motion, radii, sizes, spacing, typography } from '@/core/theme/tokens';
import { AppText } from '@/shared/ui/AppText';
import { BackButton } from '@/shared/ui/BackButton';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { IndexIndicator } from '@/shared/ui/IndexIndicator';
import { Skeleton } from '@/shared/ui/Skeleton';
import { StateMessage } from '@/shared/ui/StateMessage';

import { IndexBreakdown } from './IndexBreakdown';
import { FavoriteButton } from './FavoriteButton';
import PointLocationMap from './PointLocationMap';
import { RouteOptionsModal } from './RouteOptionsModal';
import { usePointDetailViewModel } from './usePointDetailViewModel';

const appear = FadeIn.duration(motion.base).reduceMotion(ReduceMotion.System);
const mapMetrics = {
  touch: sizes.touch,
  icon: sizes.icon,
  marker: sizes.pointMarker,
  core: sizes.pointMarkerCore,
  stem: sizes.pointMarkerStem,
  halo: sizes.pointMarkerHalo,
} as const;
const directionsIcon = require('@/assets/images/point/directions.svg');
const sunIcon = require('@/assets/images/point/sun.svg');
const planIcon = require('@/assets/images/point/plan.svg');

/** TG-93 / mockup 05, amb el desglossament d'aquesta nit (TG-105) i la ruta (TG-136). */
export function PointDetailScreen({ pointId }: { pointId: string }) {
  const nightTint = useNightTint();
  const nightTintOnPrimary = useNightTint('nit');
  const styles = useStyles();
  const { name: theme, colors, gradients, pointMapColors } = useTheme();
  const mapPalette = useMemo(
    () => ({
      background: colors.nit,
      text: colors.boira,
      link: colors.lluna,
      marker: colors.ras,
      ...pointMapColors,
    }),
    [colors, pointMapColors],
  );
  const vm = usePointDetailViewModel(pointId);
  const insets = useSafeAreaInsets();
  // El mapa passa per sota de la barra d'estat i del botó enrere: hi sumem la zona segura perquè
  // la part que es veu sota la capçalera continuï sent la del mockup.
  const mapStyle = useMemo(
    () => [styles.map, { height: sizes.pointMap + insets.top }],
    [styles.map, insets.top],
  );
  const metrics = useMemo(() => ({ ...mapMetrics, top: insets.top }), [insets.top]);
  const reduceMotion = useReducedMotion();
  // El mapa gira només mentre la fitxa es veu: amb una altra pantalla a sobre, s'atura.
  const [focused, setFocused] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.root}>
      {vm.status === 'loading' ? (
        <ScrollView contentContainerStyle={styles.content}>
          <Skeleton height={sizes.pointMap} />
          <Skeleton height={typography.display.lineHeight} width="80%" />
          <Skeleton height={typography.small.lineHeight} width="45%" />
          <Skeleton height={typography.indexLg.lineHeight + spacing.xl} radius="lg" />
          <Skeleton height={sizes.hourlyChart + typography.small.lineHeight + spacing.lg} />
          <Skeleton height={typography.body.lineHeight * 3} />
        </ScrollView>
      ) : vm.status !== 'ok' ? (
        <StateMessage
          title={vm.errorTitle}
          message={vm.errorMessage}
          action={vm.status === 'error' ? { label: vm.retryLabel, onPress: vm.retry } : undefined}
          fill
        />
      ) : (
        <ScrollView contentInsetAdjustmentBehavior="never" contentContainerStyle={styles.scroll}>
          {vm.coordinates ? (
            <View style={mapStyle}>
              <PointLocationMap
                night={theme === 'vermell'}
                mapStyle={vm.mapStyle}
                key={pointId}
                coordinates={vm.coordinates}
                palette={mapPalette}
                metrics={metrics}
                label={vm.mapLabel}
                attributionLabel={vm.mapCreditsLabel}
                unavailableLabel={vm.mapUnavailable}
                orbit={focused && !reduceMotion}
                dom={{
                  // Transparent perquè no hi hagi el flaix blanc del WKWebView (vegeu MapScreen).
                  style: styles.mapWebView,
                  scrollEnabled: false,
                  bounces: false,
                  contentInsetAdjustmentBehavior: 'never',
                  automaticallyAdjustContentInsets: false,
                }}
              />
              <LinearGradient
                pointerEvents="none"
                colors={gradients.pointMapFade.colors}
                locations={gradients.pointMapFade.locations}
                style={styles.mapFade}
              />
              <AppText variant="display" accessibilityRole="header" style={styles.mapTitle}>
                {vm.title}
              </AppText>
            </View>
          ) : null}
          <Animated.View entering={appear} style={styles.content}>
            <View style={styles.summary}>
              <View style={styles.pointMeta}>
                <View style={styles.tags}>
                  <AppText variant="tag" color="pedra" style={styles.tag}>
                    {vm.municipality}
                  </AppText>
                  <AppText variant="tag" color="pedra" style={styles.tag}>
                    {vm.altitudeTag}
                  </AppText>
                </View>
                <FavoriteButton key={pointId} pointId={pointId} />
              </View>
              {vm.staleMessage ? (
                <View accessibilityLiveRegion="polite" style={styles.staleMessage}>
                  <AppText variant="small" color="jus">
                    {vm.staleMessage}
                  </AppText>
                  <Button
                    variant="text"
                    label={vm.retryLabel}
                    onPress={vm.retry}
                    disabled={vm.refreshing}
                  />
                </View>
              ) : null}
              <Card style={styles.indexCard}>
                {vm.currentIndex ? (
                  <View style={styles.indexValue}>
                    <IndexIndicator index={vm.currentIndex} size="lg" />
                  </View>
                ) : vm.daytime ? (
                  <View style={styles.indexValue}>
                    <Image
                      source={sunIcon}
                      tintColor={colors.pedra}
                      style={styles.daytimeIcon}
                      accessible={false}
                    />
                  </View>
                ) : null}
                <View style={styles.indexCopy}>
                  <AppText
                    variant="heading"
                    color={vm.daytime ? 'lluna' : (vm.currentIndex?.franja ?? 'boira')}
                  >
                    {vm.currentLevel ?? vm.noIndex}
                  </AppText>
                  <AppText variant="small" color="boira">
                    {vm.currentLabel}
                  </AppText>
                  {vm.bestWindow ? (
                    <AppText variant="small" color="boira">
                      <Trans
                        i18nKey="point.bestHour"
                        values={vm.bestWindow}
                        components={{
                          strong: (
                            <AppText variant="small" color="lluna" style={styles.bestHourStrong} />
                          ),
                        }}
                      />
                    </AppText>
                  ) : null}
                </View>
              </Card>
            </View>
            <IndexBreakdown
              hours={vm.hours}
              defaultHourId={vm.defaultHourId}
              hoursLabel={vm.hoursLabel}
              timezoneLabel={vm.timezoneLabel}
              noHours={vm.noHours}
              indexExplanation={vm.indexExplanation}
              hoursTapHint={vm.hoursTapHint}
              hourA11yHint={vm.hourA11yHint}
              hoursLoading={vm.hoursLoading}
              hoursError={vm.hoursError}
              retryLabel={vm.retryLabel}
              retry={vm.retry}
            />
            {vm.description || vm.accessibility || vm.horizon || vm.skyDarkness ? (
              <View style={styles.pointInfo}>
                <AppText variant="heading" accessibilityRole="header">
                  {vm.pointInfoLabel}
                </AppText>
                {vm.description ? (
                  <View style={styles.infoField}>
                    <AppText variant="small" color="boira">
                      {vm.descriptionLabel}
                    </AppText>
                    <AppText variant="body">{vm.description}</AppText>
                  </View>
                ) : null}
                {vm.accessibility ? (
                  <View style={styles.infoField}>
                    <AppText variant="small" color="boira">
                      {vm.accessibilityLabel}
                    </AppText>
                    <AppText variant="body">{vm.accessibility}</AppText>
                  </View>
                ) : null}
                {vm.horizon ? (
                  <View style={styles.infoField}>
                    <AppText variant="small" color="boira">
                      {vm.horizonLabel}
                    </AppText>
                    <AppText variant="body">{vm.horizon}</AppText>
                  </View>
                ) : null}
                {vm.skyDarkness ? (
                  <View style={styles.sqmField}>
                    <AppText variant="small" color="boira">
                      {vm.skyDarknessLabel}
                    </AppText>
                    <AppText variant="small" color="lluna">
                      {vm.skyDarkness} · {vm.skyDarknessHint}
                    </AppText>
                    <View style={styles.sqmQuality}>
                      <AppText variant="chip" color="pedra">
                        {vm.skyDarknessQuality}
                      </AppText>
                    </View>
                  </View>
                ) : null}
              </View>
            ) : null}
          </Animated.View>
        </ScrollView>
      )}
      <LinearGradient
        pointerEvents="none"
        colors={gradients.statusScrim.colors}
        locations={gradients.statusScrim.locations}
        style={[styles.statusScrim, { height: insets.top + spacing.sm }]}
      />
      {vm.status === 'ok' ? (
        <View style={styles.actions}>
          <Button
            variant="secondary"
            label={vm.directionsLabel}
            haptic
            icon={
              <Image
                tintColor={nightTint}
                source={directionsIcon}
                style={styles.actionIcon}
                accessible={false}
              />
            }
            onPress={vm.openDirections}
            disabled={vm.openingDirections}
            style={styles.actionButton}
          />
          <Button
            variant="primary"
            label={vm.createPlanLabel}
            haptic
            icon={
              <Image
                tintColor={nightTintOnPrimary}
                source={planIcon}
                style={styles.actionIcon}
                accessible={false}
              />
            }
            onPress={vm.createPlan}
            style={styles.actionButton}
          />
        </View>
      ) : null}
      <RouteOptionsModal
        visible={vm.routeOptionsVisible}
        alternatives={vm.routeAlternatives}
        departure={vm.routeDeparture}
        onDepartureChange={vm.setRouteDeparture}
        loading={vm.routesLoading}
        error={vm.routesError}
        onClose={vm.closeRouteOptions}
        onOpenMaps={vm.openMaps}
      />
      {/* Sura sobre el mapa de la fitxa (mockup 05), també mentre carrega o si falla. */}
      <BackButton label={vm.backLabel} style={[styles.back, { top: insets.top + spacing.sm }]} />
    </SafeAreaView>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  root: { flex: 1, backgroundColor: colors.nit },
  back: { position: 'absolute', left: spacing.md },
  scroll: { paddingBottom: spacing.lg },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.ml,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    backgroundColor: colors.nit,
  },
  actionButton: { flex: 1, minWidth: 0, paddingHorizontal: spacing.sm },
  actionIcon: { width: sizes.icon, height: sizes.icon },
  content: { padding: spacing.ml, gap: spacing.lg },
  summary: { gap: spacing.sm },
  map: {
    height: sizes.pointMap,
    width: '100%',
    position: 'relative',
    backgroundColor: colors.nit,
    zIndex: 1,
  },
  mapFade: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  mapWebView: { flex: 1, backgroundColor: 'transparent' },
  statusScrim: { position: 'absolute', top: 0, left: 0, right: 0 },
  mapTitle: {
    position: 'absolute',
    left: spacing.ml,
    right: spacing.ml,
    bottom: -spacing.md,
    color: colors.lluna,
  },
  pointMeta: { gap: spacing.sm },
  staleMessage: { gap: spacing.sm },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tag: {
    backgroundColor: colors.vel,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
  },
  indexCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radii.lg,
  },
  indexValue: {
    width: sizes.pointIndex,
    minWidth: sizes.pointIndex,
    flexShrink: 0,
    alignItems: 'center',
  },
  indexCopy: { flex: 1, flexBasis: sizes.hourlyColumn * 3, gap: spacing.xs },
  bestHourStrong: { fontFamily: fonts.bold },
  daytimeIcon: { width: sizes.pointMarker - spacing.md, height: sizes.pointMarker - spacing.md },
  pointInfo: { gap: spacing.md },
  infoField: { gap: spacing.xs },
  sqmField: {
    gap: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.linia,
  },
  sqmQuality: {
    alignSelf: 'flex-start',
    backgroundColor: colors.vel,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.ms,
    paddingVertical: spacing.xs,
  },
}));
