import { Image } from 'expo-image';
import { FlatList, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { makeStyles, useTheme } from '@/core/theme/theme';
import { motion, radii, sizes, spacing } from '@/core/theme/tokens';
import { AppText } from '@/shared/ui/AppText';
import { Button } from '@/shared/ui/Button';
import { Chip } from '@/shared/ui/Chip';
import { ConfirmationSheet } from '@/shared/ui/ConfirmationSheet';
import { PressableScale } from '@/shared/ui/PressableScale';
import { Screen } from '@/shared/ui/Screen';
import { Skeleton } from '@/shared/ui/Skeleton';
import { StateMessage } from '@/shared/ui/StateMessage';

import { type PlanListRow, type PlansSection, usePlansViewModel } from './usePlansViewModel';

const chevronIcon = require('@/assets/images/calendar/chevron-down.svg');
const trashIcon = require('@/assets/images/plans/trash.svg');

/** Mides del mockup 13: el requadre de la data fa 60 × 62. */
const DATE_BOX = 60;
const SKELETON_ROWS = 3;
const SKELETON_HEIGHT = 96;

/**
 * Un pla: data, títol i sortida, i la paperera (TG-162). Els passats i els d'un punt retirat
 * s'atenuen. La paperera és un botó a part perquè VoiceOver la trobi.
 */
function PlanRowView({
  row,
  index,
  past,
  onPress,
  onDelete,
}: {
  row: PlanListRow;
  index: number;
  past: boolean;
  onPress: () => void;
  onDelete: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const dimmed = past || row.retired;
  return (
    <Animated.View
      entering={FadeInDown.duration(motion.base)
        .delay(Math.min(index, 5) * motion.stagger)
        .easing(motion.enter)
        .withInitialValues({ opacity: 0, transform: [{ translateY: 6 }] })}
    >
      <View style={[styles.row, dimmed && styles.dimmedRow]}>
        <PressableScale
          onPress={onPress}
          accessibilityLabel={row.accessibilityLabel}
          accessibilityHint={row.accessibilityHint}
          style={styles.open}
          testID={`plan-row-${row.id}`}
        >
          <View style={[styles.dateBox, dimmed && styles.dimmedDateBox]}>
            <AppText variant="hourlyIndex" color={dimmed ? 'boira' : 'lluna'}>
              {row.day}
            </AppText>
            <AppText variant="chip" color="boira" style={styles.month}>
              {row.month}
            </AppText>
          </View>
          <View style={styles.text}>
            <AppText variant="label" color={dimmed ? 'boira' : 'lluna'}>
              {row.title}
            </AppText>
            <AppText variant="small" color="boira">
              {row.subtitle}
            </AppText>
          </View>
          <Image
            source={chevronIcon}
            tintColor={colors.boira}
            style={styles.chevron}
            accessible={false}
          />
        </PressableScale>
        <PressableScale
          onPress={onDelete}
          accessibilityRole="button"
          accessibilityLabel={row.deleteLabel}
          style={styles.delete}
          testID={`plan-delete-${row.id}`}
        >
          <Image source={trashIcon} tintColor={colors.boira} style={styles.deleteIcon} />
        </PressableScale>
      </View>
    </Animated.View>
  );
}

function SectionContent({
  section,
  past,
  vm,
}: {
  section: PlansSection;
  past: boolean;
  vm: ReturnType<typeof usePlansViewModel>;
}) {
  const styles = useStyles();
  switch (section.state) {
    case 'loading':
      return (
        <View style={styles.list} testID="plans-loading">
          {Array.from({ length: SKELETON_ROWS }, (_, index) => (
            <Skeleton key={index} height={SKELETON_HEIGHT} radius="lg" />
          ))}
        </View>
      );
    case 'error':
      return (
        <StateMessage
          fill
          title={vm.error.title}
          action={{ label: vm.error.retryLabel, onPress: section.retry }}
        />
      );
    case 'empty':
      return (
        <>
          <StateMessage fill title={section.empty.title} message={section.empty.message} />
          {past ? null : <Button label={vm.create.label} onPress={vm.create.onPress} haptic />}
        </>
      );
    case 'ready':
      return (
        <FlatList
          data={section.rows}
          keyExtractor={(row) => row.id}
          renderItem={({ item, index }) => (
            <PlanRowView
              row={item}
              index={index}
              past={past}
              onPress={() => vm.onOpen(item)}
              onDelete={() => vm.onDelete(item)}
            />
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      );
  }
}

/** «Els meus plans» (HU13, mockup 13): pastilles «Propers» i «Passats» i la llista de plans. */
export function PlansScreen() {
  const styles = useStyles();
  const vm = usePlansViewModel();
  const past = vm.tab === 'passats';
  return (
    <Screen title={vm.title} back={vm.back}>
      <View style={styles.tabs}>
        {vm.tabs.map((tab) => (
          <Chip key={tab.key} label={tab.label} selected={tab.selected} onPress={tab.onSelect} />
        ))}
      </View>
      <SectionContent key={vm.tab} section={past ? vm.past : vm.upcoming} past={past} vm={vm} />
      <ConfirmationSheet {...vm.deletion} />
    </Screen>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  tabs: { flexDirection: 'row', gap: spacing.sm },
  list: { gap: spacing.ms, paddingBottom: spacing.xl },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.md,
    paddingRight: spacing.xs,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.linia,
    backgroundColor: colors.card,
  },
  // Els passats, com al Calendari: un altre fons i el títol en boira, sense opacitat, perquè el
  // text continuï ≥ 4,5:1 també en mode nit (ADR-0032).
  dimmedRow: { backgroundColor: colors.nit, borderColor: colors.vel },
  open: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  dateBox: {
    width: DATE_BOX,
    minHeight: DATE_BOX,
    borderRadius: radii.md,
    backgroundColor: colors.vel,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xs,
  },
  dimmedDateBox: { backgroundColor: colors.card },
  month: { textTransform: 'uppercase' },
  text: { flex: 1, gap: spacing.xxs },
  chevron: {
    width: sizes.iconSmall,
    height: sizes.iconSmall,
    transform: [{ rotate: '-90deg' }],
  },
  delete: {
    width: sizes.touch,
    height: sizes.touch,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteIcon: { width: sizes.icon, height: sizes.icon },
}));
