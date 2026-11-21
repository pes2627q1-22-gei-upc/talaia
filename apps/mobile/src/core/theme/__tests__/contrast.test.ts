/**
 * RNF05 (TG-126): contrast WCAG 2.2 AA del text dels tokens sobre les superfícies del tema, 4,5:1
 * (3:1 per al text gran: 24 pt, o 18,7 pt en negreta). Mesura i pendents: docs/rnf.md.
 */
import { type ColorToken, colors } from '../tokens';

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

function contrast(a: ColorToken, b: ColorToken): number {
  const [light, dark] = [luminance(colors[a]), luminance(colors[b])].sort((x, y) => y - x);
  return (light! + 0.05) / (dark! + 0.05);
}

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

const pairs = TEXT.flatMap((text) => SURFACES.map((surface) => [text, surface] as const)).filter(
  ([text, surface]) => !(text === 'tap' && surface === 'crep'),
);

describe('contrast del text (RNF05, WCAG AA)', () => {
  it('calcula la ràtio de WCAG', () => {
    expect(contrast('lluna', 'lluna')).toBeCloseTo(1);
    expect(contrast('lluna', 'nit')).toBeCloseTo(contrast('nit', 'lluna'));
  });

  it.each(pairs)('%s sobre %s arriba a 4,5:1', (text, surface) => {
    expect(contrast(text, surface)).toBeGreaterThanOrEqual(AA);
  });

  it.each(['far', 'lluna', 'ras', 'jus', 'tap'] as const)(
    'nit sobre %s (botons i xips plens) arriba a 4,5:1',
    (fill) => {
      expect(contrast('nit', fill)).toBeGreaterThanOrEqual(AA);
    },
  );

  // 3,9:1: `tap` sobre `crep` només per a text gran. Avui no n'hi ha cap.
  it('tap sobre crep arriba a 3:1 (només text gran)', () => {
    expect(contrast('tap', 'crep')).toBeGreaterThanOrEqual(AA_LARGE);
  });
});
