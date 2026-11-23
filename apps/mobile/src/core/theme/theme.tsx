import { createContext, type PropsWithChildren, useContext } from 'react';
import { StyleSheet } from 'react-native';

import {
  type ColorToken,
  colors,
  colorsVermell,
  gradients,
  gradientsVermell,
  pointMapColors,
  pointMapColorsVermell,
} from './tokens';
import { useNightBrightness } from './useNightBrightness';

export type ThemeName = 'normal' | 'vermell';

type Gradient = {
  colors: readonly [string, string, ...string[]];
  locations: readonly [number, number, ...number[]];
};

export type Theme = {
  name: ThemeName;
  colors: Record<ColorToken, string>;
  gradients: Record<keyof typeof gradients, Gradient>;
  pointMapColors: Record<keyof typeof pointMapColors, string>;
};

/** Els temes de l'app (ADR-0032). Només canvien els colors: espaiats, mides i tipografia són fixos. */
export const themes: Record<ThemeName, Theme> = {
  normal: { name: 'normal', colors, gradients, pointMapColors },
  vermell: {
    name: 'vermell',
    colors: colorsVermell,
    gradients: gradientsVermell,
    pointMapColors: pointMapColorsVermell,
  },
};

const ThemeContext = createContext<Theme>(themes.normal);

/**
 * Dona el tema a tot l'arbre, també a les pantalles i als `Modal` que es presenten en una finestra
 * nativa. Qui decideix `name` és la TG-240 (activació automàtica i interruptor).
 */
export function ThemeProvider({
  name = 'normal',
  children,
}: PropsWithChildren<{ name?: ThemeName }>) {
  useNightBrightness(name === 'vermell');
  return <ThemeContext.Provider value={themes[name]}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}

/**
 * Color per a una icona SVG que porta el seu propi color: en mode nit es tenyeix perquè no surti
 * blava ni verda (ADR-0032). En el tema normal, `undefined`: la icona es veu tal com és.
 * Sobre un botó `primary`, `useNightTint('nit')`, com el text del botó.
 */
export function useNightTint(token: ColorToken = 'lluna'): string | undefined {
  const { name, colors } = useTheme();
  return name === 'vermell' ? colors[token] : undefined;
}

/**
 * `const useStyles = makeStyles(({ colors }) => ({ … }))` en lloc d'un `StyleSheet.create` amb els
 * colors en carregar el mòdul. Crea els estils un sol cop per tema, quan es demanen.
 */
export function makeStyles<S extends Styles>(factory: (theme: Theme) => S): () => Readonly<S> {
  const cache = new Map<ThemeName, Readonly<S>>();
  return function useStyles() {
    const theme = useTheme();
    const cached = cache.get(theme.name);
    if (cached) return cached;
    const styles = StyleSheet.create(factory(theme));
    cache.set(theme.name, styles);
    return styles;
  };
}

type Styles = Parameters<typeof StyleSheet.create>[0];
