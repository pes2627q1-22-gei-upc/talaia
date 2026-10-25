import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { GestureHandlerRootView, State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';

import { Slider } from '../Slider';

// Pista de 345 (353 − 2 × 4 de marge): de 30 a 240 min, de 15 en 15 → 14 passos de ~24,6 punts.
const WIDTH = 353;

async function renderSlider(value = 150, onChange = jest.fn()) {
  await render(
    <Slider
      value={value}
      min={30}
      max={240}
      step={15}
      onChange={onChange}
      accessibilityLabel="Fins a quina distància"
      accessibilityValueText={`${value} min`}
    />,
    // Gesture Handler 3: GestureDetector exigeix l'arrel, com a `AppProviders`.
    { wrapper: GestureHandlerRootView },
  );
  await fireEvent(screen.getByTestId('slider'), 'layout', {
    nativeEvent: { layout: { width: WIDTH, height: 28 } },
  });
  return onChange;
}

describe('Slider', () => {
  it('és un control ajustable amb el valor llegible', async () => {
    await renderSlider();
    const slider = screen.getByRole('adjustable', { name: 'Fins a quina distància' });
    expect(slider).toHaveAccessibilityValue({ text: '150 min' });
  });

  it('amb el lector de pantalla, puja i baixa un pas sense sortir dels límits', async () => {
    const onChange = await renderSlider();
    const slider = screen.getByTestId('slider');
    await fireEvent(slider, 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
    expect(onChange).toHaveBeenLastCalledWith(165);
    await fireEvent(slider, 'accessibilityAction', { nativeEvent: { actionName: 'decrement' } });
    expect(onChange).toHaveBeenLastCalledWith(135);
  });

  it('al mínim, baixar no fa res', async () => {
    const onChange = await renderSlider(30);
    await fireEvent(screen.getByTestId('slider'), 'accessibilityAction', {
      nativeEvent: { actionName: 'decrement' },
    });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('en arrossegar, avança per passos i avisa un cop per pas', async () => {
    const onChange = await renderSlider();
    await act(() =>
      fireGestureHandler(getByGestureTestId('slider-pan'), [
        { state: State.BEGAN, x: 201 },
        { state: State.ACTIVE, x: 230 },
        { state: State.ACTIVE, x: 232 },
        { state: State.ACTIVE, x: 262 },
        { state: State.END, x: 262 },
      ]),
    );
    expect(onChange.mock.calls.map(([value]) => value)).toEqual([165, 180]);
  });

  it('en tocar la pista, salta al pas més proper, fins i tot fora dels extrems', async () => {
    const onChange = await renderSlider();
    await act(() =>
      fireGestureHandler(getByGestureTestId('slider-tap'), [
        { state: State.BEGAN, x: 0 },
        { state: State.END, x: 0 },
      ]),
    );
    expect(onChange).toHaveBeenLastCalledWith(30);
  });
});
