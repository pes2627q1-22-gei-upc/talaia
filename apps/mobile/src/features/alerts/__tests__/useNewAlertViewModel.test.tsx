import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useRouter } from 'expo-router';

import { ApiError } from '@/core/api/httpClient';
import i18n from '@/core/i18n';
import { getCurrentPlace } from '@/features/explore/locationRepository';
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
const mockedCreate = jest.mocked(alertsRepository.create);
const BARCELONA = {
  status: 'ready',
  place: { name: 'Barcelona', lat: 41.387412, lon: 2.168569 },
} as const;

function renderViewModel() {
  return renderHook(() => useNewAlertViewModel(), { wrapper: createQueryWrapper() });
}

describe('useNewAlertViewModel', () => {
  beforeEach(async () => {
    back.mockReset();
    mockedPlace.mockReset();
    mockedCreate.mockReset();
    await i18n.changeLanguage('ca');
  });

  it('arrenca amb cel estrellat, 50 km i índex 70, buscant on ets', async () => {
    mockedPlace.mockReturnValue(new Promise(() => undefined));
    const { result } = await renderViewModel();
    const vm = result.current;

    expect(vm.title).toBe('Nova alerta');
    expect(vm.goals.find((goal) => goal.selected)?.id).toBe('cel_estrellat');
    expect(vm.origin.state).toBe('loading');
    expect(vm.distance.label).toBe('50 km');
    expect(vm.minIndex.label).toBe('70 o més');
    expect(vm.cta).toMatchObject({ label: "Crea l'alerta", disabled: true });
    expect(vm.error).toBeNull();
  });

  it('no deixa triar els fenòmens que encara no tenen índex', async () => {
    mockedPlace.mockResolvedValue(BARCELONA);
    const { result } = await renderViewModel();
    const posta = result.current.goals.find((goal) => goal.id === 'posta_sol');
    expect(posta).toMatchObject({ disabled: true, badge: 'Aviat' });
    await act(() => posta?.onPress());
    expect(result.current.goals.find((goal) => goal.selected)?.id).toBe('cel_estrellat');
  });

  it('crea l’alerta amb el que s’ha triat i torna enrere', async () => {
    mockedPlace.mockResolvedValue(BARCELONA);
    mockedCreate.mockResolvedValue({} as never);
    const { result } = await renderViewModel();
    await waitFor(() => expect(result.current.cta.disabled).toBe(false));

    await act(() => result.current.goals.find((goal) => goal.id === 'via_lactia')?.onPress());
    await act(() => result.current.distance.onChange(120));
    await act(() => result.current.minIndex.onChange(85));
    await act(() => result.current.cta.onPress());

    await waitFor(() => expect(back).toHaveBeenCalledTimes(1));
    expect(mockedCreate.mock.calls[0]?.[0]).toEqual({
      objectiu: 'via_lactia',
      origen: { lat: 41.387, lon: 2.169 },
      distanciaMaxKm: 120,
      indexMinim: 85,
    });
  });

  it('mentre desa, el botó diu «Creant…» i no es pot tornar a prémer', async () => {
    mockedPlace.mockResolvedValue(BARCELONA);
    mockedCreate.mockReturnValue(new Promise(() => undefined));
    const { result } = await renderViewModel();
    await waitFor(() => expect(result.current.cta.disabled).toBe(false));

    await act(() => result.current.cta.onPress());
    await waitFor(() => expect(result.current.cta.label).toBe("Creant l'alerta…"));
    expect(result.current.cta.disabled).toBe(true);
    await act(() => result.current.cta.onPress());
    expect(mockedCreate).toHaveBeenCalledTimes(1);
  });

  it('si ja té el màxim d’alertes, ho diu i es queda a la pantalla', async () => {
    mockedPlace.mockResolvedValue(BARCELONA);
    mockedCreate.mockRejectedValue(new ApiError(409, 'alert_limit_reached', 'Massa alertes'));
    const { result } = await renderViewModel();
    await waitFor(() => expect(result.current.cta.disabled).toBe(false));

    await act(() => result.current.cta.onPress());
    await waitFor(() => expect(result.current.error).toMatch(/màxim d'alertes/));
    expect(back).not.toHaveBeenCalled();
    expect(result.current.cta.disabled).toBe(false);
  });

  it('qualsevol altre error demana tornar-ho a provar', async () => {
    mockedPlace.mockResolvedValue(BARCELONA);
    mockedCreate.mockRejectedValue(new Error('network'));
    const { result } = await renderViewModel();
    await waitFor(() => expect(result.current.cta.disabled).toBe(false));

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
