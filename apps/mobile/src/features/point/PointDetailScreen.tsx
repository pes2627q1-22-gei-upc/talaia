import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Trans } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, fonts, motion, radii, sizes, spacing, typography } from '@/core/theme/tokens';
import { AppText } from '@/shared/ui/AppText';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { IndexIndicator } from '@/shared/ui/IndexIndicator';
import { Skeleton } from '@/shared/ui/Skeleton';
import { StateMessage } from '@/shared/ui/StateMessage';

import { HourlyChart } from './HourlyChart';
import PointLocationMap from './PointLocationMap';
import { usePointDetailViewModel } from './usePointDetailViewModel';

const appear = FadeIn.duration(motion.base).reduceMotion(ReduceMotion.System);
const mapPalette = {
  background: colors.nit,
  text: colors.boira,
  link: colors.lluna,
  marker: colors.ras,
};
const mapMetrics = {
  touch: sizes.touch,
  icon: sizes.icon,
  marker: sizes.pointMarker,
  core: sizes.pointMarkerCore,
  stem: sizes.pointMarkerStem,
  halo: sizes.pointMarkerHalo,
};
const directionsIcon = require('@/assets/images/point/directions.svg');
const planIcon = require('@/assets/images/point/plan.svg');
const factorIcons = {
  cloud: require('@/assets/images/point/cloud.svg'),
  sun: require('@/assets/images/point/sun.svg'),
  sparkle: require('@/assets/images/point/sparkle.svg'),
  moon: require('@/assets/images/point/moon.svg'),
} as const;

/** TG-93 / mockup 05. Els factors detallats són TG-105; rutes i plans, altres històries. */
export function PointDetailScreen({ pointId }: { pointId: string }) {
  const vm = usePointDetailViewModel(pointId);
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
        />
      ) : (
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={styles.scroll}
        >
          {vm.coordinates ? (
            <View style={styles.map}>
              <PointLocationMap
                mapStyle={vm.mapStyle}
                key={pointId}
                coordinates={vm.coordinates}
                palette={mapPalette}
                metrics={mapMetrics}
                label={vm.mapLabel}
                attributionLabel={vm.mapCreditsLabel}
                unavailableLabel={vm.mapUnavailable}
                dom={{
                  style: styles.map,
                  scrollEnabled: false,
                  bounces: false,
                  contentInsetAdjustmentBehavior: 'never',
                  automaticallyAdjustContentInsets: false,
                }}
              />
              <LinearGradient
                pointerEvents="none"
                colors={['transparent', 'transparent', colors.mapFade, colors.nit]}
                locations={[0, 0.35, 0.7, 1]}
                style={styles.mapFade}
              />
              <AppText variant="display" accessibilityRole="header" style={styles.mapTitle}>
                {vm.title}
              </AppText>
            </View>
          ) : null}
          <Animated.View entering={appear} style={styles.content}>
            <View style={styles.heading}>
              <View style={styles.tags}>
                <AppText variant="tag" color="pedra" style={styles.tag}>
                  {vm.municipality}
                </AppText>
                <AppText variant="tag" color="pedra" style={styles.tag}>
                  {vm.altitudeTag}
                </AppText>
              </View>
            </View>
            {vm.staleMessage ? (
              <View accessibilityLiveRegion="polite" style={styles.heading}>
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
              ) : null}
              <View style={styles.indexCopy}>
                <AppText variant="heading" color={vm.currentIndex?.franja ?? 'boira'}>
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
            <HourlyChart
              hours={vm.hours}
              hoursLabel={vm.hoursLabel}
              timezoneLabel={vm.timezoneLabel}
              noHours={vm.noHours}
            />
            <View style={styles.factors}>
              {vm.factorRows.map((factor) => (
                <View key={factor.key} style={styles.factorRow}>
                  <Image source={factorIcons[factor.icon]} style={styles.factorIcon} />
                  <View style={styles.factorContent}>
                    <View style={styles.factorHeading}>
                      <View style={styles.factorCopy}>
                        <AppText variant="heading">{factor.label}</AppText>
                        <AppText variant="small" color="boira">
                          {factor.hint}
                        </AppText>
                      </View>
                      <AppText variant="heading" color={factor.level}>
                        {factor.value}
                      </AppText>
                    </View>
                    <View
                      accessibilityRole="progressbar"
                      accessibilityValue={{ min: 0, max: 100, now: factor.value }}
                      style={styles.factorTrack}
                    >
                      <View
                        style={[
                          styles.factorProgress,
                          { width: `${factor.value}%`, backgroundColor: colors[factor.level] },
                        ]}
                      />
                    </View>
                  </View>
                </View>
              ))}
            </View>
            {vm.description || vm.accessibility || vm.horizon ? (
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
              </View>
            ) : null}
          </Animated.View>
        </ScrollView>
      )}
      {vm.status === 'ok' ? (
        <View style={styles.actions}>
          <Button
            variant="secondary"
            label={vm.directionsLabel}
            icon={<Image source={directionsIcon} style={styles.actionIcon} accessible={false} />}
            onPress={vm.openDirections}
            style={styles.actionButton}
          />
          <Button
            variant="primary"
            label={vm.createPlanLabel}
            icon={<Image source={planIcon} style={styles.actionIcon} accessible={false} />}
            onPress={vm.createPlan}
            style={styles.actionButton}
          />
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.nit },
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
  map: {
    height: sizes.pointMap,
    width: '100%',
    position: 'relative',
    backgroundColor: colors.nit,
    zIndex: 1,
  },
  mapFade: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  mapTitle: {
    position: 'absolute',
    left: spacing.ml,
    right: spacing.ml,
    bottom: -spacing.md,
    color: colors.lluna,
  },
  heading: { gap: spacing.sm },
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
  factors: { gap: spacing.md },
  pointInfo: { gap: spacing.md },
  infoField: { gap: spacing.xs },
  factorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  factorIcon: { width: sizes.icon, height: sizes.icon },
  factorContent: { flex: 1, gap: spacing.xs },
  factorHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  factorCopy: { flex: 1, gap: spacing.xs / 2 },
  factorTrack: {
    height: spacing.xs,
    borderRadius: spacing.xs,
    backgroundColor: colors.crep,
    overflow: 'hidden',
  },
  factorProgress: { height: '100%', borderRadius: spacing.xs },
});
