import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { processColor } from 'react-native';

import { ThemeProvider } from '@/core/theme/theme';
import { colorsVermell } from '@/core/theme/tokens';

import { BackButton } from '../BackButton';

jest.mock('expo-router', () => ({ router: { back: jest.fn() } }));
jest.mock('expo-brightness', () => ({
  getBrightnessAsync: jest.fn().mockResolvedValue(0.5),
  setBrightnessAsync: jest.fn().mockResolvedValue(undefined),
  isUsingSystemBrightnessAsync: jest.fn().mockResolvedValue(true),
  restoreSystemBrightnessAsync: jest.fn().mockResolvedValue(undefined),
}));

describe('BackButton', () => {
  it('torna enrere amb el router si no se li diu res més', async () => {
    await render(<BackButton label="Enrere" />);
    await fireEvent.press(screen.getByRole('button', { name: 'Enrere' }));
    expect(router.back).toHaveBeenCalledTimes(1);
  });

  it('en mode nit, el botó i la fletxa van amb la paleta vermella', async () => {
    await render(
      <ThemeProvider name="vermell">
        <BackButton label="Enrere" />
      </ThemeProvider>,
    );
    expect(screen.getByRole('button', { name: 'Enrere' })).toHaveStyle({
      backgroundColor: colorsVermell.sheet,
      borderColor: colorsVermell.vora,
    });
    expect(JSON.stringify(screen.toJSON())).toContain(
      `"tintColor":${String(processColor(colorsVermell.lluna))}`,
    );
  });
});
