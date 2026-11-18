import { themes } from '../theme';
import { type ColorToken } from '../tokens';

// Regles de la paleta del mode nit (ADR-0032). Si un valor no les compleix, el que canvia és el valor.
const { colors, gradients, pointMapColors } = themes.vermell;

const surfaces: ColorToken[] = ['nit', 'card', 'sheet', 'vel', 'crep'];
const text: ColorToken[] = ['lluna', 'boira'];
const accents: ColorToken[] = [
  'far',
  'ubicacio',
  'ras',
  'jus',
  'tap',
  'pedra',
  'fenomenEstels',
  'fenomenLluna',
  'fenomenSol',
  'fenomenConjuncio',
];

/** Lluminositat relativa de la WCAG 2.x. */
function luminance(hex: string) {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

function contrast(a: string, b: string) {
  const [la, lb] = [luminance(a), luminance(b)];
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

describe('paleta vermell', () => {
  it('només fa servir el canal vermell, també als degradats i al mapa', () => {
    const all = [
      ...Object.values(colors),
      ...Object.values(gradients).flatMap((g) => g.colors),
      ...Object.values(pointMapColors),
    ];
    for (const color of all) {
      expect(color === 'transparent' || /^#[0-9A-F]{2}0000([0-9A-F]{2})?$/i.test(color)).toBe(true);
    }
  });

  it.each(text)('el text %s és ≥ 4,5:1 sobre totes les superfícies', (token) => {
    for (const surface of surfaces) {
      expect(contrast(colors[token], colors[surface])).toBeGreaterThanOrEqual(4.5);
    }
  });

  it.each(accents)('l’accent %s és ≥ 3:1 sobre totes les superfícies', (token) => {
    for (const surface of surfaces) {
      expect(contrast(colors[token], colors[surface])).toBeGreaterThanOrEqual(3);
    }
  });

  it('el text sobre far (el color nit) és ≥ 4,5:1', () => {
    expect(contrast(colors.nit, colors.far)).toBeGreaterThanOrEqual(4.5);
  });

  it('el contrast es calcula com a la WCAG', () => {
    expect(contrast('#FFFFFF', '#000000')).toBeCloseTo(21);
    expect(contrast('#FF0000', '#000000')).toBeCloseTo(5.25, 2);
  });
});
