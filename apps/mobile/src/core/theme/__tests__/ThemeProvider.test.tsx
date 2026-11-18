import { render, screen } from '@testing-library/react-native';

import { Chip } from '@/shared/ui/Chip';
import { Screen } from '@/shared/ui/Screen';

import { type ThemeName, ThemeProvider } from '../theme';

jest.mock('expo-brightness', () => ({
  getBrightnessAsync: jest.fn().mockResolvedValue(0.5),
  setBrightnessAsync: jest.fn().mockResolvedValue(undefined),
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
});
