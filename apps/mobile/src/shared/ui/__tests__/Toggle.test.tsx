import { fireEvent, render, screen } from '@testing-library/react-native';

import { ThemeProvider } from '@/core/theme/theme';

import { Toggle } from '../Toggle';

jest.mock('expo-brightness', () => ({
  getBrightnessAsync: jest.fn().mockResolvedValue(0.5),
  setBrightnessAsync: jest.fn().mockResolvedValue(undefined),
}));

describe('Toggle', () => {
  it('és un interruptor accessible que avisa del valor contrari', async () => {
    const onValueChange = jest.fn();
    await render(
      <Toggle value={false} onValueChange={onValueChange} accessibilityLabel="Alerta" />,
    );
    const toggle = screen.getByRole('switch', { name: 'Alerta' });
    expect(toggle).not.toBeChecked();
    await fireEvent.press(toggle);
    expect(onValueChange).toHaveBeenCalledWith(true);
  });

  it('desactivat, no respon', async () => {
    const onValueChange = jest.fn();
    await render(
      <Toggle value onValueChange={onValueChange} accessibilityLabel="Alerta" disabled />,
    );
    const toggle = screen.getByRole('switch', { name: 'Alerta' });
    expect(toggle).toBeChecked();
    expect(toggle).toBeDisabled();
    await fireEvent.press(toggle);
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('en mode nit, el control encès es veu sobre la pista vermella', async () => {
    const knobOnRed = '"backgroundColor":"#000000"';
    const { rerender } = await render(
      <ThemeProvider name="vermell">
        <Toggle value={false} onValueChange={jest.fn()} accessibilityLabel="Alerta" />
      </ThemeProvider>,
    );
    expect(JSON.stringify(screen.toJSON())).not.toContain(knobOnRed);
    await rerender(
      <ThemeProvider name="vermell">
        <Toggle value onValueChange={jest.fn()} accessibilityLabel="Alerta" />
      </ThemeProvider>,
    );
    expect(JSON.stringify(screen.toJSON())).toContain(knobOnRed);
  });
});
