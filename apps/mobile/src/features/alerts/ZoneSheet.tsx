import { StyleSheet, View } from 'react-native';

import { colors, radii, spacing } from '@/core/theme/tokens';
import { camera } from '@/features/map/useMapViewModel';
import { AppText } from '@/shared/ui/AppText';
import { Button } from '@/shared/ui/Button';
import { Sheet } from '@/shared/ui/Sheet';

import type { useNewAlertViewModel } from './useNewAlertViewModel';
import ZonePickerMap from './ZonePickerMap';

type ZoneSheetProps = ReturnType<typeof useNewAlertViewModel>['zoneSheet'];

const MAP_HEIGHT = 360;
/** L'agulla: un anell `far` amb un punt al mig, just al centre del mapa. */
const PIN = 22;
const PIN_DOT = 6;
const chrome = { background: colors.nit, text: colors.boira, link: colors.lluna };

/** Full per triar «Una zona concreta»: es mou el mapa sota l'agulla i es confirma. */
export function ZoneSheet({
  visible,
  title,
  hint,
  mapLabel,
  mapStyle,
  center,
  zoom,
  onCenterChange,
  confirm,
  onClose,
  closeLabel,
}: ZoneSheetProps) {
  return (
    <Sheet visible={visible} onClose={onClose} title={title} closeLabel={closeLabel}>
      <AppText variant="small" color="boira">
        {hint}
      </AppText>
      <View style={styles.map}>
        {visible ? (
          <ZonePickerMap
            mapStyle={mapStyle}
            center={center}
            zoom={zoom}
            maxBounds={camera.maxBounds}
            chrome={chrome}
            accessibilityLabel={mapLabel}
            onCenterChange={onCenterChange}
            dom={{
              // Transparent per evitar el flaix blanc del WebView (com a MapScreen).
              style: styles.webView,
              scrollEnabled: false,
              bounces: false,
              overScrollMode: 'never',
              contentInsetAdjustmentBehavior: 'never',
              automaticallyAdjustContentInsets: false,
            }}
          />
        ) : null}
        <View pointerEvents="none" style={styles.pinLayer}>
          <View style={styles.pin}>
            <View style={styles.pinDot} />
          </View>
        </View>
      </View>
      <Button label={confirm.label} onPress={confirm.onPress} disabled={confirm.disabled} haptic />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  map: {
    height: MAP_HEIGHT,
    borderRadius: radii.md,
    overflow: 'hidden',
    backgroundColor: colors.nit,
    marginVertical: spacing.sm,
  },
  webView: { flex: 1, backgroundColor: 'transparent' },
  pinLayer: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  pin: {
    width: PIN,
    height: PIN,
    borderRadius: PIN / 2,
    borderWidth: 3,
    borderColor: colors.far,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinDot: {
    width: PIN_DOT,
    height: PIN_DOT,
    borderRadius: PIN_DOT / 2,
    backgroundColor: colors.far,
  },
});
