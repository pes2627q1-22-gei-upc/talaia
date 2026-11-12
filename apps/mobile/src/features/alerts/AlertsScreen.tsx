import { Image } from 'expo-image';
import { FlatList, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { colors, motion, radii, spacing } from '@/core/theme/tokens';
import { AppText } from '@/shared/ui/AppText';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { Screen } from '@/shared/ui/Screen';
import { Skeleton } from '@/shared/ui/Skeleton';
import { StateMessage } from '@/shared/ui/StateMessage';
import { Toggle } from '@/shared/ui/Toggle';

import { GOAL_ICONS } from './goalIcons';
import { useAlertsViewModel } from './useAlertsViewModel';

type AlertItem = ReturnType<typeof useAlertsViewModel>['items'][number];

/** Mides del Figma (mockup 10): icona de 26 dins un quadrat de 52. */
const ICON_BOX = 52;
const ICON = 26;
const SKELETON_ROWS = 3;
const SKELETON_HEIGHT = 88;

const bellIcon = {
  uri: `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${colors.pedra}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15z"/><path d="M10 20.5a2.2 2.2 0 0 0 4 0"/></svg>`,
  )}`,
};

/** Una alerta: fenomen, resum i interruptor. Una de desactivada s'apaga. */
function AlertRow({ item, index }: { item: AlertItem; index: number }) {
  return (
    <Animated.View
      entering={FadeInDown.duration(motion.base)
        .delay(Math.min(index, 5) * motion.stagger)
        .easing(motion.enter)
        .withInitialValues({ opacity: 0, transform: [{ translateY: 6 }] })}
    >
      <Card style={styles.row}>
        <View style={[styles.iconBox, !item.active && styles.off]}>
          <Image
            source={GOAL_ICONS[item.goal]}
            tintColor={colors.pedra}
            style={styles.icon}
            accessible={false}
          />
        </View>
        <View style={[styles.text, !item.active && styles.off]} testID={`alert-text-${item.id}`}>
          <AppText variant="label">{item.name}</AppText>
          <AppText variant="small" color="boira">
            {item.summary}
          </AppText>
        </View>
        <Toggle
          value={item.active}
          onValueChange={item.onToggle}
          accessibilityLabel={item.toggleLabel}
          testID={`alert-toggle-${item.id}`}
        />
      </Card>
    </Animated.View>
  );
}

/** Pestanya «Alertes» (HU19, mockup 10): les alertes de l'usuari i el camí a «Nova alerta». */
export function AlertsScreen() {
  const vm = useAlertsViewModel();
  const createButton = (
    <Button label={vm.create.label} onPress={vm.create.onPress} haptic style={styles.create} />
  );

  return (
    <Screen title={vm.title} subtitle={vm.subtitle}>
      {vm.state === 'loading' ? (
        <View style={styles.list} testID="alerts-loading">
          {Array.from({ length: SKELETON_ROWS }, (_, index) => (
            <Skeleton key={index} height={SKELETON_HEIGHT} radius="md" />
          ))}
        </View>
      ) : vm.state === 'error' ? (
        <StateMessage fill title={vm.error.title} action={vm.error.retry} />
      ) : vm.state === 'empty' ? (
        <>
          <StateMessage icon={bellIcon} fill title={vm.empty.title} message={vm.empty.message} />
          {createButton}
        </>
      ) : (
        <FlatList
          data={vm.items}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => <AlertRow item={item} index={index} />}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={
            <>
              {vm.toggleError ? (
                <Animated.View entering={FadeIn.duration(motion.fast)}>
                  <AppText variant="small" color="tap" accessibilityRole="alert">
                    {vm.toggleError}
                  </AppText>
                </Animated.View>
              ) : null}
              {createButton}
            </>
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.ms, paddingBottom: spacing.xl },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  iconBox: {
    width: ICON_BOX,
    height: ICON_BOX,
    borderRadius: radii.md,
    backgroundColor: colors.vel,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { width: ICON, height: ICON },
  // El text ocupa el que queda i baixa de línia: l'interruptor no es tapa mai.
  text: { flex: 1, gap: spacing.xxs },
  off: { opacity: 0.5 },
  create: { marginTop: spacing.sm },
});
