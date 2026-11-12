import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useRouter } from 'expo-router';

import { ApiError } from '@/core/api/httpClient';
import i18n from '@/core/i18n';
import { getCurrentPlace, placeName } from '@/features/explore/locationRepository';
import { createQueryWrapper } from '@/test-utils/queryWrapper';

import { alertsRepository } from '../alertsRepository';
import { useNewAlertViewModel } from '../useNewAlertViewModel';

jest.mock('expo-router', () => ({ useRouter: jest.fn() }));
jest.mock('@/features/explore/locationRepository', () => {
  const { useQuery } = jest.requireActual('@tanstack/react-query');
  const { CURRENT_PLACE_KEY } = jest.requireActual('@/features/explore/locationKeys');
  const getCurrentPlace = jest.fn();
  return {
    getCurrentPlace,
    placeName: jest.fn(),
    useCurrentPlaceQuery: () =>
      useQuery({ queryKey: CURRENT_PLACE_KEY, queryFn: getCurrentPlace, retry: false }),
  };
});
jest.mock('../alertsRepository', () => ({
  ...jest.requireActual('../alertsRepository'),
  alertsRepository: { create: jest.fn(), list: jest.fn() },
}));

const back = jest.fn();
jest.mocked(useRouter).mockReturnValue({ back } as unknown as ReturnType<typeof useRouter>);
const mockedPlace = jest.mocked(getCurrentPlace);
const mockedName = jest.mocked(placeName);
const mockedCreate = jest.mocked(alertsRepository.create);
const BARCELONA = {
  status: 'ready',
  place: { name: 'Barcelona', lat: 41.387412, lon: 2.168569 },
} as const;

function renderViewModel() {
  return renderHook(() => useNewAlertViewModel(), { wrapper: createQueryWrapper() });
}

async function readyViewModel() {
  mockedPlace.mockResolvedValue(BARCELONA);
  const rendered = await renderViewModel();
  await waitFor(() => expect(rendered.result.current.cta.disabled).toBe(false));
  return rendered;
}

