import { render, screen } from '@testing-library/react-native';
import { processColor } from 'react-native';

import { FieldRow } from '@/features/explore/FieldRow';
import { Chip } from '@/shared/ui/Chip';
import { Screen } from '@/shared/ui/Screen';

import { type ThemeName, ThemeProvider, useNightTint } from '../theme';

jest.mock('expo-brightness', () => ({
  getBrightnessAsync: jest.fn().mockResolvedValue(0.5),
  setBrightnessAsync: jest.fn().mockResolvedValue(undefined),
  isUsingSystemBrightnessAsync: jest.fn().mockResolvedValue(true),
  restoreSystemBrightnessAsync: jest.fn().mockResolvedValue(undefined),
}));

function App({ theme }: { theme: ThemeName }) {
  return (
    <ThemeProvider name={theme}>
      <Screen title="Calendari" subtitle="Aquest mes">
        <Chip label="Lluna" selected onPress={jest.fn()} />
      </Screen>
    </ThemeProvider>
  );
}

describe('ThemeProvider', () => {
  it('en canviar de tema, la pantalla es torna a pintar amb la paleta nova', async () => {
    const { rerender } = await render(<App theme="normal" />);
    expect(screen.getByText('Calendari')).toHaveStyle({ color: '#EEF0F7' });
    expect(screen.getByText('Aquest mes')).toHaveStyle({ color: '#9AA3C7' });
    expect(screen.getByRole('button', { name: 'Lluna' })).toHaveStyle({
      backgroundColor: '#FFB547',
    });

    await rerender(<App theme="vermell" />);
    expect(screen.getByText('Calendari')).toHaveStyle({ color: '#FF0000' });
    expect(screen.getByText('Aquest mes')).toHaveStyle({ color: '#F20000' });
    expect(screen.getByRole('button', { name: 'Lluna' })).toHaveStyle({
      backgroundColor: '#FF0000',
    });
    expect(screen.getByText('Lluna')).toHaveStyle({ color: '#000000' });
  });

  it('en mode nit, els camps es pinten amb la paleta i tenyeixen les icones SVG', async () => {
    await render(
      <ThemeProvider name="vermell">
        <FieldRow icon={1} label="Barcelona" hint="Ubicació actual" />
      </ThemeProvider>,
    );
    expect(screen.getByLabelText('Barcelona, Ubicació actual')).toHaveStyle({
      backgroundColor: '#0F0000',
    });
    // expo-image rep el color ja processat (ARGB).
    expect(JSON.stringify(screen.toJSON())).toContain(
      `"tintColor":${String(processColor('#FF0000'))}`,
    );
  });

  it('useNightTint només tenyeix en mode nit', async () => {
    const seen: (string | undefined)[] = [];
    function Probe() {
      seen.push(useNightTint(), useNightTint('nit'));
      return null;
    }
    const { rerender } = await render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(seen.slice(-2)).toEqual([undefined, undefined]);
    await rerender(
      <ThemeProvider name="vermell">
        <Probe />
      </ThemeProvider>,
    );
    expect(seen.slice(-2)).toEqual(['#FF0000', '#000000']);
  });
});
