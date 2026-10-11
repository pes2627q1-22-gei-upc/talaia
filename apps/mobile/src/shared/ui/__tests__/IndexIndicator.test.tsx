import { render, screen } from '@testing-library/react-native';

import i18n from '@/core/i18n';
import { colors } from '@/core/theme/tokens';

import { IndexIndicator } from '../IndexIndicator';

describe('IndexIndicator', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('ca');
  });

  it.each([
    ['ras', 87, 'Cel ras'],
    ['jus', 52, 'Justet'],
    ['tap', 31, 'Tapat'],
  ] as const)(
    'pinta la franja %s amb el seu token i la seva etiqueta',
    async (franja, valor, level) => {
      await render(<IndexIndicator index={{ valor, franja }} />);
      expect(screen.getByText(String(valor))).toHaveStyle({ color: colors[franja] });
      expect(screen.getByText(level)).toHaveStyle({ color: colors[franja] });
      expect(
        screen.getByLabelText(`Índex de visibilitat: ${valor} de 100, ${level}`),
      ).toBeOnTheScreen();
    },
  );

  it('limita el valor a 0–100 i l’arrodoneix', async () => {
    await render(<IndexIndicator index={{ valor: 104.6, franja: 'ras' }} />);
    expect(screen.getByText('100')).toBeOnTheScreen();
  });

  it('en mida gran només pinta la xifra', async () => {
    await render(<IndexIndicator index={{ valor: 87, franja: 'ras' }} size="lg" />);
    expect(screen.getByText('87')).toBeOnTheScreen();
    expect(screen.queryByText('Cel ras')).toBeNull();
  });
});
