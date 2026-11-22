/**
 * RNF05 (TG-126): contrast WCAG 2.2 AA del text dels tokens sobre les superfícies del tema, 4,5:1
 * (3:1 per al text gran: 24 pt, o 18,7 pt en negreta). Mesura i pendents: docs/rnf.md.
 * Val per als dos temes: el mode nit (ADR-0032) té les mateixes regles.
 */
import { type ThemeName, themes } from '../theme';
import { type ColorToken } from '../tokens';

const AA = 4.5;
const AA_LARGE = 3;

/** Luminància relativa (WCAG 2.2, sRGB). */
function luminance(hex: string): number {
  const channel = (offset: number) => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

function ratio(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light! + 0.05) / (dark! + 0.05);
}

function contrast(theme: ThemeName, a: ColorToken, b: ColorToken): number {
  const { colors } = themes[theme];
  return ratio(colors[a], colors[b]);
}

const THEMES: readonly ThemeName[] = ['normal', 'vermell'];
/** Superfícies on hi ha text: fons, targetes, fulls, etiquetes i estats actius. */
const SURFACES = ['nit', 'card', 'sheet', 'vel', 'crep'] as const;
/** Colors de text: el principal, el secundari, l'accent, les franges de l'índex i els del calendari. */
const TEXT = [
  'lluna',
  'boira',
  'far',
  'ras',
  'jus',
  'tap',
  'pedra',
  'fenomenEstels',
  'fenomenLluna',
  'fenomenSol',
  'fenomenConjuncio',
] as const;

const pairs = THEMES.flatMap((theme) =>
  TEXT.flatMap((text) => SURFACES.map((surface) => [theme, text, surface] as const)),
).filter(([theme, text, surface]) => !(theme === 'normal' && text === 'tap' && surface === 'crep'));

describe('contrast del text (RNF05, WCAG AA)', () => {
  it('calcula la ràtio de WCAG', () => {
    expect(ratio('#FFFFFF', '#000000')).toBeCloseTo(21);
    expect(ratio('#FF0000', '#000000')).toBeCloseTo(5.25, 2);
    expect(contrast('normal', 'lluna', 'nit')).toBeCloseTo(contrast('normal', 'nit', 'lluna'));
  });

  it.each(pairs)('%s: %s sobre %s arriba a 4,5:1', (theme, text, surface) => {
    expect(contrast(theme, text, surface)).toBeGreaterThanOrEqual(AA);
  });

  it.each(
    THEMES.flatMap((theme) =>
      (['far', 'lluna', 'ras', 'jus', 'tap'] as const).map((fill) => [theme, fill] as const),
    ),
  )('%s: nit sobre %s (botons i xips plens) arriba a 4,5:1', (theme, fill) => {
    expect(contrast(theme, 'nit', fill)).toBeGreaterThanOrEqual(AA);
  });

  // La ubicació és un punt al mapa, no text: n'hi ha prou amb 3:1 (WCAG 1.4.11).
  it.each(THEMES)('%s: la ubicació arriba a 3:1 sobre totes les superfícies', (theme) => {
    for (const surface of SURFACES) {
      expect(contrast(theme, 'ubicacio', surface)).toBeGreaterThanOrEqual(AA_LARGE);
    }
  });

  // 3,9:1: `tap` sobre `crep` només per a text gran. Avui no n'hi ha cap.
  it('normal: tap sobre crep arriba a 3:1 (només text gran)', () => {
    expect(contrast('normal', 'tap', 'crep')).toBeGreaterThanOrEqual(AA_LARGE);
  });
});
