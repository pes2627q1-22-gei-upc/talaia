import { Image } from 'expo-image';
import { FlatList, View } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { makeStyles, useTheme } from '@/core/theme/theme';
import { motion, radii, sizes, spacing } from '@/core/theme/tokens';
import { AppText } from '@/shared/ui/AppText';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { ConfirmationSheet } from '@/shared/ui/ConfirmationSheet';
import { PressableScale } from '@/shared/ui/PressableScale';
import { Screen } from '@/shared/ui/Screen';
import { Skeleton } from '@/shared/ui/Skeleton';
import { StateMessage } from '@/shared/ui/StateMessage';
import { Toggle } from '@/shared/ui/Toggle';

import { GOAL_ICONS, NOTIFY_ICONS } from './goalIcons';
import { useAlertsViewModel } from './useAlertsViewModel';

type AlertItem = ReturnType<typeof useAlertsViewModel>['items'][number];

/** Mides del Figma (mockup 10): icona de 26 dins un quadrat de 52. */
const ICON_BOX = 52;
const ICON = 26;
const SKELETON_ROWS = 3;
const SKELETON_HEIGHT = 88;
// Un fitxer, com la fletxa enrere: una `data:` URI amb l'SVG no es pintava a Android.
const trashIcon = require('@/assets/images/alerts/paperera.svg');

// El color el posa `tintColor` (`pedra`), perquè canvia amb el tema.
const bellIcon = {
  uri: `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15z"/><path d="M10 20.5a2.2 2.2 0 0 0 4 0"/></svg>`,
  )}`,
};

/**
 * Una alerta: fenomen i resum (es prem per editar-la) i interruptor. Una de desactivada s'apaga.
 * Lliscant-la cap a l'esquerra apareix una paperera (HU20), que demana confirmació; amb el lector de
 * pantalla, és una acció de la fila.
 */
function AlertRow({ item, index }: { item: AlertItem; index: number }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Animated.View
      entering={FadeInDown.duration(motion.base)
        .delay(Math.min(index, 5) * motion.stagger)
        .easing(motion.enter)
        .withInitialValues({ opacity: 0, transform: [{ translateY: 6 }] })}
    >
      <ReanimatedSwipeable
        friction={2}
        rightThreshold={sizes.touch}
        overshootRight={false}
        renderRightActions={(_progress, _translation, swipeable) => (
          <PressableScale
            onPress={() => {
              item.delete.onPress();
              swipeable.close();
            }}
            accessibilityRole="button"
            accessibilityLabel={item.delete.label}
            style={styles.deleteAction}
            testID={`alert-delete-${item.id}`}
          >
            <Image
              source={trashIcon}
              tintColor={colors.nit}
              style={styles.deleteIcon}
              accessible={false}
              testID={`alert-delete-icon-${item.id}`}
            />
          </PressableScale>
        )}
        testID={`alert-swipe-${item.id}`}
      >
        <Card style={styles.row}>
          {/* L'interruptor queda fora del botó: cadascun es prem i es llegeix per separat. */}
          <PressableScale
            onPress={item.onPress}
            accessibilityHint={item.editHint}
            accessibilityActions={[{ name: 'delete', label: item.delete.label }]}
            onAccessibilityAction={(event) => {
              if (event.nativeEvent.actionName === 'delete') item.delete.onPress();
            }}
            style={styles.edit}
            testID={`alert-edit-${item.id}`}
          >
            <View style={[styles.iconBox, !item.active && styles.off]}>
              <Image
                source={GOAL_ICONS[item.goal]}
                tintColor={colors.pedra}
                style={styles.icon}
                accessible={false}
              />
            </View>
            <View
              style={[styles.text, !item.active && styles.off]}
              testID={`alert-text-${item.id}`}
            >
              <AppText variant="label">{item.name}</AppText>
              {/* El tipus d'avís, amb la seva icona: es distingeix d'un cop d'ull (TG-268). */}
              <View style={styles.notify} testID={`alert-notify-${item.id}`}>
                <Image
                  source={NOTIFY_ICONS[item.notify.type]}
                  tintColor={colors.far}
                  style={styles.notifyIcon}
                  accessible={false}
                  testID={`alert-notify-icon-${item.id}`}
                />
                <AppText variant="small" color="far" style={styles.shrink}>
                  {item.notify.text}
                </AppText>
              </View>
              <AppText variant="small" color="boira">
                {item.summary}
              </AppText>
            </View>
          </PressableScale>
          <Toggle
            value={item.active}
            onValueChange={item.onToggle}
            accessibilityLabel={item.toggleLabel}
            testID={`alert-toggle-${item.id}`}
          />
        </Card>
      </ReanimatedSwipeable>
    </Animated.View>
  );
}

/** Pestanya «Alertes» (HU19, mockup 10): les alertes de l'usuari i el camí a «Nova alerta». */
export function AlertsScreen() {
  const styles = useStyles();
  const vm = useAlertsViewModel();
  const createButton = (
    <Button label={vm.create.label} onPress={vm.create.onPress} haptic style={styles.create} />
  );

  return (
    <Screen title={vm.title} subtitle={vm.subtitle}>
      {vm.pushNotice ? (
        <Card style={styles.notice}>
          <AppText variant="small" color="boira">
            {vm.pushNotice.message}
          </AppText>
          {vm.pushNotice.action ? (
            <Button
              variant="text"
              label={vm.pushNotice.action.label}
              onPress={vm.pushNotice.action.onPress}
            />
          ) : null}
        </Card>
      ) : null}
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
      <ConfirmationSheet {...vm.deleteSheet} />
    </Screen>
  );
}

const useStyles = makeStyles(({ colors }) => ({
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
  // La part que es prem i el text ocupen el que queda i baixen de línia: l'interruptor no es
  // tapa mai.
  edit: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  text: { flex: 1, gap: spacing.xxs },
  notify: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  notifyIcon: { width: sizes.iconSmall, height: sizes.iconSmall },
  shrink: { flexShrink: 1 },
  off: { opacity: 0.5 },
  // Un cercle de la mida d'un botó, centrat al costat de la targeta.
  deleteAction: {
    width: sizes.button,
    height: sizes.button,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: colors.perill,
  },
  create: { marginTop: spacing.sm },
  notice: { gap: spacing.sm },
  deleteIcon: { width: sizes.icon, height: sizes.icon },
}));
