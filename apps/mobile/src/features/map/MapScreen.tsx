import { Image } from 'expo-image';
import { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radii, sizes, spacing } from '@/core/theme/tokens';
import { AppText } from '@/shared/ui/AppText';
import { PressableScale } from '@/shared/ui/PressableScale';

import { IndexLegend, RecommendationsSummary } from '../recommendations/RecommendationsHeader';
import { RecommendationsSheet } from '../recommendations/RecommendationsSheet';

import NightMap from './NightMap';
import { useMapViewModel } from './useMapViewModel';

const chrome = { background: colors.nit, text: colors.boira, link: colors.lluna };

/**
 * Marges de l'enquadrament (mockup 03): la capçalera i la llegenda a dalt, i el full a baix (obert
 * o plegat). A dalt i als costats, també l'espai del marcador, que es dibuixa per sobre del punt.
 */
const FIT_TOP = 210;
const FIT_BOTTOM = 390;
const FIT_BOTTOM_COLLAPSED = 170;
const FIT_SIDE = 44;

const markerPalette = {
  background: colors.nit,
  clusterBackground: colors.crep,
  clusterBorder: colors.vora,
  text: colors.lluna,
  unknown: colors.boira,
  ras: colors.ras,
  jus: colors.jus,
  tap: colors.tap,
};

const retryIcon = {
  uri: `data:image/svg+xml;utf8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
      fill="none" stroke="${colors.far}" stroke-width="1.8"
      stroke-linecap="round" stroke-linejoin="round">
      <path d="M11 19.7A7.7 7.7 0 1 1 18.7 12V14.7"/>
      <path d="M16.6 12.6L18.7 14.7L20.8 12.6"/>
    </svg>
  `)}`,
};

const backIcon = {
  uri: `data:image/svg+xml;utf8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
      fill="none" stroke="${colors.lluna}" stroke-width="2"
      stroke-linecap="round" stroke-linejoin="round">
      <path d="M14.5 6L8.5 12L14.5 18"/>
    </svg>
  `)}`,
};

/**
 * Mapa nocturn amb relleu 3D i punts d'observació segons el seu índex. Amb una cerca de «Què vols
 * veure?», només els punts del rànquing, amb la cerca a dalt i els millors punts a baix (mockup 03).
 */
export function MapScreen() {
  const vm = useMapViewModel();
  const insets = useSafeAreaInsets();
  const canRetry = vm.notice?.kind === 'error' || vm.notice?.kind === 'empty';
  const recommendations = vm.recommendations;
  const bounds = recommendations?.bounds ?? null;
  const collapsed = recommendations?.sheet.collapsed ?? false;
  // Amb un rànquing, la càmera s'enquadra als punts i a l'origen, sense que els tapin la capçalera
  // ni el full dels millors punts.
  const fit = useMemo(
    () =>
      bounds
        ? {
            bounds,
            padding: {
              top: insets.top + FIT_TOP,
              bottom: collapsed ? FIT_BOTTOM_COLLAPSED : FIT_BOTTOM,
              left: FIT_SIDE,
              right: FIT_SIDE,
            },
          }
        : null,
    [bounds, insets.top, collapsed],
  );

  return (
    <View style={styles.container}>
      <NightMap
        mapStyle={vm.mapStyle}
        camera={vm.camera}
        chrome={chrome}
        accessibilityLabel={vm.accessibilityLabel}
        userLocation={vm.userLocation}
        userHeading={vm.userHeading}
        locationActive={vm.locationActive}
        userLocationLabel={vm.userLocationLabel}
        userLocationColor={colors.ubicacio}
        points={vm.points}
        markerPalette={markerPalette}
        onPointPress={vm.openPoint}
        cluster={!recommendations}
        fit={fit}
        dom={{
          // Transparent: un WKWebView opac pinta blanc fins que la pàgina fa el primer dibuix.
          // Mentrestant es veu el fons nit del contenidor.
          style: { flex: 1, backgroundColor: 'transparent' },
          scrollEnabled: false,
          bounces: false,
          overScrollMode: 'never',
          contentInsetAdjustmentBehavior: 'never',
          automaticallyAdjustContentInsets: false,
        }}
      />
      <View style={[styles.top, { top: insets.top + spacing.sm }]} pointerEvents="box-none">
        <View style={styles.topRow}>
          <PressableScale
            onPress={vm.back.onPress}
            accessibilityLabel={vm.back.label}
            style={styles.back}
          >
            <Image source={backIcon} style={styles.backIcon} accessible={false} />
          </PressableScale>
          {recommendations && <RecommendationsSummary header={recommendations.header} />}
        </View>
        {recommendations && <IndexLegend items={recommendations.header.legend} />}
      </View>
      {recommendations && <RecommendationsSheet sheet={recommendations.sheet} />}
      {vm.notice && (
        <View
          style={[styles.notice, { top: insets.top + sizes.button + spacing.sm }]}
          accessibilityLiveRegion="polite"
          accessibilityState={{ busy: vm.notice.kind === 'loading' }}
        >
          {canRetry ? (
            <View style={styles.retryContainer}>
              <View style={styles.noticeText}>
                <AppText variant="label">{vm.notice.title}</AppText>
                {vm.notice.description && (
                  <AppText variant="small" color="boira">
                    {vm.notice.description}
                  </AppText>
                )}
              </View>

              <PressableScale
                onPress={vm.retry}
                accessibilityLabel={vm.retryLabel}
                accessibilityRole="button"
                style={styles.retryActionRow}
                hitSlop={spacing.ms}
              >
                <AppText variant="label" style={styles.retryText}>
                  {vm.retryLabel}
                </AppText>
                <Image source={retryIcon} style={styles.retryIcon} accessible={false} />
              </PressableScale>
            </View>
          ) : (
            <View style={styles.noticeRow}>
              {vm.notice.kind === 'loading' && (
                <ActivityIndicator
                  testID="map-loading-indicator"
                  size="small"
                  color={colors.far}
                  accessibilityElementsHidden
                  importantForAccessibility="no"
                />
              )}
              <View style={styles.noticeText}>
                <AppText variant="label">{vm.notice.title}</AppText>
                {vm.notice.description && (
                  <AppText variant="small" color="boira">
                    {vm.notice.description}
                  </AppText>
                )}
              </View>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.nit },
  top: { position: 'absolute', left: spacing.md, right: spacing.md, gap: spacing.ms },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  back: {
    width: sizes.touch,
    height: sizes.touch,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.vora,
    backgroundColor: colors.sheet,
  },
  backIcon: { width: sizes.icon, height: sizes.icon },
  noticeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.ms },
  noticeText: { flex: 1, gap: spacing.xs },
  retryContainer: {
    gap: spacing.sm,
  },
  retryActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: spacing.xs,
    gap: spacing.xs,
  },
  retryText: {
    color: colors.far,
  },
  retryIcon: { width: sizes.icon, height: sizes.icon },
  notice: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    padding: spacing.md,
    gap: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.vora,
    backgroundColor: colors.sheet,
  },
});
