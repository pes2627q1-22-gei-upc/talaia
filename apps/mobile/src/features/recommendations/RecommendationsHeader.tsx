import { View } from 'react-native';

import { makeStyles, useTheme } from '@/core/theme/theme';
import { radii, sizes, spacing } from '@/core/theme/tokens';
import { AppText } from '@/shared/ui/AppText';

import type { RecommendationsViewModel } from './useRecommendationsViewModel';

type Header = RecommendationsViewModel['header'];

/** La cerca que ha portat aquí («Pluja d'estels, aquesta nit · Des de Girona…»), mockup 03. */
export function RecommendationsSummary({ header }: { header: Header }) {
  const styles = useStyles();
  return (
    <View style={styles.card} accessible accessibilityRole="header">
      <AppText variant="label" numberOfLines={header.eventDate ? undefined : 1}>
        {header.title}
      </AppText>
      {header.eventDate && (
        <AppText variant="small" color="boira">
          {header.eventDate}
        </AppText>
      )}
      <AppText variant="small" color="boira" numberOfLines={header.eventDate ? undefined : 1}>
        {header.subtitle}
      </AppText>
    </View>
  );
}

/**
 * Què vol dir el color dels marcadors. En mode nit el color no les distingeix, i cada franja té la
 * forma del seu marcador: cel ras, ple; justet, anell; tapat, anell discontinu.
 */
export function IndexLegend({ items }: { items: Header['legend'] }) {
  const styles = useStyles();
  const { name, colors } = useTheme();
  const night = name === 'vermell';
  return (
    <View style={styles.legend}>
      {items.map((item) => (
        <View key={item.franja} style={styles.chip}>
          <View
            testID={`legend-${item.franja}`}
            style={
              night
                ? [
                    styles.nightDot,
                    { borderColor: colors[item.franja] },
                    item.franja === 'ras' && { backgroundColor: colors[item.franja] },
                    item.franja === 'tap' && styles.dashed,
                  ]
                : [styles.dot, { backgroundColor: colors[item.franja] }]
            }
          />
          <AppText variant="tag">{item.label}</AppText>
        </View>
      ))}
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  card: {
    flex: 1,
    gap: spacing.xxs,
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
    gap: spacing.xs,
    paddingHorizontal: spacing.ms,
    // Amb el text de l'etiqueta, fa l'alçada d'un xip (34).
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.vora,
    backgroundColor: colors.sheet,
  },
  dot: { width: sizes.legendDot, height: sizes.legendDot, borderRadius: radii.pill },
  // Més gran que el punt: l'anell i l'anell discontinu s'han de veure.
  nightDot: {
    width: sizes.legendDot + spacing.xs,
    height: sizes.legendDot + spacing.xs,
    borderRadius: radii.pill,
    borderWidth: 1.5,
  },
  dashed: { borderStyle: 'dashed' },
}));
