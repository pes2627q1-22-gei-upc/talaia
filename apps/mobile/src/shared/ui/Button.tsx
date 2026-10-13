import type { ReactNode } from 'react';
import { type StyleProp, StyleSheet, type ViewStyle } from 'react-native';

import { type ColorToken, colors, radii, sizes, spacing } from '@/core/theme/tokens';

import { AppText } from './AppText';
import { PressableScale } from './PressableScale';

export type ButtonVariant = 'primary' | 'secondary' | 'light' | 'text';

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  /** Icona a l'esquerra del text (22 × 22 al Figma). */
  icon?: ReactNode;
  disabled?: boolean;
  haptic?: boolean;
  style?: StyleProp<ViewStyle>;
};

const labelColor: Record<ButtonVariant, ColorToken> = {
  primary: 'nit',
  secondary: 'lluna',
  light: 'nit',
  text: 'far',
};

/** Botó del design system. `primary` és l'acció principal de la pantalla (una sola). */
export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  disabled = false,
  haptic,
  style,
}: ButtonProps) {
  const isText = variant === 'text';
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      haptic={haptic}
      accessibilityState={{ disabled }}
      hitSlop={isText ? spacing.ms : undefined}
      style={[styles.base, styles[variant], disabled && styles.disabled, style]}
    >
      {icon}
      <AppText variant={isText ? 'link' : 'label'} color={labelColor[variant]}>
        {label}
      </AppText>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: sizes.button,
    paddingHorizontal: spacing.ml,
    borderRadius: radii.md,
  },
  primary: { backgroundColor: colors.far },
  secondary: { backgroundColor: colors.sheet, borderWidth: 1, borderColor: colors.vora },
  light: { backgroundColor: colors.lluna },
  text: { minHeight: 0, paddingHorizontal: 0, alignSelf: 'flex-start' },
  // ponytail: opacitat fixa; si el Figma dibuixa un estat desactivat, passa als tokens.
  disabled: { opacity: 0.4 },
});
