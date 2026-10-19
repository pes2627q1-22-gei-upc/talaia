import { fireEvent, render, screen } from '@testing-library/react-native';

import { MonthCalendar } from '../MonthCalendar';

const MONTHS = ['gen', 'feb', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'oct', 'nov', 'des'];

function renderCalendar(onChange = jest.fn(), firstDay: 0 | 1 = 1) {
  return render(
    <MonthCalendar
      value="2026-10-15"
      today="2026-10-15"
      min="2026-10-15"
      max="2026-12-31"
      onChange={onChange}
      firstDay={firstDay}
      weekdayNames={['dg.', 'dl.', 'dt.', 'dc.', 'dj.', 'dv.', 'ds.']}
      formatTitle={({ year, month }) => `${MONTHS[month]} ${year}`}
      dayLabel={(date) => `dia ${date}`}
      previousLabel="Mes anterior"
      nextLabel="Mes següent"
    />,
  );
}

describe('MonthCalendar', () => {
  it('mostra el mes del dia triat, amb la setmana que comença en dilluns', async () => {
    await renderCalendar();
    expect(screen.getByRole('header', { name: 'oct 2026' })).toBeOnTheScreen();
    expect(screen.getAllByText(/^d.\.$/).map((node) => node.props.children)).toEqual([
      'dl.',
      'dt.',
      'dc.',
      'dj.',
      'dv.',
      'ds.',
      'dg.',
    ]);
    expect(screen.getByRole('button', { name: 'dia 2026-10-15' })).toBeSelected();
  });

  it('els dies passats no es poden triar; els altres sí', async () => {
    const onChange = jest.fn();
    await renderCalendar(onChange);
    expect(screen.getByRole('button', { name: 'dia 2026-10-14' })).toBeDisabled();

    await fireEvent.press(screen.getByRole('button', { name: 'dia 2026-10-20' }));
    expect(onChange).toHaveBeenCalledWith('2026-10-20');
  });

  it('canvia de mes amb les fletxes, sense passar dels límits', async () => {
    const onChange = jest.fn();
    await renderCalendar(onChange);
    expect(screen.getByRole('button', { name: 'Mes anterior' })).toBeDisabled();

    await fireEvent.press(screen.getByRole('button', { name: 'Mes següent' }));
    expect(screen.getByRole('header', { name: 'nov 2026' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'dia 2026-11-02' }));
    expect(onChange).toHaveBeenCalledWith('2026-11-02');

    await fireEvent.press(screen.getByRole('button', { name: 'Mes següent' }));
    expect(screen.getByRole('header', { name: 'des 2026' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Mes següent' })).toBeDisabled();

    await fireEvent.press(screen.getByRole('button', { name: 'Mes anterior' }));
    expect(screen.getByRole('header', { name: 'nov 2026' })).toBeOnTheScreen();
  });

  it('en anglès, la setmana comença en diumenge', async () => {
    await renderCalendar(jest.fn(), 0);
    expect(screen.getAllByText(/^d.\.$/)[0]?.props.children).toBe('dg.');
  });
});
