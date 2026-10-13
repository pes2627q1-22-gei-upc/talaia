import { colors } from '@/core/theme/tokens';

import NightMap from './NightMap';
import { useMapViewModel } from './useMapViewModel';

const chrome = { background: colors.nit, text: colors.boira, link: colors.lluna };

/** Pantalla del mapa (HU06): cartografia nocturna de l'ICGC amb relleu 3D. Els punts arriben amb TG-90. */
export function MapScreen() {
  const vm = useMapViewModel();
  return (
    <NightMap
      mapStyle={vm.mapStyle}
      camera={vm.camera}
      chrome={chrome}
      accessibilityLabel={vm.accessibilityLabel}
      dom={{
        style: { flex: 1, backgroundColor: colors.nit },
        scrollEnabled: false,
        bounces: false,
        overScrollMode: 'never',
        // De vora a vora. ponytail: l'Expo Go actual ho ignora i deixa una franja `nit` a dalt i a baix.
        contentInsetAdjustmentBehavior: 'never',
        automaticallyAdjustContentInsets: false,
      }}
    />
  );
}
