import { useTranslation } from 'react-i18next';
import { Linking } from 'react-native';

import { useCurrentPlaceQuery } from './locationRepository';

/**
 * La fila «Des d'on surts» amb la ubicació actual: l'estat (buscant, error, sense permís, a punt),
 * el text i què fa en prémer-la. La fan servir «Què vols veure?» i «Nova alerta» (TG-146).
 */
export function useOriginField() {
  const { t } = useTranslation();
  const location = useCurrentPlaceQuery();
  const { refetch } = location;
  const place = location.data?.status === 'ready' ? location.data.place : null;

  const origin = (() => {
    if (location.isPending) {
      return { state: 'loading' as const, label: t('explore.origin.locating'), hint: '' };
    }
    if (location.isError) {
      return {
        state: 'error' as const,
        label: t('explore.origin.error'),
        hint: t('explore.origin.retry'),
        onPress: () => void refetch(),
      };
    }
    if (location.data.status === 'denied') {
      const { canAskAgain } = location.data;
      return {
        state: 'denied' as const,
        label: t('explore.origin.denied'),
        hint: canAskAgain ? t('explore.origin.allow') : t('explore.origin.settings'),
        // Si el sistema encara ho deixa, es torna a demanar el permís; si no, a la configuració.
        onPress: () => void (canAskAgain ? refetch() : Linking.openSettings()),
      };
    }
    return {
      state: 'ready' as const,
      label: location.data.place.name || t('explore.origin.here'),
      hint: t('explore.origin.current'),
    };
  })();

  return { origin, place, refetch };
}
