import { Easing } from 'react-native-reanimated';

/**
 * Tokens de disseny de Talaia (tema fosc, «Nit catalana»).
 * Font de veritat: docs/design-system.md i els mockups de Figma.
 * Regla: cap pantalla escriu colors, mides o espaiats a mà.
 */
export const colors = {
  nit: '#0E1433',
  card: '#141B42',
  sheet: '#161D45',
  vel: '#1E2657',
  crep: '#28316B',
  linia: '#26306A',
  vora: '#333D7A',
  lluna: '#EEF0F7',
  boira: '#9AA3C7',
  far: '#FFB547',
  ras: '#5FD4C4',
  jus: '#E3C58F',
  tap: '#E0708A',
  pedra: '#D9C4A0',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  ms: 12,
  md: 16,
  ml: 20,
  lg: 24,
  xl: 32,
} as const;

export const radii = {
  sm: 10,
  md: 16,
  lg: 20,
  pill: 999,
} as const;

/** Alçades fixes del Figma i la mida mínima de tacte (44 pt). */
export const sizes = {
  button: 54,
  chip: 34,
  touch: 44,
} as const;

/** Noms amb què `_layout.tsx` registra les fonts (`useFonts`). Cada pes és una família. */
export const fonts = {
  display: 'BigShouldersDisplay_800ExtraBold',
  regular: 'AtkinsonHyperlegibleNext_400Regular',
  semibold: 'AtkinsonHyperlegibleNext_600SemiBold',
  bold: 'AtkinsonHyperlegibleNext_700Bold',
  extrabold: 'AtkinsonHyperlegibleNext_800ExtraBold',
} as const;

/** Escala tipogràfica del Figma. Sense `fontWeight`: el pes ja és a la família. */
export const typography = {
  indexLg: { fontFamily: fonts.display, fontSize: 66, lineHeight: 62 },
  indexMd: { fontFamily: fonts.display, fontSize: 40, lineHeight: 38 },
  display: { fontFamily: fonts.display, fontSize: 38, lineHeight: 40 },
  title: { fontFamily: fonts.bold, fontSize: 22, lineHeight: 28 },
  heading: { fontFamily: fonts.bold, fontSize: 17, lineHeight: 22 },
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 23 },
  label: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 20 },
  small: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20 },
  chip: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 18 },
  caption: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 17 },
  tag: { fontFamily: fonts.bold, fontSize: 12, lineHeight: 16 },
  link: { fontFamily: fonts.bold, fontSize: 13, lineHeight: 17 },
  overline: {
    fontFamily: fonts.extrabold,
    fontSize: 10.5,
    lineHeight: 14,
    textTransform: 'uppercase',
  },
} as const;

/** Moviment (docs/design-system.md). Valors inicials: s'ajusten al dispositiu. */
export const motion = {
  fast: 150,
  base: 250,
  slow: 400,
  spring: { damping: 18, stiffness: 180 },
  enter: Easing.out(Easing.cubic),
  exit: Easing.in(Easing.cubic),
  pressedScale: 0.97,
} as const;

export type ColorToken = keyof typeof colors;
export type TypographyToken = keyof typeof typography;
