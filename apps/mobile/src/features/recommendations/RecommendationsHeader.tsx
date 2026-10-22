import { StyleSheet, View } from 'react-native';

import { colors, radii, spacing } from '@/core/theme/tokens';
import { AppText } from '@/shared/ui/AppText';

import type { RecommendationsViewModel } from './useRecommendationsViewModel';

type Header = RecommendationsViewModel['header'];

/** La cerca que ha portat aquí («Pluja d'estels, aquesta nit · Des de Girona…»), mockup 03. */
export function RecommendationsSummary({ header }: { header: Header }) {
  return (
    <View style={styles.card} accessible accessibilityRole="header">
      <AppText variant="label" numberOfLines={1}>
        {header.title}
      </AppText>
      <AppText variant="small" color="boira" numberOfLines={1}>
        {header.subtitle}
      </AppText>
    </View>
  );
}

/** Què vol dir el color dels marcadors. */
export function IndexLegend({ items }: { items: Header['legend'] }) {
  return (
    <View style={styles.legend}>
      {items.map((item) => (
        <View key={item.franja} style={styles.chip}>
          <View style={[styles.dot, { backgroundColor: colors[item.franja] }]} />
          <AppText variant="tag">{item.label}</AppText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    gap: 2,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.vora,
    backgroundColor: colors.sheet,
  },
  legend: { flexDirection: 'row', gap: spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    paddingHorizontal: spacing.ms,
    paddingVertical: spacing.xs + 2,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.vora,
    backgroundColor: colors.sheet,
  },
  dot: { width: 8, height: 8, borderRadius: radii.pill },
});
