import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { colors, sizes, spacing } from '@/core/theme/tokens';
import { PressableScale } from '@/shared/ui/PressableScale';

const closeIcon = {
  uri: `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${colors.lluna}" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>`,
  )}`,
};
const closeStyle = {
  width: sizes.touch,
  height: sizes.touch,
  alignItems: 'center',
  justifyContent: 'center',
} as const;
const closeIconStyle = { width: sizes.icon, height: sizes.icon };

/**
 * La creu del full del correu. Sobre la benvinguda (un modal) es presenta com a full i no té botó
 * enrere: sense aquesta creu no es podria tancar.
 */
export function EmailLoginCloseButton() {
  const { t } = useTranslation();
  return (
    <PressableScale
      onPress={() => router.back()}
      accessibilityLabel={t('emailLogin.close')}
      hitSlop={spacing.sm}
      style={closeStyle}
    >
      <Image source={closeIcon} style={closeIconStyle} accessible={false} />
    </PressableScale>
  );
}
