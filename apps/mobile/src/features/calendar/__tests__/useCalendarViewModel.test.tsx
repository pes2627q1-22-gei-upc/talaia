import type { Esdeveniment } from '@talaia/shared';
import { act, renderHook } from '@testing-library/react-native';

import i18n from '@/core/i18n';

import { useCalendarEventsQuery } from '../calendarRepository';
import { useCalendarViewModel } from '../useCalendarViewModel';

jest.mock('../calendarRepository', () => ({ useCalendarEventsQuery: jest.fn() }));

const query = jest.mocked(useCalendarEventsQuery);
const event = (id: string, date: string): Esdeveniment => ({
  id,
  tipus: 'fase_llunar',
  nom: id,
  inici: `${date}T20:00:00Z`,
  fi: `${date}T21:00:00Z`,
  maxim: `${date}T20:30:00Z`,
  descripcio: '',
  ubicacio: { nom: 'Catalunya', latitud: 41.39, longitud: 2.17 },
  font: 'test',
});

describe('useCalendarViewModel', () => {
  afterEach(() => jest.useRealTimers());

  beforeEach(async () => {
    await i18n.changeLanguage('ca');
    query.mockReturnValue({
      data: { data: [] },
      isPending: false,
      isError: false,
      refetch: jest.fn(),
    } as unknown as ReturnType<typeof useCalendarEventsQuery>);
  });

  it('canvia de mes i torna a mostrar el mes complet', async () => {
    const { result } = await renderHook(() => useCalendarViewModel());
    const current = result.current.month;
    expect(result.current.monthLabel).toMatch(new RegExp(` ${current.year}$`));
    expect(result.current.monthLabel).not.toContain(`de ${current.year}`);
    const selected = `${current.year}-${String(current.month + 1).padStart(2, '0')}-15`;
    await act(() => result.current.selectDay(selected));
    expect(result.current.selectedDay).toBe(selected);
    expect(result.current.periodLabel).toContain('15');
    await act(() => result.current.nextMonth());
    expect(result.current.month).not.toEqual(current);
    expect(result.current.selectedDay).toBeNull();
    expect(result.current.periodLabel).toBe('Fenòmens');
  });

  it('filtra per dia i permet tornar al mes complet', async () => {
    const { result } = await renderHook(() => useCalendarViewModel());
    const current = result.current.month;
    const selected = `${current.year}-${String(current.month + 1).padStart(2, '0')}-21`;
    await act(() => result.current.selectDay(selected));
    expect(result.current.selectedDay).toBe(selected);
    expect(result.current.emptyMessage).toBe('No hi ha fenòmens pendents aquest dia');
    await act(() => result.current.selectDay(selected));
    expect(result.current.selectedDay).toBeNull();
    await act(() => result.current.selectDay(selected));
    await act(() => result.current.clearSelectedDay());
    expect(result.current.selectedDay).toBeNull();
    expect(result.current.emptyMessage).toBe('No hi ha fenòmens pendents aquest mes');
  });

  it('torna al dia d’avui des d’un mes llunyà', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-22T12:00:00Z'));
    const { result } = await renderHook(() => useCalendarViewModel());
    expect(result.current.showGoToday).toBe(false);

    await act(() => result.current.selectMonth({ year: 2027, month: 2 }));
    expect(result.current.showGoToday).toBe(true);
    await act(() => result.current.goToday());

    expect(result.current.month).toEqual({ year: 2026, month: 9 });
    expect(result.current.selectedDay).toBe('2026-10-22');
    expect(result.current.showGoToday).toBe(false);
  });

  it('només deixa retrocedir fins al mes anterior, també en canviar d’any', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2027-01-22T12:00:00Z'));
    const { result } = await renderHook(() => useCalendarViewModel());
    expect(result.current.minDate).toBe('2026-12-01');

    await act(() => result.current.previousMonth());
    expect(result.current.month).toEqual({ year: 2026, month: 11 });
    await act(() => result.current.previousMonth());
    expect(result.current.month).toEqual({ year: 2026, month: 11 });
    await act(() => result.current.selectMonth({ year: 2026, month: 10 }));
    expect(result.current.month).toEqual({ year: 2026, month: 11 });
  });

  it('mostra l’error real quan falla la consulta', async () => {
    query.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      refetch: jest.fn(),
    } as unknown as ReturnType<typeof useCalendarEventsQuery>);
    const { result } = await renderHook(() => useCalendarViewModel());
    expect(result.current.isError).toBe(true);
    expect(result.current.events).toHaveLength(0);
  });

  it('manté buida una resposta sense esdeveniments', async () => {
    const { result } = await renderHook(() => useCalendarViewModel());
    expect(result.current.isError).toBe(false);
    expect(result.current.events).toHaveLength(0);
  });

  it('manté el filtre en canviar de dia i de mes', async () => {
    const { result } = await renderHook(() => useCalendarViewModel());
    expect(result.current.filterMenuOpen).toBe(false);
    await act(() => result.current.toggleFilterMenu());
    expect(result.current.filterMenuOpen).toBe(true);
    await act(() => result.current.selectFilter('meteor'));
    expect(result.current.filter).toBe('meteor');
    expect(result.current.filterMenuOpen).toBe(false);
    await act(() => result.current.toggleFilterMenu());
    expect(result.current.activeFilterShortLabel).toBe('Estels');
    await act(() => result.current.closeFilterMenu());
    expect(result.current.filterMenuOpen).toBe(false);
    await act(() => result.current.toggleFilterMenu());
    const { year, month } = result.current.month;
    await act(() => result.current.selectDay(`${year}-${String(month + 1).padStart(2, '0')}-21`));
    expect(result.current.filterMenuOpen).toBe(false);
    await act(() => result.current.nextMonth());
    expect(result.current.filter).toBe('meteor');
    expect(result.current.selectedDay).toBeNull();
  });

  it('amaga els passats per defecte i els pot mostrar a la llista i als punts', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-22T12:00:00Z'));
    query.mockReturnValue({
      data: {
        data: [
          event('past', '2026-10-21'),
          event('today', '2026-10-22'),
          event('future', '2026-10-26'),
        ],
      },
      isPending: false,
      isError: false,
      refetch: jest.fn(),
    } as unknown as ReturnType<typeof useCalendarEventsQuery>);
    const { result } = await renderHook(() => useCalendarViewModel());
    expect(result.current.showPast).toBe(false);
    expect(result.current.events.map((event) => event.id)).toEqual(['today', 'future']);
    expect(result.current.markersByDay.has('2026-10-21')).toBe(false);
    expect(result.current.markersByDay.has('2026-10-22')).toBe(true);

    await act(() => result.current.toggleFilterMenu());
    await act(() => result.current.toggleShowPast());
    expect(result.current.showPast).toBe(true);
    expect(result.current.filterMenuOpen).toBe(true);
    expect(result.current.events).toHaveLength(3);
    expect(result.current.markersByDay.has('2026-10-21')).toBe(true);

    await act(() => result.current.closeFilterMenu());
    await act(() => result.current.selectDay('2026-10-21'));
    expect(result.current.events).toHaveLength(1);
    expect(result.current.events[0]?.id).toBe('past');
    await act(() => result.current.toggleShowPast());
    expect(result.current.events).toHaveLength(0);
    expect(result.current.emptyMessage).toBe('No hi ha fenòmens pendents aquest dia');
  });

  it('prepara els punts del mes següent abans de lliscar-hi', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-20T12:00:00Z'));
    const empty = { data: { data: [] }, isPending: false, isError: false, refetch: jest.fn() };
    query.mockImplementation((targetMonth) =>
      targetMonth.year === 2026 && targetMonth.month === 10
        ? ({
            ...empty,
            data: {
              data: [
                {
                  id: 'next-month-event',
                  tipus: 'pluja_estels',
                  nom: 'Pluja d’estels',
                  descripcio: '',
                  inici: '2026-11-08T20:00:00Z',
                  fi: '2026-11-08T20:00:00Z',
                  maxim: '2026-11-08T20:00:00Z',
                  ubicacio: { nom: 'Àger', latitud: 42.02, longitud: 0.73 },
                  font: 'test',
                },
              ],
            },
          } as unknown as ReturnType<typeof useCalendarEventsQuery>)
        : (empty as unknown as ReturnType<typeof useCalendarEventsQuery>),
    );
    const { result } = await renderHook(() => useCalendarViewModel());
    expect(result.current.month).toEqual({ year: 2026, month: 9 });
    expect(result.current.nextEventsByDay.get('2026-11-08')?.[0]?.id).toBe('next-month-event');
    await act(() => result.current.selectFilter('moon'));
    expect(result.current.nextEventsByDay.get('2026-11-08')).toBeUndefined();
  });

  it('mostra sempre els mesos veïns sense l’any', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-12-20T12:00:00Z'));
    const { result } = await renderHook(() => useCalendarViewModel());
    expect(result.current.previousMonthLabel).toBe('nov');
    expect(result.current.nextMonthLabel).toBe('gen');
    await act(() => result.current.nextMonth());
    expect(result.current.previousMonthLabel).toBe('des');
    expect(result.current.nextMonthLabel).toBe('febr');
  });
});
