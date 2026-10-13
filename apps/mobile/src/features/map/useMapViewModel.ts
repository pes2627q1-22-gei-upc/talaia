import { useTranslation } from 'react-i18next';

import type { MapCamera } from './NightMap';
import { nightStyle } from './style/nightStyle';

/**
 * Vista inicial i límits. Tota Catalunya amb la càmera inclinada perquè es vegi el relleu.
 * Les tessel·les de l'ICGC pesen molt a zoom baix (1,4 MB a z9): el mapa no s'allunya més enllà.
 * Constant de mòdul: el mapa es crea amb aquests valors i no es torna a muntar.
 */
export const camera: MapCamera = {
  center: [1.8, 41.75],
  zoom: 7.3,
  pitch: 50,
  minZoom: 6.5,
  maxZoom: 17,
  maxBounds: [-0.2, 40.3, 3.6, 43],
};

export function useMapViewModel() {
  const { t } = useTranslation();
  return {
    mapStyle: nightStyle,
    camera,
    accessibilityLabel: t('map.a11y'),
  };
}
