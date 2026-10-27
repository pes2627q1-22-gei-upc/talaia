import { fireEvent, render, screen } from '@testing-library/react-native';

import { WHEEL_ITEM, WheelPicker } from '../WheelPicker';

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
const format = (hour: number) => `${String(hour).padStart(2, '0')}:00`;
/** La roda comença a la còpia del mig de la llista (20 voltes de 24). */
const START = 20 * 24;

function renderWheel(value: number, onChange = jest.fn()) {
  return render(
    <WheelPicker
      testID="roda"
      values={HOURS}
      value={value}
      onChange={onChange}
      format={format}
      accessibilityLabel="Des de"
    />,
  );
}

describe('WheelPicker', () => {
  it('és un control ajustable amb el valor llegible', async () => {
    await renderWheel(22);
    expect(screen.getByRole('adjustable', { name: 'Des de' })).toHaveAccessibilityValue({
      text: '22:00',
    });
  });

  it('amb el lector de pantalla, puja i baixa donant la volta', async () => {
    const onChange = jest.fn();
    await renderWheel(23, onChange);
    const wheel = screen.getByRole('adjustable', { name: 'Des de' });
    await fireEvent(wheel, 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
    expect(onChange).toHaveBeenLastCalledWith(0);
    await fireEvent(wheel, 'accessibilityAction', { nativeEvent: { actionName: 'decrement' } });
    expect(onChange).toHaveBeenLastCalledWith(22);
  });

  it('quan la roda s’atura, tria la fila del mig', async () => {
    const onChange = jest.fn();
    await renderWheel(22, onChange);
    const list = screen.getByTestId('roda');

    await fireEvent(list, 'momentumScrollEnd', {
      nativeEvent: { contentOffset: { y: (START + 23) * WHEEL_ITEM + 10 } },
    });
    expect(onChange).toHaveBeenLastCalledWith(23);

    // Deixar-la anar sense velocitat també compta; si no es mou de fila, no avisa.
    onChange.mockClear();
    await fireEvent(list, 'scrollEndDrag', {
      nativeEvent: { contentOffset: { y: (START + 22) * WHEEL_ITEM }, velocity: { y: 0 } },
    });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('prop d’una punta de la llista, torna a la còpia del mig i continua donant la volta', async () => {
    const onChange = jest.fn();
    await renderWheel(22, onChange);
    await fireEvent(screen.getByTestId('roda'), 'momentumScrollEnd', {
      nativeEvent: { contentOffset: { y: 3 * WHEEL_ITEM } },
    });
    expect(onChange).toHaveBeenLastCalledWith(3);
  });

  it('segueix els canvis de valor que arriben de fora', async () => {
    const view = await renderWheel(22);
    await view.rerender(
      <WheelPicker
        testID="roda"
        values={HOURS}
        value={5}
        onChange={jest.fn()}
        format={format}
        accessibilityLabel="Des de"
      />,
    );
    expect(screen.getByRole('adjustable', { name: 'Des de' })).toHaveAccessibilityValue({
      text: '05:00',
    });
  });
});
