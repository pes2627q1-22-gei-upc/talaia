import { FlatList, View } from 'react-native';

import { makeStyles } from '@/core/theme/theme';
import { radii, sizes, spacing } from '@/core/theme/tokens';
import { AppText } from '@/shared/ui/AppText';
import { PressableScale } from '@/shared/ui/PressableScale';
import { Sheet } from '@/shared/ui/Sheet';
import { Skeleton } from '@/shared/ui/Skeleton';
import { StateMessage } from '@/shared/ui/StateMessage';
import { TextField } from '@/shared/ui/TextField';

import type { PointSheetProps } from './usePlanFormFields';

/** Alçada màxima de la llista: el full no tapa mai tota la pantalla, ni amb el teclat obert. */
const LIST_MAX_HEIGHT = 320;
const SKELETON_ROWS = 4;

/** «Tria el punt» (TG-161): els punts publicats del mapa, amb una cerca per nom o municipi. */
export function PointSheet({
  visible,
  title,
  closeLabel,
  onClose,
  search,
  status,
  errorMessage,
  retryLabel,
  retry,
  emptyMessage,
  options,
}: PointSheetProps) {
  const styles = useStyles();
  return (
    <Sheet visible={visible} onClose={onClose} title={title} closeLabel={closeLabel}>
      <TextField
        label={search.label}
        value={search.value}
        onChangeText={search.onChange}
        autoCorrect={false}
        returnKeyType="search"
        testID="point-search"
      />
      {status === 'loading' ? (
        <View testID="points-loading" style={styles.content}>
          {Array.from({ length: SKELETON_ROWS }, (_, index) => (
            <Skeleton key={index} height={sizes.button} radius="field" />
          ))}
        </View>
      ) : status === 'error' ? (
        <StateMessage title={errorMessage} action={{ label: retryLabel, onPress: retry }} />
      ) : (
        <FlatList
          data={options}
          keyExtractor={(option) => option.id}
          style={styles.list}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          initialNumToRender={12}
          ListEmptyComponent={
            <AppText variant="small" color="boira" style={styles.empty}>
              {emptyMessage}
            </AppText>
          }
          renderItem={({ item: option }) => (
            <PressableScale
              onPress={option.onPress}
              haptic="selection"
              accessibilityRole="radio"
              accessibilityState={{ selected: option.selected }}
              accessibilityLabel={`${option.label}, ${option.hint}`}
              style={[styles.row, option.selected && styles.selected]}
            >
              <AppText variant="body" numberOfLines={1}>
                {option.label}
              </AppText>
              <AppText variant="small" color="boira" numberOfLines={1}>
                {option.hint}
              </AppText>
            </PressableScale>
          )}
        />
      )}
    </Sheet>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  list: { maxHeight: LIST_MAX_HEIGHT, marginTop: spacing.ms },
  content: { gap: spacing.sm },
  row: {
    minHeight: sizes.button,
    justifyContent: 'center',
    gap: spacing.xxs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.field,
    borderWidth: 1,
    borderColor: colors.linia,
    backgroundColor: colors.card,
  },
  selected: { borderColor: colors.far },
  empty: { textAlign: 'center' },
}));
