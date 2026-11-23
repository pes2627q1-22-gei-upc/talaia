import { Image } from 'expo-image';
import { FlatList, View } from 'react-native';

import { makeStyles, useTheme } from '@/core/theme/theme';
import { radii, sizes, spacing } from '@/core/theme/tokens';
import { AppText } from '@/shared/ui/AppText';
import { PressableScale } from '@/shared/ui/PressableScale';
import { Screen } from '@/shared/ui/Screen';
import { Skeleton } from '@/shared/ui/Skeleton';
import { StateMessage } from '@/shared/ui/StateMessage';

import { useFavoritesViewModel } from './useFavoritesViewModel';

const savedIcon = require('@/assets/images/profile/saved.svg');
const heartIcon = require('@/assets/images/point/heart-filled.svg');
const locationIcon = require('@/assets/images/explora/ubicacio.svg');
const chevronIcon = require('@/assets/images/calendar/chevron-down.svg');

/** Els punts desats, amb accés directe a la fitxa. */
export function FavoritesScreen() {
  const vm = useFavoritesViewModel();
  const styles = useStyles();
  const { colors } = useTheme();

  return (
    <Screen title={vm.title} subtitle={vm.subtitle} back={vm.back}>
      {vm.removeError ? (
        <AppText accessibilityRole="alert" color="tap">
          {vm.removeError}
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
        <FlatList
          data={vm.points}
          keyExtractor={(point) => point.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.row} testID={`favorite-card-${item.id}`}>
              <PressableScale
                style={styles.heartSlot}
                testID={`favorite-icon-${item.id}`}
                accessibilityLabel={vm.removeLabel(item.nom)}
                accessibilityState={{ disabled: vm.removing }}
                disabled={vm.removing}
                onPress={() => vm.removePoint(item.id)}
                haptic="selection"
              >
                <Image
                  source={heartIcon}
                  tintColor={colors.far}
                  style={styles.heartIcon}
                  accessible={false}
                />
              </PressableScale>
              <PressableScale
                accessibilityLabel={`${item.nom}, ${item.municipi}`}
                accessibilityHint={vm.openHint}
                onPress={() => vm.openPoint(item.id)}
                style={styles.openArea}
              >
                <View style={styles.copy}>
                  <AppText variant="label" numberOfLines={2}>
                    {item.nom}
                  </AppText>
                  <View style={styles.location}>
                    <Image
                      source={locationIcon}
                      tintColor={colors.boira}
                      style={styles.locationIcon}
                      accessible={false}
                    />
                    <AppText
                      variant="caption"
                      color="boira"
                      numberOfLines={1}
                      style={styles.municipi}
                    >
                      {item.municipi}
                    </AppText>
                  </View>
                </View>
                <Image
                  source={chevronIcon}
                  tintColor={colors.boira}
                  style={styles.chevron}
                  accessible={false}
                  testID={`favorite-chevron-${item.id}`}
                />
              </PressableScale>
            </View>
          )}
        />
      )}
    </Screen>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  loading: { gap: spacing.ms },
  list: { gap: spacing.ms, paddingTop: spacing.xs, paddingBottom: spacing.xl },
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
