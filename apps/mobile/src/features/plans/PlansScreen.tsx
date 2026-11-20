import { Image } from 'expo-image';
import { FlatList, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { makeStyles, useTheme } from '@/core/theme/theme';
import { motion, radii, sizes, spacing } from '@/core/theme/tokens';
import { AppText } from '@/shared/ui/AppText';
import { Button } from '@/shared/ui/Button';
import { Chip } from '@/shared/ui/Chip';
import { PressableScale } from '@/shared/ui/PressableScale';
import { Screen } from '@/shared/ui/Screen';
import { Skeleton } from '@/shared/ui/Skeleton';
import { StateMessage } from '@/shared/ui/StateMessage';

import { type PlanListRow, type PlansSection, usePlansViewModel } from './usePlansViewModel';

const chevronIcon = require('@/assets/images/calendar/chevron-down.svg');

/** Mides del mockup 13: el requadre de la data fa 60 × 62. */
const DATE_BOX = 60;
const SKELETON_ROWS = 3;
const SKELETON_HEIGHT = 96;

/** Un pla: data, títol i sortida. Els passats s'atenuen; un de retirat no es pot obrir. */
function PlanRowView({
  row,
  index,
  past,
  onPress,
}: {
  row: PlanListRow;
  index: number;
  past: boolean;
  onPress: () => void;
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
      <PressableScale
        onPress={onPress}
        disabled={row.retired}
        accessibilityLabel={row.accessibilityLabel}
        accessibilityHint={row.accessibilityHint}
        accessibilityState={{ disabled: row.retired }}
        style={[styles.row, dimmed && styles.dimmedRow]}
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
        {row.retired ? null : (
          <Image
            source={chevronIcon}
            tintColor={colors.boira}
            style={styles.chevron}
            accessible={false}
          />
        )}
      </PressableScale>
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
            <PlanRowView row={item} index={index} past={past} onPress={() => vm.onOpen(item)} />
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
    <Screen title={vm.title} edges={['bottom', 'left', 'right']}>
      <View style={styles.tabs}>
        {vm.tabs.map((tab) => (
          <Chip key={tab.key} label={tab.label} selected={tab.selected} onPress={tab.onSelect} />
        ))}
      </View>
      <SectionContent key={vm.tab} section={past ? vm.past : vm.upcoming} past={past} vm={vm} />
    </Screen>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  tabs: { flexDirection: 'row', gap: spacing.sm },
  list: { gap: spacing.ms, paddingBottom: spacing.xl },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.linia,
    backgroundColor: colors.card,
  },
  // Els passats, com al Calendari: un altre fons i el títol en boira, sense opacitat, perquè el
  // text continuï ≥ 4,5:1 també en mode nit (ADR-0032).
  dimmedRow: { backgroundColor: colors.nit, borderColor: colors.vel },
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
}));
