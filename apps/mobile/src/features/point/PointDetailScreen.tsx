import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Trans } from 'react-i18next';
import { useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, fonts, motion, radii, sizes, spacing, typography } from '@/core/theme/tokens';
import { AppText } from '@/shared/ui/AppText';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { IndexIndicator } from '@/shared/ui/IndexIndicator';
import { Skeleton } from '@/shared/ui/Skeleton';
import { StateMessage } from '@/shared/ui/StateMessage';

import PointLocationMap from './PointLocationMap';
import { usePointDetailViewModel } from './usePointDetailViewModel';

const appear = FadeIn.duration(motion.base).reduceMotion(ReduceMotion.System);
const mapPalette = { background: colors.nit, text: colors.boira, link: colors.lluna };
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
  const [selectedHourId, setSelectedHourId] = useState<string | null>(null);
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
                colors={['transparent', 'transparent', 'rgba(14,20,51,0.2)', colors.nit]}
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
                  {vm.altitudeLabel}: {vm.altitude}
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
                          <AppText
                            variant="small"
                            color="lluna"
                            style={{ fontFamily: fonts.bold }}
                          />
                        ),
                      }}
                    />
                  </AppText>
                ) : null}
              </View>
            </Card>
            <View style={styles.section}>
              <AppText variant="heading" accessibilityRole="header">
                {vm.hoursLabel}
              </AppText>
              <AppText variant="caption" color="boira">
                {vm.timezoneLabel}
              </AppText>
              {vm.hours.length ? (
                <FlatList
                  horizontal
                  data={vm.hours}
                  extraData={selectedHourId}
                  keyExtractor={(hour) => hour.id}
                  showsHorizontalScrollIndicator
                  style={styles.chartList}
                  contentContainerStyle={styles.chart}
                  renderItem={({ item }) => (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={item.accessibilityLabel}
                      accessibilityState={{ selected: item.id === selectedHourId }}
                      onPress={() =>
                        setSelectedHourId((selected) => (selected === item.id ? null : item.id))
                      }
                      style={[
                        styles.hour,
                        !item.isBest && item.id !== selectedHourId && styles.hourMuted,
                      ]}
                    >
                      <View
                        style={[
                          styles.barTrack,
                          item.id === selectedHourId && styles.barTrackSelected,
                        ]}
                      >
                        <View
                          style={[
                            styles.bar,
                            {
                              height: item.value === 0 ? 2 : `${item.value}%`,
                              backgroundColor: colors[item.level],
                            },
                          ]}
                        />
                        {item.id === selectedHourId ? (
                          <>
                            <View
                              testID="selected-hour-silhouette"
                              pointerEvents="none"
                              style={[styles.barSilhouette, { borderColor: colors[item.level] }]}
                            />
                            <View pointerEvents="none" style={styles.barIndex}>
                              <AppText
                                variant="heading"
                                color={item.value >= 75 ? 'nit' : item.level}
                                style={[
                                  styles.barIndexValue,
                                  item.value < 75 && styles.barIndexValueShadow,
                                ]}
                              >
                                {item.value}
                              </AppText>
                            </View>
                          </>
                        ) : null}
                      </View>
                      <AppText variant="caption" color="boira">
                        {item.label}
                      </AppText>
                    </Pressable>
                  )}
                />
              ) : (
                <AppText variant="small" color="boira">
                  {vm.noHours}
                </AppText>
              )}
            </View>
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
  section: { gap: spacing.sm },
  chartList: { marginTop: -spacing.xs },
  chart: { gap: spacing.xs, paddingTop: spacing.xs, paddingBottom: spacing.sm },
  hour: { minWidth: sizes.hourlyColumn, alignItems: 'center', gap: spacing.xs },
  hourMuted: { opacity: 0.38 },
  barTrack: {
    height: sizes.hourlyChart,
    width: sizes.hourlyColumn - spacing.sm,
    justifyContent: 'flex-end',
    position: 'relative',
  },
  barTrackSelected: { backgroundColor: colors.vel, borderRadius: spacing.xs },
  barSilhouette: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    borderWidth: 1,
    borderRadius: spacing.xs,
  },
  barIndex: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  barIndexValue: {
    fontFamily: fonts.display,
    fontSize: 27,
    lineHeight: 30,
  },
  barIndexValueShadow: {
    textShadowColor: colors.nit,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  bar: { width: '100%', borderTopLeftRadius: spacing.xs, borderTopRightRadius: spacing.xs },
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
