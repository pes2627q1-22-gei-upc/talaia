import { Image } from 'expo-image';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';

import { colors, radii, sizes, spacing } from '@/core/theme/tokens';
import { AppText } from '@/shared/ui/AppText';
import { IndexIndicator } from '@/shared/ui/IndexIndicator';
import { PressableScale } from '@/shared/ui/PressableScale';
import { Skeleton } from '@/shared/ui/Skeleton';

import { useRankingSheetMotion } from './useRankingSheetMotion';
import type { RecommendationsViewModel } from './useRecommendationsViewModel';

type Sheet = RecommendationsViewModel['sheet'];
type Row = Sheet['rows'][number];

const clockIcon = require('@/assets/images/explora/rellotge.svg');
const carIcon = {
  uri: `data:image/svg+xml;utf8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="${colors.boira}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M5 16.5V12l1.8-4.4A1.6 1.6 0 0 1 8.3 6.6h7.4a1.6 1.6 0 0 1 1.5 1L19 12v4.5"/>
      <path d="M4 12h16v4.5H4z"/>
      <circle cx="7.6" cy="14.2" r=".6"/><circle cx="16.4" cy="14.2" r=".6"/>
      <path d="M6.5 16.5v1.6M17.5 16.5v1.6"/>
    </svg>
  `)}`,
};

/** Desplegat, el full no passa de la meitat de la pantalla: el mapa s'ha de continuar veient. */
const MAX_HEIGHT = 0.5;

/** Full fix sota el mapa amb els millors punts (mockup 03). Cada fila obre la fitxa del punt. */
export function RecommendationsSheet({ sheet }: { sheet: Sheet }) {
  const { height } = useWindowDimensions();
  const drag = useRankingSheetMotion(sheet.collapsed, sheet.onSetCollapsed);

  return (
    <Animated.View
      testID="ranking-sheet"
      onLayout={drag.onLayout}
      style={[
        styles.sheet,
        { maxHeight: height * MAX_HEIGHT, paddingBottom: spacing.sm },
        drag.panelStyle,
      ]}
    >
      {/* Només la nansa captura el gest: la llista conserva el seu desplaçament vertical. */}
      <GestureDetector gesture={drag.pan}>
        <PressableScale
          onPress={sheet.onToggleCollapsed}
          accessibilityLabel={sheet.collapseLabel}
          accessibilityState={{ expanded: !sheet.collapsed }}
          onAccessibilityEscape={() => sheet.onSetCollapsed(true)}
          accessibilityActions={[{ name: 'activate', label: sheet.collapseLabel }]}
          onAccessibilityAction={() => sheet.onToggleCollapsed()}
          style={styles.header}
        >
          <View style={styles.handle} />
        </PressableScale>
      </GestureDetector>
      <Animated.View
        style={[styles.content, drag.contentStyle]}
        pointerEvents={sheet.collapsed ? 'none' : 'auto'}
        accessibilityElementsHidden={sheet.collapsed}
        importantForAccessibility={sheet.collapsed ? 'no-hide-descendants' : 'auto'}
      >
        <View style={styles.titleRow}>
          <AppText
            variant="heading"
            accessibilityRole="header"
            style={styles.title}
            onPress={sheet.onToggleCollapsed}
          >
            {sheet.title}
          </AppText>
          {sheet.toggle && (
            <PressableScale onPress={sheet.toggle.onPress} hitSlop={spacing.ms}>
              <AppText variant="link" color="far">
                {sheet.toggle.label}
              </AppText>
            </PressableScale>
          )}
        </View>
        <ScrollView style={styles.results} showsVerticalScrollIndicator={false}>
          {sheet.state === 'loading' && (
            <View
              accessible
              accessibilityLabel={sheet.loadingLabel}
              accessibilityState={{ busy: true }}
              style={styles.loading}
            >
              {[0, 1, 2].map((key) => (
                <Skeleton key={key} height={64} radius="md" />
              ))}
            </View>
          )}

          {sheet.state === 'error' && (
            <View style={styles.message} accessibilityLiveRegion="polite">
              <AppText variant="label">{sheet.errorLabel}</AppText>
              <PressableScale onPress={sheet.onRetry} hitSlop={spacing.ms}>
                <AppText variant="link" color="far">
                  {sheet.retryLabel}
                </AppText>
              </PressableScale>
            </View>
          )}

          {sheet.state === 'empty' && (
            <View style={styles.message} accessibilityLiveRegion="polite">
              <AppText variant="label">{sheet.emptyTitle}</AppText>
              <AppText variant="small" color="boira">
                {sheet.emptyHint}
              </AppText>
            </View>
          )}

          {sheet.state === 'ready' && (
            <View>
              {sheet.notice && (
                <AppText
                  variant="small"
                  color="boira"
                  style={styles.message}
                  accessibilityLiveRegion="polite"
                >
                  {sheet.notice}
                </AppText>
              )}
              {sheet.rows.map((row) => (
                <RecommendationRow key={row.id} row={row} />
              ))}
            </View>
          )}
        </ScrollView>
      </Animated.View>
    </Animated.View>
  );
}

function RecommendationRow({ row }: { row: Row }) {
  return (
    <PressableScale
      onPress={row.onPress}
      accessibilityLabel={row.accessibilityLabel}
      style={[styles.row, row.highlighted && styles.highlighted]}
    >
      <View style={styles.index}>
        {row.index ? (
          <IndexIndicator index={row.index} />
        ) : (
          <AppText variant="indexMd" color="boira">
            –
          </AppText>
        )}
      </View>
      <View style={styles.info}>
        <AppText variant="label" numberOfLines={1}>
          {row.name}
        </AppText>
        <View style={styles.meta}>
          {row.hour && <Meta icon={clockIcon} text={row.hour} />}
          {row.distance && (
            <AppText variant="small" color="boira">
              {row.distance}
            </AppText>
          )}
          <Meta icon={carIcon} text={row.travel} />
        </View>
      </View>
      <AppText variant="tag" color="boira">
        {row.rank}
      </AppText>
    </PressableScale>
  );
}

function Meta({ icon, text }: { icon: number | { uri: string }; text: string }) {
  return (
    <View style={styles.metaItem}>
      <Image source={icon} tintColor={colors.boira} style={styles.metaIcon} accessible={false} />
      <AppText variant="small" color="boira">
        {text}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    gap: spacing.xs,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    borderTopWidth: 1,
    borderColor: colors.vora,
    backgroundColor: colors.sheet,
    overflow: 'hidden',
  },
  header: {
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: sizes.touch,
    // La zona de gest continua fent 44 pt, però ocupa 20 pt al disseny.
    marginVertical: -spacing.ms,
  },
  content: { flexShrink: 1, gap: spacing.ms },
  results: { flexShrink: 1 },
  handle: {
    alignSelf: 'center',
    width: sizes.handleWidth,
    height: sizes.handleHeight,
    borderRadius: radii.pill,
    backgroundColor: colors.vora,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.ms },
  title: { flex: 1 },
  loading: { gap: spacing.sm },
  message: { gap: spacing.xs, paddingBottom: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.ms,
    paddingVertical: spacing.ms,
    paddingRight: spacing.ms,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  highlighted: { borderColor: colors.vora, backgroundColor: colors.vel },
  index: { width: sizes.rankIndex, alignItems: 'center' },
  info: { flex: 1, gap: spacing.xs },
  meta: { flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.md, rowGap: spacing.xs },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  metaIcon: { width: sizes.iconSmall, height: sizes.iconSmall },
});
