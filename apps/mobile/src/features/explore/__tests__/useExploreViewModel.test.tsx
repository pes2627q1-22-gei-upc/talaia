import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import { Linking } from 'react-native';

import i18n from '@/core/i18n';
import { createQueryWrapper } from '@/test-utils/queryWrapper';

import { addDays, nightOf } from '../exploreModel';
import { getCurrentPlace } from '../locationRepository';
import { useExploreViewModel } from '../useExploreViewModel';

jest.mock('expo-router', () => ({ useRouter: jest.fn() }));
jest.mock('../locationRepository', () => ({ getCurrentPlace: jest.fn() }));

const push = jest.fn();
jest.mocked(useRouter).mockReturnValue({ push } as unknown as ReturnType<typeof useRouter>);
const mockedPlace = jest.mocked(getCurrentPlace);
const BARCELONA = { status: 'ready', place: { name: 'Barcelona', lat: 41.39, lon: 2.17 } } as const;

function renderViewModel() {
  return renderHook(() => useExploreViewModel(), { wrapper: createQueryWrapper() });
}

describe('useExploreViewModel', () => {
  const tonight = nightOf(new Date());

  beforeEach(async () => {
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
    expect(vm.goals.map((goal) => goal.label)).toEqual([
      "Pluja d'estels",
      'Eclipsi',
      'Via Làctia',
      'Posta de sol',
      'Sortida de sol',
      'Cel estrellat',
    ]);
    expect(vm.goals.find((goal) => goal.selected)?.id).toBe('cel_estrellat');
    expect(vm.origin).toMatchObject({ state: 'loading', label: 'Buscant on ets…' });
    expect(vm.days.options).toEqual(['Aquesta nit', 'Demà', 'Tria el dia']);
    expect(vm.days.selectedIndex).toBe(0);
    expect(vm.pickableNights).toEqual([]);
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

  it('sense permís, demana activar la ubicació i obre la configuració', async () => {
    const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue();
    mockedPlace.mockResolvedValue({ status: 'denied' });
    const { result } = await renderViewModel();
    await waitFor(() => expect(result.current.origin.state).toBe('denied'));
    expect(result.current.origin).toMatchObject({
      label: 'Activa la ubicació',
      hint: 'Configuració',
    });
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
    expect(mockedPlace).toHaveBeenCalledTimes(2);
  });

  it('tria el que es vol veure, també les constel·lacions', async () => {
    mockedPlace.mockResolvedValue(BARCELONA);
    const { result } = await renderViewModel();
    await act(() => result.current.goals[0]?.onPress());
    expect(result.current.goals[0]?.selected).toBe(true);
    expect(result.current.goals[5]?.selected).toBe(false);

    await act(() => result.current.constellations.onPress());
    expect(result.current.constellations.selected).toBe(true);
    expect(result.current.goals.some((goal) => goal.selected)).toBe(false);
  });

  it('«Tria el dia» ofereix les 14 nits a partir de demà passat', async () => {
    mockedPlace.mockResolvedValue(BARCELONA);
    const { result } = await renderViewModel();
    await act(() => result.current.days.onChange(2));

    const nights = result.current.pickableNights;
    expect(nights).toHaveLength(14);
    expect(nights[0]).toMatchObject({ date: addDays(tonight, 2), selected: true });
    expect(nights[0]?.label).toMatch(/^(dg|dl|dt|dc|dj|dv|ds)\. \d{1,2}$/);

    await act(() => nights[3]?.onPress());
    expect(result.current.pickableNights[3]?.selected).toBe(true);
  });

  it('la franja va d’hora en hora, passa de mitjanit i dura almenys una hora', async () => {
    mockedPlace.mockResolvedValue(BARCELONA);
    const { result } = await renderViewModel();
    await act(() => result.current.range.onPress());
    expect(result.current.rangeSheet.visible).toBe(true);
    expect(result.current.rangeSheet.duration).toBe("8 hores d'observació");

    const [from] = result.current.rangeSheet.rows;
    for (let i = 0; i < 7; i++) await act(() => from?.onLater());
    expect(result.current.rangeSheet.rows[0]?.value).toBe('05:00');
    expect(result.current.rangeSheet.duration).toBe("1 hora d'observació");

    // Les 06:00 són el final: l'inici se'l salta.
    await act(() => result.current.rangeSheet.rows[0]?.onLater());
    expect(result.current.range.label).toBe('De 07:00 a 06:00');

    await act(() => result.current.rangeSheet.rows[1]?.onEarlier());
    expect(result.current.rangeSheet.rows[1]?.value).toBe('05:00');

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

  it('busca amb tot el que s’ha triat', async () => {
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
        lat: '41.39',
        lon: '2.17',
        data: addDays(tonight, 1),
        desDe: '22',
        finsA: '6',
        tempsMaxim: '90',
      },
    });
  });

  it('sense ubicació, el botó no fa res', async () => {
    mockedPlace.mockResolvedValue({ status: 'denied' });
    const { result } = await renderViewModel();
    await waitFor(() => expect(result.current.origin.state).toBe('denied'));
    await act(() => result.current.cta.onPress());
    expect(push).not.toHaveBeenCalled();
  });
});
