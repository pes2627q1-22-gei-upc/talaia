import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import { AppState, type AppStateStatus, Linking } from 'react-native';

import i18n from '@/core/i18n';
import { createQueryWrapper } from '@/test-utils/queryWrapper';

import { addDays, nightOf } from '../exploreModel';
import { getCurrentPlace } from '../locationRepository';
import { useExploreViewModel } from '../useExploreViewModel';

jest.mock('expo-router', () => ({ useRouter: jest.fn() }));
jest.mock('../locationRepository', () => {
  const { useQuery } = jest.requireActual('@tanstack/react-query');
  const { CURRENT_PLACE_KEY } = jest.requireActual('../locationKeys');
  const getCurrentPlace = jest.fn();
  return {
    getCurrentPlace,
    useCurrentPlaceQuery: () =>
      useQuery({ queryKey: CURRENT_PLACE_KEY, queryFn: getCurrentPlace, retry: false }),
  };
});

const push = jest.fn();
jest.mocked(useRouter).mockReturnValue({ push } as unknown as ReturnType<typeof useRouter>);
const mockedPlace = jest.mocked(getCurrentPlace);
const BARCELONA = {
  status: 'ready',
  place: { name: 'Barcelona', lat: 41.387412, lon: 2.168569 },
} as const;

function renderViewModel() {
  return renderHook(() => useExploreViewModel(), { wrapper: createQueryWrapper() });
}

/** Captura el que l'app fa quan torna a primer pla. */
function captureAppState() {
  let listener: ((state: AppStateStatus) => void) | undefined;
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, handler) => {
    listener = handler as (state: AppStateStatus) => void;
    return { remove: jest.fn() } as unknown as ReturnType<typeof AppState.addEventListener>;
  });
  return (state: AppStateStatus) => act(() => listener?.(state));
}

