import { useEffect } from 'react';
import { Image } from 'expo-image';
import { FlatList, View } from 'react-native';
import type { Favorit } from '@talaia/shared';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { makeStyles, useTheme } from '@/core/theme/theme';
import { motion, radii, sizes, spacing } from '@/core/theme/tokens';
import { AppText } from '@/shared/ui/AppText';
import { PressableScale } from '@/shared/ui/PressableScale';
import { Screen } from '@/shared/ui/Screen';
import { Skeleton } from '@/shared/ui/Skeleton';
import { StateMessage } from '@/shared/ui/StateMessage';

import { useFavoritesViewModel } from './useFavoritesViewModel';

const savedIcon = require('@/assets/images/profile/saved.svg');
const heartIcon = require('@/assets/images/point/heart-filled.svg');
const outlineIcon = require('@/assets/images/point/heart-outline.svg');
const locationIcon = require('@/assets/images/explora/ubicacio.svg');
const chevronIcon = require('@/assets/images/calendar/chevron-down.svg');

/** Els punts desats, amb accés directe a la fitxa. */
export function FavoritesScreen() {
  const vm = useFavoritesViewModel();
  const styles = useStyles();

  return (
    <Screen title={vm.title} subtitle={vm.subtitle} back={vm.back}>
      {vm.removeError ? (
        <AppText accessibilityRole="alert" color="tap">
          {vm.removeError}
        </AppText>
      ) : null}
      {vm.undoError ? (
        <AppText accessibilityRole="alert" color="tap">
          {vm.undoError}
        </AppText>
      ) : null}
      {vm.loading ? (
        <View style={styles.loading} accessibilityLabel={vm.title}>
          <Skeleton height={sizes.calendarEvent} radius="md" />
          <Skeleton height={sizes.calendarEvent} radius="md" />
        </View>
      ) : vm.error ? (
        <StateMessage title={vm.error} action={{ label: vm.retryLabel, onPress: vm.retry }} fill />
      ) : vm.points.length === 0 ? (
        <StateMessage title={vm.empty} icon={savedIcon} fill />
      ) : (
        <View style={styles.listContainer}>
          <AppText variant="caption" color="boira">
            {vm.help}
          </AppText>
          <FlatList
            style={styles.listView}
            data={vm.points}
            keyExtractor={(point) => point.id}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => <FavoriteRow point={item} vm={vm} />}
          />
        </View>
      )}
      {vm.undoMessage ? (
        <View style={styles.undoBar} accessibilityLiveRegion="polite">
          <AppText variant="caption" style={styles.undoMessage} numberOfLines={2}>
            {vm.undoMessage}
          </AppText>
          <PressableScale
            onPress={vm.undoPoint}
            style={styles.undoButton}
            accessibilityLabel={vm.undoLabel}
          >
            <AppText variant="label" color="far">
              {vm.undoLabel}
            </AppText>
          </PressableScale>
        </View>
      ) : null}
    </Screen>
  );
}

function FavoriteRow({
  point,
  vm,
}: {
  point: Favorit;
  vm: ReturnType<typeof useFavoritesViewModel>;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const exit = useSharedValue(0);

  useEffect(() => {
    if (vm.exitingId !== point.id) return;
    exit.set(reduceMotion ? 1 : withTiming(1, { duration: motion.base, easing: motion.exit }));
  }, [vm.exitingId, point.id, reduceMotion, exit]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: 1 - exit.get(),
    transform: [{ translateX: -spacing.md * exit.get() }],
  }));

  return (
    <Animated.View style={[styles.row, animatedStyle]} testID={`favorite-card-${point.id}`}>
      <PressableScale
        style={styles.heartSlot}
        testID={`favorite-icon-${point.id}`}
        accessibilityLabel={vm.removeLabel(point.nom)}
        accessibilityState={{ disabled: vm.removing }}
        disabled={vm.removing}
        onPress={() => vm.removePoint(point.id)}
        haptic="selection"
      >
        <Image
          source={vm.leavingId === point.id ? outlineIcon : heartIcon}
          tintColor={colors.far}
          style={styles.heartIcon}
          accessible={false}
          testID={`favorite-heart-${point.id}`}
        />
      </PressableScale>
      <PressableScale
        accessibilityLabel={`${point.nom}, ${point.municipi}`}
        accessibilityHint={vm.openHint}
        onPress={() => vm.openPoint(point.id)}
        style={styles.openArea}
      >
        <View style={styles.copy}>
          <AppText variant="label" numberOfLines={2}>
            {point.nom}
          </AppText>
          <View style={styles.location}>
            <Image
              source={locationIcon}
              tintColor={colors.boira}
              style={styles.locationIcon}
              accessible={false}
            />
            <AppText variant="caption" color="boira" numberOfLines={1} style={styles.municipi}>
              {point.municipi}
            </AppText>
          </View>
        </View>
        <Image
          source={chevronIcon}
          tintColor={colors.boira}
          style={styles.chevron}
          accessible={false}
          testID={`favorite-chevron-${point.id}`}
        />
      </PressableScale>
    </Animated.View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  loading: { gap: spacing.ms },
  listContainer: { flex: 1, gap: spacing.ms },
  listView: { flex: 1 },
  list: { gap: spacing.ms, paddingTop: spacing.xs, paddingBottom: spacing.xl },
  undoBar: {
    minHeight: sizes.button,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingLeft: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.crep,
  },
  undoMessage: { flex: 1 },
  undoButton: {
    minWidth: sizes.touch + spacing.md,
    minHeight: sizes.button,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.ms,
  },
  row: {
    minHeight: sizes.calendarEvent,
    flexDirection: 'row',
    alignItems: 'stretch',
    borderWidth: 1,
    borderColor: colors.linia,
    borderRadius: radii.md,
    backgroundColor: colors.card,
    overflow: 'hidden',
  },
  openArea: {
    flex: 1,
    minWidth: 0,
    minHeight: sizes.calendarEvent,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingLeft: spacing.xs,
    paddingRight: spacing.md,
    paddingVertical: spacing.sm,
  },
  heartSlot: {
    width: sizes.touch + spacing.ms,
    minHeight: sizes.calendarEvent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heartIcon: { width: sizes.icon - spacing.xs, height: sizes.icon - spacing.xs },
  copy: { flex: 1, minWidth: 0, gap: spacing.xxs },
  location: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  locationIcon: { width: sizes.iconSmall, height: sizes.iconSmall },
  municipi: { flex: 1 },
  chevron: { width: sizes.iconSmall, height: sizes.iconSmall, transform: [{ rotate: '-90deg' }] },
}));
