import { render, screen } from '@testing-library/react-native';

import { ThemeProvider } from '@/core/theme/theme';
import { colorsVermell } from '@/core/theme/tokens';

import { IndexLegend } from '../RecommendationsHeader';

jest.mock('expo-brightness', () => ({
  getBrightnessAsync: jest.fn().mockResolvedValue(0.5),
  setBrightnessAsync: jest.fn().mockResolvedValue(undefined),
  isUsingSystemBrightnessAsync: jest.fn().mockResolvedValue(true),
  restoreSystemBrightnessAsync: jest.fn().mockResolvedValue(undefined),
}));

const items = [
  { franja: 'ras', label: 'Cel ras' },
  { franja: 'jus', label: 'Justet' },
  { franja: 'tap', label: 'Tapat' },
] as const;

it('en mode nit, cada franja de la llegenda té una forma: ple, anell i anell discontinu', async () => {
  await render(
    <ThemeProvider name="vermell">
      <IndexLegend items={[...items]} />
    </ThemeProvider>,
  );
  expect(screen.getByTestId('legend-ras')).toHaveStyle({ backgroundColor: colorsVermell.ras });
  expect(screen.getByTestId('legend-jus')).not.toHaveStyle({ backgroundColor: colorsVermell.jus });
  expect(screen.getByTestId('legend-jus')).not.toHaveStyle({ borderStyle: 'dashed' });
  expect(screen.getByTestId('legend-tap')).toHaveStyle({ borderStyle: 'dashed' });
});
