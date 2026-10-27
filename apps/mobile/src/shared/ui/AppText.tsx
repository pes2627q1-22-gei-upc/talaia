import { Text, type TextProps } from 'react-native';

import { type ColorToken, colors, type TypographyToken, typography } from '@/core/theme/tokens';

type AppTextProps = TextProps & {
  variant?: TypographyToken;
  color?: ColorToken;
};

/** Text amb la tipografia i el color del tema. Cap pantalla posa `fontSize` ni `fontFamily` a mà. */
export function AppText({ variant = 'body', color = 'lluna', style, ...rest }: AppTextProps) {
  return <Text style={[typography[variant], { color: colors[color] }, style]} {...rest} />;
}