describe('useNewAlertViewModel', () => {
  beforeEach(async () => {
    back.mockReset();
    mockedPlace.mockReset();
    mockedName.mockReset();
    mockedCreate.mockReset();
    await i18n.changeLanguage('ca');
  });

  it('arrenca com el mockup: cel estrellat, la meva ubicació, 2 h 30 min, 75 i a les 18:00', async () => {
    mockedPlace.mockReturnValue(new Promise(() => undefined));
    const { result } = await renderViewModel();
    const vm = result.current;

    expect(vm.title).toBe('Nova alerta');
    expect(vm.goals.find((goal) => goal.selected)?.id).toBe('cel_estrellat');
    expect(vm.originModes.options).toEqual(['La meva ubicació', 'Una zona concreta']);
    expect(vm.originModes.selectedIndex).toBe(0);
    expect(vm.origin.state).toBe('loading');
    expect(vm.travel.label).toBe('2 h 30 min');
    expect(vm.minIndex).toMatchObject({ label: '75, cel ras', color: 'ras' });
    expect(vm.notifyOptions.map((option) => [option.label, option.selected])).toEqual([
      ["Quan s'hi arribi", false],
      ['A una hora', true],
    ]);
    expect(vm.notifyHour?.label).toBe('El mateix dia a les 18:00');
    expect(vm.cta).toMatchObject({ label: "Crea l'alerta", disabled: true });
    expect(vm.error).toBeNull();
  });

  it('el valor de l’índex porta el nom i el color de la franja', async () => {
    const { result } = await readyViewModel();
    await act(() => result.current.minIndex.onChange(40));
    expect(result.current.minIndex).toMatchObject({ label: '40, justet', color: 'jus' });
    await act(() => result.current.minIndex.onChange(35));
    expect(result.current.minIndex).toMatchObject({ label: '35, tapat', color: 'tap' });
  });

  it('no deixa triar els fenòmens que encara no tenen índex', async () => {
    const { result } = await readyViewModel();
    const posta = result.current.goals.find((goal) => goal.id === 'posta_sol');
    expect(posta).toMatchObject({ disabled: true, badge: 'Aviat' });
    await act(() => posta?.onPress());
    expect(result.current.goals.find((goal) => goal.selected)?.id).toBe('cel_estrellat');
  });

  it('crea l’alerta amb el temps convertit a km i els avisos, i torna enrere', async () => {
    mockedCreate.mockResolvedValue({} as never);
    const { result } = await readyViewModel();

    await act(() => result.current.goals.find((goal) => goal.id === 'via_lactia')?.onPress());
    await act(() => result.current.travel.onChange(240));
    await act(() => result.current.minIndex.onChange(85));
    await act(() => result.current.notifyOptions[0]?.onPress());
    await act(() => result.current.hourSheet.onChange(21));
    await act(() => result.current.cta.onPress());

    await waitFor(() => expect(back).toHaveBeenCalledTimes(1));
    expect(mockedCreate.mock.calls[0]?.[0]).toEqual({
      objectiu: 'via_lactia',
      origen: { lat: 41.387, lon: 2.169 },
      // 4 h a 60 km/h amb el desviament ×1,3 de les recomanacions.
      distanciaMaxKm: 185,
      indexMinim: 85,
      avisaEnArribar: true,
      horaAvis: 21,
    });
  });

  it('només en arribar a l’índex: sense hora, i sense cap avís no es pot crear', async () => {
    mockedCreate.mockResolvedValue({} as never);
    const { result } = await readyViewModel();

    await act(() => result.current.notifyOptions[1]?.onPress());
    expect(result.current.notifyHour).toBeNull();
    expect(result.current.notifyHint).toBe("Tria com a mínim una manera d'avisar-te.");
    expect(result.current.cta.disabled).toBe(true);

    await act(() => result.current.notifyOptions[0]?.onPress());
    expect(result.current.notifyHint).toBeNull();
    await act(() => result.current.cta.onPress());
    await waitFor(() => expect(mockedCreate).toHaveBeenCalledTimes(1));
    expect(mockedCreate.mock.calls[0]?.[0]).toMatchObject({
      avisaEnArribar: true,
      horaAvis: null,
    });
  });

  it('una zona concreta: obre el mapa, en pren el centre i el nom, i hi crea l’alerta', async () => {
    mockedName.mockResolvedValue('Berga');
    mockedCreate.mockResolvedValue({} as never);
    const { result } = await readyViewModel();

    await act(() => result.current.originModes.onChange(1));
    expect(result.current.zoneSheet.visible).toBe(true);
    // El mapa comença on és l'usuari.
    expect(result.current.zoneSheet.center).toEqual({ lat: 41.387412, lon: 2.168569 });
    expect(result.current.cta.disabled).toBe(true);

    await act(() => result.current.zoneSheet.onCenterChange({ lat: 42.1034, lon: 1.8456 }));
    await act(() => result.current.zoneSheet.confirm.onPress());
    await waitFor(() => expect(result.current.zoneSheet.visible).toBe(false));
    expect(mockedName).toHaveBeenCalledWith(42.1034, 1.8456);
    expect(result.current.origin).toMatchObject({ label: 'Berga', hint: 'Canvia' });

    await act(() => result.current.cta.onPress());
    await waitFor(() => expect(mockedCreate).toHaveBeenCalledTimes(1));
    expect(mockedCreate.mock.calls[0]?.[0].origen).toEqual({ lat: 42.103, lon: 1.846 });
  });

  it('si es tanca el mapa sense triar, no hi ha zona i no es pot crear', async () => {
    const { result } = await readyViewModel();
    await act(() => result.current.originModes.onChange(1));
    await act(() => result.current.zoneSheet.onClose());
    expect(result.current.origin).toMatchObject({ label: 'Cap zona triada', hint: 'Tria-la' });
    expect(result.current.cta.disabled).toBe(true);

    await act(() => result.current.originModes.onChange(0));
    expect(result.current.cta.disabled).toBe(false);
  });

  it('mentre desa, el botó diu «Creant…» i no es pot tornar a prémer', async () => {
    mockedCreate.mockReturnValue(new Promise(() => undefined));
    const { result } = await readyViewModel();

    await act(() => result.current.cta.onPress());
    await waitFor(() => expect(result.current.cta.label).toBe("Creant l'alerta…"));
    expect(result.current.cta.disabled).toBe(true);
    await act(() => result.current.cta.onPress());
    expect(mockedCreate).toHaveBeenCalledTimes(1);
  });

  it('si ja té el màxim d’alertes, ho diu i es queda a la pantalla', async () => {
    mockedCreate.mockRejectedValue(new ApiError(409, 'alert_limit_reached', 'Massa alertes'));
    const { result } = await readyViewModel();

    await act(() => result.current.cta.onPress());
    await waitFor(() => expect(result.current.error).toMatch(/màxim d'alertes/));
    expect(back).not.toHaveBeenCalled();
    expect(result.current.cta.disabled).toBe(false);
  });

  it('qualsevol altre error demana tornar-ho a provar', async () => {
    mockedCreate.mockRejectedValue(new Error('network'));
    const { result } = await readyViewModel();

    await act(() => result.current.cta.onPress());
    await waitFor(() =>
      expect(result.current.error).toBe("No hem pogut crear l'alerta. Torna-ho a provar."),
    );
  });

  it('sense ubicació no es pot crear', async () => {
    mockedPlace.mockResolvedValue({ status: 'denied', canAskAgain: true });
    const { result } = await renderViewModel();
    await waitFor(() => expect(result.current.origin.state).toBe('denied'));
    expect(result.current.cta.disabled).toBe(true);
    await act(() => result.current.cta.onPress());
    expect(mockedCreate).not.toHaveBeenCalled();
  });
});
