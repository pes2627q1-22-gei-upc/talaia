import { Image } from 'expo-image';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radii, sizes, spacing } from '@/core/theme/tokens';
import { AppText } from '@/shared/ui/AppText';
import { PressableScale } from '@/shared/ui/PressableScale';

import NightMap from './NightMap';
import { useMapViewModel } from './useMapViewModel';

const chrome = { background: colors.nit, text: colors.boira, link: colors.lluna };

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

/** Mapa nocturn amb relleu 3D i punts d'observació segons el seu índex. */
export function MapScreen() {
  const vm = useMapViewModel();
  const insets = useSafeAreaInsets();
  const canRetry = vm.notice?.kind === 'error' || vm.notice?.kind === 'empty';

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
        dom={{
          style: { flex: 1, backgroundColor: colors.nit },
          scrollEnabled: false,
          bounces: false,
          overScrollMode: 'never',
          contentInsetAdjustmentBehavior: 'never',
          automaticallyAdjustContentInsets: false,
        }}
      />
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
                hitSlop={8}
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
