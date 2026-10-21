import { useState } from 'react';
import { StyleSheet, TextInput, type TextInputProps, View } from 'react-native';

import { colors, radii, sizes, spacing, typography } from '@/core/theme/tokens';

import { AppText } from './AppText';

type TextFieldProps = Omit<TextInputProps, 'style' | 'placeholderTextColor'> & {
  label: string;
  /** Text d'error sota el camp; també pinta la vora. */
  error?: string | null;
};

/**
 * Camp de text del design system (radi de formulari, 54 d'alçada). El focus i l'error canvien la
 * vora de cop: no és una animació, és un estat.
 */
export function TextField({ label, error, onFocus, onBlur, ...rest }: TextFieldProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.root}>
      <AppText variant="small" color="boira">
        {label}
      </AppText>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.boira}
        selectionColor={colors.far}
        keyboardAppearance="dark"
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        style={[styles.input, focused && styles.focused, error ? styles.invalid : null]}
        {...rest}
      />
      {error ? (
        <AppText variant="small" color="tap" accessibilityRole="alert">
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.sm },
  input: {
    ...typography.body,
    color: colors.lluna,
    minHeight: sizes.button,
    paddingHorizontal: spacing.md,
    borderRadius: radii.field,
    borderWidth: 1,
    borderColor: colors.vora,
    backgroundColor: colors.sheet,
  },
  focused: { borderColor: colors.far },
  invalid: { borderColor: colors.tap },
});
