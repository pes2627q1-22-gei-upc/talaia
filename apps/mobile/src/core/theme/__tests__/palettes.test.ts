import { NIGHT_MAP_TINT } from '../nightMap';
import { themes } from '../theme';

// Regles de la paleta del mode nit (ADR-0032). Si un valor no les compleix, el que canvia és el valor.
// El contrast, el dels dos temes, el comprova contrast.test.ts.
const { colors, gradients, pointMapColors } = themes.vermell;

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

  it('la capa vermella dels mapes (multiply) no canvia cap color de la paleta', () => {
    // Els marcadors i els controls dels mapes no passen pel gris: només hi actua la capa.
    expect(NIGHT_MAP_TINT.background).toBe(colors.lluna);
    const multiply = (hex: string, tint: string) =>
      [1, 3, 5]
        .map((i) =>
          Math.round(
            (parseInt(hex.slice(i, i + 2), 16) * parseInt(tint.slice(i, i + 2), 16)) / 255,
          ),
        )
        .map((c) => c.toString(16).padStart(2, '0').toUpperCase())
        .reduce((out, c) => out + c, '#');
    for (const color of Object.values(colors)) {
      expect(multiply(color, NIGHT_MAP_TINT.background)).toBe(color.slice(0, 7).toUpperCase());
    }
  });
});
