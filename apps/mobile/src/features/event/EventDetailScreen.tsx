import { Image } from 'expo-image';
import { ScrollView, View } from 'react-native';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { makeStyles, useNightTint, useTheme } from '@/core/theme/theme';
import { motion, radii, sizes, spacing, typography } from '@/core/theme/tokens';
import { AppText } from '@/shared/ui/AppText';
import { Button } from '@/shared/ui/Button';
import { PressableScale } from '@/shared/ui/PressableScale';
import { Skeleton } from '@/shared/ui/Skeleton';
import { StateMessage } from '@/shared/ui/StateMessage';

import { EventSky } from './EventSky';
import { useEventDetailViewModel } from './useEventDetailViewModel';

const appear = FadeIn.duration(motion.base).reduceMotion(ReduceMotion.System);
const backIcon = require('@/assets/images/event/back.svg');
const clockIcon = require('@/assets/images/explora/rellotge.svg');
const starIcon = require('@/assets/images/event/estel.svg');
const moonIcon = require('@/assets/images/point/moon.svg');
const watchIcon = require('@/assets/images/explora/constellacions.svg');

/** Un apartat de la fitxa: icona, títol i text. */
function Fact({
  icon,
  tint,
  title,
  text,
}: {
  icon: number;
  tint?: string;
  title: string;
  text: string;
}) {
  const styles = useStyles();
  const nightTint = useNightTint();
  return (
    <View style={styles.fact}>
      <Image
        source={icon}
        tintColor={tint ?? nightTint}
        style={styles.factIcon}
        accessible={false}
      />
      <View style={styles.factCopy}>
        <AppText variant="label">{title}</AppText>
        <AppText variant="small" color="boira">
          {text}
        </AppText>
      </View>
    </View>
  );
}

/** Fitxa d'un esdeveniment del calendari (HU10, mockup 09). El mite, el millor lloc i els plans són d'altres històries. */
export function EventDetailScreen({ eventId }: { eventId: string }) {
  const nightTint = useNightTint();
  const styles = useStyles();
  const { colors } = useTheme();
  const vm = useEventDetailViewModel(eventId);
  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <PressableScale onPress={vm.back} accessibilityLabel={vm.backLabel} style={styles.back}>
          <Image
            tintColor={nightTint}
            source={backIcon}
            style={styles.backIcon}
            accessible={false}
          />
        </PressableScale>
        <AppText variant="label" numberOfLines={1} style={styles.headerTitle}>
          {vm.headerTitle}
        </AppText>
        {/* Ocupa el lloc del botó de compartir del mockup perquè el títol quedi centrat. */}
        <View style={styles.headerSide} />
      </View>
      {vm.status === 'loading' ? (
        <View style={[styles.content, styles.body]}>
          <Skeleton height={sizes.eventSky} radius="lg" />
          <Skeleton height={typography.display.lineHeight} width="60%" />
          <Skeleton height={typography.tag.lineHeight + spacing.sm} width="70%" />
          <Skeleton height={typography.small.lineHeight * 3} />
        </View>
      ) : vm.status !== 'ok' ? (
        <StateMessage
          title={vm.errorTitle}
          message={vm.errorMessage}
          action={vm.status === 'error' ? { label: vm.retryLabel, onPress: vm.retry } : undefined}
          fill
        />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <Animated.View entering={appear} style={styles.body}>
            <EventSky seed={vm.skySeed} icon={vm.icon} meteors={vm.meteors} caption={vm.source} />
            <View style={styles.heading}>
              <AppText variant="display" accessibilityRole="header">
                {vm.name}
              </AppText>
              <View style={styles.tags} testID="event-tags">
                <AppText variant="tag" color="pedra" style={styles.tag}>
                  {vm.typeLabel}
                </AppText>
                <AppText variant="tag" color="pedra" style={styles.tag}>
                  {vm.dateLabel}
                </AppText>
              </View>
            </View>
            <View style={styles.facts}>
              <Fact icon={clockIcon} tint={colors.pedra} title={vm.whenTitle} text={vm.when} />
              <Fact icon={starIcon} title={vm.descriptionTitle} text={vm.description} />
              {vm.particularity ? (
                <Fact icon={moonIcon} title={vm.particularityTitle} text={vm.particularity} />
              ) : null}
              {vm.howToWatch ? (
                <Fact icon={watchIcon} title={vm.howToWatchTitle} text={vm.howToWatch} />
              ) : null}
            </View>
            <View style={styles.action}>
              <Button {...vm.recommendations} haptic />
              {vm.recommendations.message && (
                <AppText variant="small" color="boira" accessibilityLiveRegion="polite">
                  {vm.recommendations.message}
                </AppText>
              )}
            </View>
          </Animated.View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  root: { flex: 1, backgroundColor: colors.nit },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
  },
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
  // La fletxa del Figma, a la seva mida: el botó la centra.
  backIcon: { width: 7.33, height: 12.83 },
  headerTitle: { flex: 1, textAlign: 'center' },
  headerSide: { width: sizes.touch },
  content: { paddingHorizontal: spacing.ml, paddingTop: spacing.ms, paddingBottom: spacing.lg },
  body: { gap: spacing.ms },
  heading: { gap: spacing.sm },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tag: {
    backgroundColor: colors.vel,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
    overflow: 'hidden',
  },
  action: { gap: spacing.sm, marginTop: spacing.sm },
  facts: { gap: spacing.ms },
  fact: { flexDirection: 'row', gap: spacing.ms, alignItems: 'flex-start' },
  factIcon: { width: sizes.icon, height: sizes.icon },
  factCopy: { flex: 1, gap: spacing.xxs },
}));