describe('useExploreViewModel', () => {
  const tonight = nightOf(new Date());

  beforeEach(async () => {
    jest.restoreAllMocks();
    push.mockReset();
    mockedPlace.mockReset();
    await i18n.changeLanguage('ca');
  });

  it('arrenca amb cel estrellat, aquesta nit, de 22 a 6 i 2 h 30 min, buscant on ets', async () => {
    mockedPlace.mockReturnValue(new Promise(() => undefined));
    const { result } = await renderViewModel();
    const vm = result.current;

    expect(['Bon dia', 'Bona tarda', 'Bona nit']).toContain(vm.greeting);
    expect(vm.title).toBe('Què vols veure?');
    expect(vm.goals.find((goal) => goal.selected)?.id).toBe('cel_estrellat');
    expect(vm.origin).toMatchObject({ state: 'loading', label: 'Buscant on ets…' });
    expect(vm.days.options).toEqual(['Aquesta nit', 'Demà', 'Tria el dia']);
    expect(vm.days.selectedIndex).toBe(0);
    expect(vm.calendar.visible).toBe(false);
    expect(vm.range.label).toBe('De 22:00 a 06:00');
    expect(vm.travel.label).toBe('2 h 30 min en cotxe');
    expect(vm.cta.disabled).toBe(true);
  });

  it('amb la ubicació, mostra el municipi i deixa buscar', async () => {
    mockedPlace.mockResolvedValue(BARCELONA);
    const { result } = await renderViewModel();
    await waitFor(() => expect(result.current.origin.state).toBe('ready'));
    expect(result.current.origin).toMatchObject({ label: 'Barcelona', hint: 'Ubicació actual' });
    expect(result.current.cta.disabled).toBe(false);
  });

  it('si el mòbil no sap el nom del lloc, diu «On ets ara»', async () => {
    mockedPlace.mockResolvedValue({ status: 'ready', place: { name: '', lat: 41, lon: 2 } });
    const { result } = await renderViewModel();
    await waitFor(() => expect(result.current.origin.label).toBe('On ets ara'));
  });

  it('sense permís, si encara es pot demanar, el torna a demanar', async () => {
    mockedPlace
      .mockResolvedValueOnce({ status: 'denied', canAskAgain: true })
      .mockResolvedValueOnce(BARCELONA);
    const { result } = await renderViewModel();
    await waitFor(() => expect(result.current.origin.state).toBe('denied'));
    expect(result.current.origin).toMatchObject({ label: 'Activa la ubicació', hint: 'Permet-ho' });

    await act(() => result.current.origin.onPress?.());
    await waitFor(() => expect(result.current.origin.label).toBe('Barcelona'));
  });

  it('sense permís i sense poder-lo demanar, obre la configuració', async () => {
    const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue();
    mockedPlace.mockResolvedValue({ status: 'denied', canAskAgain: false });
    const { result } = await renderViewModel();
    await waitFor(() => expect(result.current.origin.state).toBe('denied'));
    expect(result.current.origin.hint).toBe('Configuració');
    expect(result.current.cta.disabled).toBe(true);

    await act(() => result.current.origin.onPress?.());
    expect(openSettings).toHaveBeenCalled();
  });

  it('si falla, ho diu i ho torna a provar', async () => {
    mockedPlace.mockRejectedValueOnce(new Error('GPS')).mockResolvedValueOnce(BARCELONA);
    const { result } = await renderViewModel();
    await waitFor(() => expect(result.current.origin.state).toBe('error'));
    expect(result.current.origin.label).toBe('No hem trobat on ets');

    await act(() => result.current.origin.onPress?.());
    await waitFor(() => expect(result.current.origin.label).toBe('Barcelona'));
  });

  it('en tornar a l’app des de la configuració, torna a buscar on ets', async () => {
    const backToApp = captureAppState();
    mockedPlace
      .mockResolvedValueOnce({ status: 'denied', canAskAgain: false })
      .mockResolvedValueOnce(BARCELONA);
    const { result } = await renderViewModel();
    await waitFor(() => expect(result.current.origin.state).toBe('denied'));

    await backToApp('background');
    expect(mockedPlace).toHaveBeenCalledTimes(1);
    await backToApp('active');
    await waitFor(() => expect(result.current.origin.label).toBe('Barcelona'));
  });

  it('en tornar a l’app l’endemà, «aquesta nit» i la salutació s’actualitzen', async () => {
    jest.useFakeTimers({ now: new Date(2026, 9, 14, 23, 0), doNotFake: ['queueMicrotask'] });
    const backToApp = captureAppState();
    mockedPlace.mockResolvedValue(BARCELONA);
    const { result } = await renderViewModel();
    expect(result.current.calendar.today).toBe('2026-10-14');
    expect(result.current.greeting).toBe('Bona nit');

    jest.setSystemTime(new Date(2026, 9, 15, 7, 0));
    await backToApp('active');
    expect(result.current.calendar.today).toBe('2026-10-15');
    expect(result.current.greeting).toBe('Bon dia');
    jest.useRealTimers();
  });

  it('tria el que es vol veure, també les constel·lacions', async () => {
    mockedPlace.mockResolvedValue(BARCELONA);
    const { result } = await renderViewModel();
    await act(() => result.current.goals[0]?.onPress());
    expect(result.current.goals[0]?.selected).toBe(true);

    await act(() => result.current.constellations.onPress());
    expect(result.current.constellations.selected).toBe(true);
    expect(result.current.goals.some((goal) => goal.selected)).toBe(false);
  });

  it('«Tria el dia» obre el calendari i, en triar un dia, el segment el mostra', async () => {
    mockedPlace.mockResolvedValue(BARCELONA);
    const { result } = await renderViewModel();

    await act(() => result.current.days.onChange(2));
    expect(result.current.calendar.visible).toBe(true);
    // Fins que no es tria un dia, es queda la nit d'abans.
    expect(result.current.days.selectedIndex).toBe(0);
    expect(result.current.calendar).toMatchObject({
      value: tonight,
      min: tonight,
      max: addDays(tonight, 365),
      firstDay: 1,
    });

    await act(() => result.current.calendar.onChange(addDays(tonight, 5)));
    expect(result.current.calendar.visible).toBe(false);
    expect(result.current.days.selectedIndex).toBe(2);
    expect(result.current.days.options[2]).toMatch(/^(dg|dl|dt|dc|dj|dv|ds)\. \d{1,2} \S+$/);

    await act(() => result.current.days.onReselect(2));
    expect(result.current.calendar.visible).toBe(true);
    await act(() => result.current.calendar.onChange(addDays(tonight, 1)));
    expect(result.current.days.selectedIndex).toBe(1);

    await act(() => result.current.days.onChange(2));
    await act(() => result.current.calendar.onClose());
    expect(result.current.days.selectedIndex).toBe(1);
  });

  it('el calendari parla com es diu: títol del mes i dies en veu alta', async () => {
    mockedPlace.mockResolvedValue(BARCELONA);
    const { result } = await renderViewModel();
    expect(result.current.calendar.formatTitle({ year: 2026, month: 9 })).toBe('octubre de 2026');
    expect(result.current.calendar.dayLabel('2026-10-16')).toBe("16 d'octubre");
    expect(result.current.calendar.dayLabel('2026-11-02')).toBe('2 de novembre');

    await act(() => i18n.changeLanguage('en'));
    expect(result.current.calendar.firstDay).toBe(0);
    expect(result.current.calendar.formatTitle({ year: 2026, month: 9 })).toBe('October 2026');
  });

  it('les rodes de la franja: si una arriba a l’hora de l’altra, és l’altra la que es mou', async () => {
    mockedPlace.mockResolvedValue(BARCELONA);
    const { result } = await renderViewModel();
    await act(() => result.current.range.onPress());
    expect(result.current.rangeSheet.visible).toBe(true);
    expect(result.current.rangeSheet.hours).toHaveLength(24);
    expect(result.current.rangeSheet.duration).toBe("8 hores d'observació");

    await act(() => result.current.rangeSheet.wheels[0]?.onChange(6));
    expect(result.current.range.label).toBe('De 06:00 a 07:00');
    expect(result.current.rangeSheet.duration).toBe("1 hora d'observació");

    await act(() => result.current.rangeSheet.wheels[1]?.onChange(6));
    expect(result.current.range.label).toBe('De 05:00 a 06:00');

    await act(() => result.current.rangeSheet.onClose());
    expect(result.current.rangeSheet.visible).toBe(false);
  });

  it('escriu el temps en cotxe en hores i minuts', async () => {
    mockedPlace.mockResolvedValue(BARCELONA);
    const { result } = await renderViewModel();
    await act(() => result.current.travel.onChange(45));
    expect(result.current.travel.label).toBe('45 min en cotxe');
    await act(() => result.current.travel.onChange(240));
    expect(result.current.travel.label).toBe('4 h en cotxe');
  });

  it('busca amb tot el que s’ha triat, amb la posició arrodonida a ~100 m', async () => {
    mockedPlace.mockResolvedValue(BARCELONA);
    const { result } = await renderViewModel();
    await waitFor(() => expect(result.current.cta.disabled).toBe(false));
    await act(() => result.current.goals[2]?.onPress());
    await act(() => result.current.days.onChange(1));
    await act(() => result.current.travel.onChange(90));

    await act(() => result.current.cta.onPress());
    expect(push).toHaveBeenCalledWith({
      pathname: '/recomanacions',
      params: {
        objectiu: 'via_lactia',
        lat: '41.387',
        lon: '2.169',
        data: addDays(tonight, 1),
        desDe: '22',
        finsA: '6',
        tempsMaxim: '90',
      },
    });
  });

  it('sense ubicació, el botó no fa res', async () => {
    mockedPlace.mockResolvedValue({ status: 'denied', canAskAgain: false });
    const { result } = await renderViewModel();
    await waitFor(() => expect(result.current.origin.state).toBe('denied'));
    await act(() => result.current.cta.onPress());
    expect(push).not.toHaveBeenCalled();
  });
});
