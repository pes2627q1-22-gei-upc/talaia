import { Image } from 'expo-image';
import { ScrollView, StyleSheet, View } from 'react-native';

import { colors, radii, sizes, spacing } from '@/core/theme/tokens';
import { AppText } from '@/shared/ui/AppText';
import { PressableScale } from '@/shared/ui/PressableScale';
import { Sheet } from '@/shared/ui/Sheet';
import { Skeleton } from '@/shared/ui/Skeleton';
import { StateMessage } from '@/shared/ui/StateMessage';

import type { useNewPlanViewModel } from './useNewPlanViewModel';

type EventSheetProps = ReturnType<typeof useNewPlanViewModel>['eventSheet'];

/** Alçada màxima de la llista: el full no tapa mai tota la pantalla. */
const LIST_MAX_HEIGHT = 360;

/** «Fenomen»: «Cap en concret» i els fenòmens del calendari al voltant del dia del pla. */
export function EventSheet({
  visible,
  title,
  closeLabel,
  onClose,
  status,
  errorMessage,
  retryLabel,
  retry,
  emptyMessage,
  options,
}: EventSheetProps) {
  return (
    <Sheet visible={visible} onClose={onClose} title={title} closeLabel={closeLabel}>
      <ScrollView style={styles.list} contentContainerStyle={styles.content}>
        {options.map((option) => (
          <PressableScale
            key={option.id}
            onPress={option.onPress}
            haptic="selection"
            accessibilityRole="radio"
            accessibilityState={{ selected: option.selected }}
            accessibilityLabel={option.hint ? `${option.label}, ${option.hint}` : option.label}
            style={[styles.row, option.selected && styles.selected]}
          >
            <Image
              source={option.icon}
              tintColor={colors.lluna}
              style={styles.icon}
              accessible={false}
            />
            <View style={styles.text}>
              <AppText variant="body" numberOfLines={2}>
                {option.label}
              </AppText>
              {option.hint ? (
                <AppText variant="small" color="boira">
                  {option.hint}
                </AppText>
              ) : null}
            </View>
          </PressableScale>
        ))}
        {status === 'loading' ? (
          <View testID="events-loading" style={styles.row}>
            <Skeleton width="60%" height={14} />
          </View>
        ) : null}
        {status === 'error' ? (
          <StateMessage title={errorMessage} action={{ label: retryLabel, onPress: retry }} />
        ) : null}
        {status === 'ok' && options.length === 1 ? (
          <AppText variant="small" color="boira" style={styles.empty}>
            {emptyMessage}
          </AppText>
        ) : null}
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  list: { maxHeight: LIST_MAX_HEIGHT },
  content: { gap: spacing.sm },
  row: {
    minHeight: sizes.button,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.ms,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.field,
    borderWidth: 1,
    borderColor: colors.linia,
    backgroundColor: colors.card,
  },
  selected: { borderColor: colors.far },
  icon: { width: sizes.icon, height: sizes.icon },
  text: { flex: 1, gap: spacing.xxs },
  empty: { textAlign: 'center' },
});
