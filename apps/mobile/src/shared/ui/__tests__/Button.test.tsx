import { fireEvent, render, screen } from '@testing-library/react-native';

import { colors } from '@/core/theme/tokens';

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

  it('`danger` és un botó de text en vermell (`perill`), per a accions que esborren', async () => {
    await render(<Button variant="danger" label="Elimina l'alerta" onPress={jest.fn()} />);
    expect(screen.getByRole('button', { name: "Elimina l'alerta" })).toBeOnTheScreen();
    expect(screen.getByText("Elimina l'alerta")).toHaveStyle({ color: colors.perill });
  });
});
