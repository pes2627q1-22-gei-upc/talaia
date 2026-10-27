import { fireEvent, render, screen } from '@testing-library/react-native';

import { SegmentedControl } from '../SegmentedControl';

const OPTIONS = ['Aquesta nit', 'Demà', 'Tria el dia'];

describe('SegmentedControl', () => {
  it('mostra les opcions com a pestanyes i marca la triada', async () => {
    await render(<SegmentedControl options={OPTIONS} selectedIndex={1} onChange={jest.fn()} />);
    expect(screen.getAllByRole('tab')).toHaveLength(3);
    expect(screen.getByRole('tab', { name: 'Demà' })).toBeSelected();
    expect(screen.getByRole('tab', { name: 'Aquesta nit' })).not.toBeSelected();
  });

  it('avisa quan es tria una altra opció, i no quan es torna a tocar la mateixa', async () => {
    const onChange = jest.fn();
    await render(<SegmentedControl options={OPTIONS} selectedIndex={0} onChange={onChange} />);
    // El contenidor no és un element accessible (no ha d'agrupar les pestanyes): s'hi arriba pel pare.
    await fireEvent(screen.getAllByRole('tab')[0]!.parent!, 'layout', {
      nativeEvent: { layout: { width: 353, height: 48 } },
    });

    await fireEvent.press(screen.getByRole('tab', { name: 'Tria el dia' }));
    expect(onChange).toHaveBeenCalledWith(2);

    await fireEvent.press(screen.getByRole('tab', { name: 'Aquesta nit' }));
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('tornar a tocar la triada avisa amb onReselect (p. ex. per tornar a obrir el calendari)', async () => {
    const onChange = jest.fn();
    const onReselect = jest.fn();
    await render(
      <SegmentedControl
        options={OPTIONS}
        selectedIndex={2}
        onChange={onChange}
        onReselect={onReselect}
      />,
    );
    await fireEvent.press(screen.getByRole('tab', { name: 'Tria el dia' }));
    expect(onReselect).toHaveBeenCalledWith(2);
    expect(onChange).not.toHaveBeenCalled();
  });
});
