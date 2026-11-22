import { Image } from 'expo-image';
import { router } from 'expo-router';
import type { StyleProp, ViewStyle } from 'react-native';

import { makeStyles, useNightTint } from '@/core/theme/theme';
import { radii, sizes } from '@/core/theme/tokens';

import { PressableScale } from './PressableScale';

const backIcon = require('@/assets/images/alerts/enrere.svg');

/**
 * Botó rodó per tornar enrere, del tema. Va en lloc del de la capçalera nativa, que des d'iOS 26 és
 * de vidre i en mode nit no es pot posar en vermell (ADR-0032).
 */
export function BackButton({
  label,
  onPress = () => router.back(),
  style,
}: {
  label: string;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();
  const tint = useNightTint();
  return (
    <PressableScale onPress={onPress} accessibilityLabel={label} style={[styles.back, style]}>
      <Image tintColor={tint} source={backIcon} style={styles.icon} accessible={false} />
    </PressableScale>
  );
}

const useStyles = makeStyles(({ colors }) => ({
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
  icon: { width: sizes.icon, height: sizes.icon },
}));
