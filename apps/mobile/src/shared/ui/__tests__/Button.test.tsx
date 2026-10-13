import { fireEvent, render, screen } from '@testing-library/react-native';

import { Button } from '../Button';

describe('Button', () => {
  it('crida onPress en prémer-lo', async () => {
    const onPress = jest.fn();
    await render(<Button label="Crea un pla" onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Crea un pla' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('desactivat, no dispara i ho anuncia', async () => {
    const onPress = jest.fn();
    await render(<Button label="Crea un pla" onPress={onPress} disabled />);
    const button = screen.getByRole('button', { name: 'Crea un pla' });
    await fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
    expect(button).toBeDisabled();
  });
});
