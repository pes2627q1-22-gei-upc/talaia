import { fireEvent, render, screen } from '@testing-library/react-native';

import { colors } from '@/core/theme/tokens';

import { Chip } from '../Chip';

describe('Chip', () => {
  it('anuncia si està seleccionat i el pinta amb far', async () => {
    await render(<Chip label="Lluna" selected onPress={jest.fn()} />);
    const chip = screen.getByRole('button', { name: 'Lluna' });
    expect(chip).toBeSelected();
    expect(screen.getByText('Lluna')).toHaveStyle({ color: colors.nit });
  });

  it('sense seleccionar, crida onPress', async () => {
    const onPress = jest.fn();
    await render(<Chip label="Sol" selected={false} onPress={onPress} />);
    const chip = screen.getByRole('button', { name: 'Sol' });
    expect(chip).not.toBeSelected();
    await fireEvent.press(chip);
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
