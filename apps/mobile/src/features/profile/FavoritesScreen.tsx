import { Image } from 'expo-image';
import { FlatList, View } from 'react-native';

import { makeStyles, useNightTint } from '@/core/theme/theme';
import { sizes, spacing } from '@/core/theme/tokens';
import { AppText } from '@/shared/ui/AppText';
import { PressableScale } from '@/shared/ui/PressableScale';
import { Screen } from '@/shared/ui/Screen';
import { Skeleton } from '@/shared/ui/Skeleton';
import { StateMessage } from '@/shared/ui/StateMessage';

import { useFavoritesViewModel } from './useFavoritesViewModel';

const chevronIcon = require('@/assets/images/calendar/chevron-down.svg');

/** Els punts desats, amb accés directe a la fitxa. */
export function FavoritesScreen() {
  const vm = useFavoritesViewModel();
  const styles = useStyles();
  const tint = useNightTint();

  return (
    <Screen title={vm.title} back={vm.back}>
      {vm.loading ? (
        <View style={styles.loading} accessibilityLabel={vm.title}>
          <Skeleton height={sizes.button + spacing.md} />
          <Skeleton height={sizes.button + spacing.md} />
        </View>
      ) : vm.error ? (
        <StateMessage title={vm.error} action={{ label: vm.retryLabel, onPress: vm.retry }} fill />
      ) : vm.points.length === 0 ? (
        <StateMessage title={vm.empty} fill />
      ) : (
        <FlatList
          data={vm.points}
          keyExtractor={(point) => point.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <PressableScale
              accessibilityLabel={`${item.nom}, ${item.municipi}`}
              accessibilityHint={vm.openHint}
              onPress={() => vm.openPoint(item.id)}
              style={styles.row}
            >
              <View style={styles.copy}>
                <AppText variant="label" numberOfLines={2}>
                  {item.nom}
                </AppText>
                <AppText variant="caption" color="boira" numberOfLines={1}>
                  {item.municipi}
                </AppText>
              </View>
              <Image
                source={chevronIcon}
                tintColor={tint}
                style={styles.chevron}
                accessible={false}
              />
            </PressableScale>
          )}
        />
      )}
    </Screen>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  loading: { gap: spacing.sm },
  list: { paddingBottom: spacing.xl },
  row: {
    minHeight: sizes.button + spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.ms,
    borderBottomWidth: 1,
    borderBottomColor: colors.linia,
  },
  copy: { flex: 1, minWidth: 0, gap: spacing.xxs },
  chevron: { width: sizes.iconSmall, height: sizes.iconSmall, transform: [{ rotate: '-90deg' }] },
}));
