import type { Esdeveniment } from '@talaia/shared';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import i18n from '@/core/i18n';
import { motion } from '@/core/theme/tokens';

import { CalendarScreen } from '../CalendarScreen';
import { useCalendarEventsQuery } from '../calendarRepository';

jest.mock('../calendarRepository', () => ({ useCalendarEventsQuery: jest.fn() }));

const query = jest.mocked(useCalendarEventsQuery);
const refetch = jest.fn();
const event = (id: string, date: string, tipus: Esdeveniment['tipus']): Esdeveniment => ({
  id,
  tipus,
  nom: id,
  inici: `${date}T20:00:00Z`,
  fi: `${date}T21:00:00Z`,
  maxim: `${date}T20:30:00Z`,
  descripcio: `Descripció de ${id}`,
  ubicacio: { nom: 'Catalunya', latitud: 41.39, longitud: 2.17 },
  font: 'test',
});
const events = [
  event('Lluna passada', '2026-10-21', 'fase_llunar'),
  event('Lluna plena', '2026-10-22', 'fase_llunar'),
  event('Oriònids', '2026-10-26', 'pluja_estels'),
];

function setQuery(overrides: Partial<ReturnType<typeof useCalendarEventsQuery>> = {}) {
  query.mockReturnValue({
    data: { data: events },
    isPending: false,
    isError: false,
    refetch,
    ...overrides,
  } as ReturnType<typeof useCalendarEventsQuery>);
}

function calendar() {
  return (
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 393, height: 852 },
        insets: { top: 59, left: 0, right: 0, bottom: 34 },
      }}
    >
      <CalendarScreen />
    </SafeAreaProvider>
  );
}

function renderCalendar() {
  return render(calendar());
}

async function finishClosingSheet() {
  await act(() => jest.advanceTimersByTime(motion.base + 100));
}

beforeEach(async () => {
  jest.clearAllMocks();
  jest.useFakeTimers().setSystemTime(new Date('2026-10-22T12:00:00Z'));
  await i18n.changeLanguage('ca');
  setQuery();
});

afterEach(() => jest.useRealTimers());

it('mostra els fenòmens pendents amb la descripció i permet filtrar per dia', async () => {
  await renderCalendar();
  expect(screen.getByRole('header', { name: 'Calendari' })).toBeOnTheScreen();
  expect(screen.getByText('Lluna plena')).toBeOnTheScreen();
  expect(screen.getByText('Descripció de Lluna plena')).toBeOnTheScreen();
  expect(screen.getByText('Oriònids')).toBeOnTheScreen();
  expect(screen.queryByText('Lluna passada')).toBeNull();

  await fireEvent.press(screen.getByRole('button', { name: /22 d’octubre: 1 fenomen/ }));
  expect(screen.queryByText('Oriònids')).toBeNull();
  expect(screen.getByRole('button', { name: /22 d’octubre: 1 fenomen/ })).toBeSelected();
  await fireEvent.press(screen.getByRole('button', { name: 'Mostra tot el mes' }));
  expect(screen.getByText('Oriònids')).toBeOnTheScreen();
});

it('obre els filtres, reflecteix la selecció i filtra els fenòmens de la llista', async () => {
  await renderCalendar();
  const filter = screen.getByRole('button', { name: 'Filtra fenòmens: Tots els fenòmens' });
  expect(filter).toHaveProp('accessibilityState', { expanded: false });
  await fireEvent.press(filter);
  expect(screen.getByRole('header', { name: 'Filtra fenòmens' })).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Tots els fenòmens' })).toBeSelected();
  await fireEvent.press(screen.getByRole('button', { name: "Pluges d'estels" }));
  await finishClosingSheet();
  expect(screen.queryByRole('header', { name: 'Filtra fenòmens' })).toBeNull();
  expect(screen.getByRole('button', { name: "Filtra fenòmens: Pluges d'estels" })).toHaveProp(
    'accessibilityState',
    { expanded: false },
  );
  expect(screen.getByText('Oriònids')).toBeOnTheScreen();
  expect(screen.queryByText('Lluna plena')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: "Filtra fenòmens: Pluges d'estels" }));
  expect(screen.getByRole('button', { name: "Pluges d'estels" })).toBeSelected();
});

it('mostra els passats amb l’interruptor i permet tancar els filtres', async () => {
  await renderCalendar();
  await fireEvent.press(screen.getByRole('button', { name: 'Filtra fenòmens: Tots els fenòmens' }));
  expect(screen.getByRole('switch', { name: 'Mostra els passats' })).not.toBeChecked();
  await fireEvent.press(screen.getByRole('switch', { name: 'Mostra els passats' }));
  expect(screen.getByRole('switch', { name: 'Mostra els passats' })).toBeChecked();
  await fireEvent.press(
    screen.getByRole('button', { name: 'Tanca els filtres', includeHiddenElements: true }),
  );
  await finishClosingSheet();
  expect(screen.getByText('Lluna passada')).toBeOnTheScreen();
  expect(screen.getByLabelText('Passat')).toBeOnTheScreen();
});

it('canvia de mes i torna a avui amb els controls de la pantalla', async () => {
  await renderCalendar();
  await fireEvent.press(screen.getByRole('button', { name: 'Mes següent: nov' }));
  expect(screen.getByRole('header', { name: 'novembre 2026' })).toBeOnTheScreen();
  expect(query).toHaveBeenLastCalledWith({ year: 2026, month: 10 });
  await fireEvent.press(screen.getByLabelText('Torna a avui'));
  expect(screen.getByRole('header', { name: 'octubre 2026' })).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: /22 d’octubre: 1 fenomen/ })).toBeSelected();
});

it('no presenta un fals estat buit durant la càrrega i mostra les dades quan arriben', async () => {
  setQuery({ data: undefined, isPending: true });
  const view = await renderCalendar();
  expect(screen.getByRole('header', { name: 'Calendari' })).toBeOnTheScreen();
  expect(screen.queryByText('No hi ha fenòmens pendents aquest mes')).toBeNull();
  expect(screen.queryByText('No hem pogut carregar els fenòmens')).toBeNull();
  expect(screen.queryByText('Lluna plena')).toBeNull();
  setQuery();
  await view.rerender(calendar());
  expect(screen.getByText('Lluna plena')).toBeOnTheScreen();
});

it('mostra l’error i connecta el reintent a la consulta', async () => {
  setQuery({ data: undefined, isError: true });
  await renderCalendar();
  expect(screen.getByText('No hem pogut carregar els fenòmens')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Torna-ho a provar' }));
  expect(refetch).toHaveBeenCalledTimes(1);
});

it('distingeix un mes buit d’un dia sense fenòmens', async () => {
  setQuery({ data: { data: [] } });
  await renderCalendar();
  expect(screen.getByText('No hi ha fenòmens pendents aquest mes')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: '26 d’octubre' }));
  expect(screen.getByText('No hi ha fenòmens pendents aquest dia')).toBeOnTheScreen();
});
