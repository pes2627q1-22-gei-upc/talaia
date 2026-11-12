import { fireEvent, render, screen } from '@testing-library/react-native';

import { Toggle } from '../Toggle';

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
});
