import type { Alerta } from '@talaia/shared';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useRouter } from 'expo-router';

import i18n from '@/core/i18n';
import { createQueryWrapper } from '@/test-utils/queryWrapper';

import { alertsRepository } from '../alertsRepository';
import { useAlertsViewModel } from '../useAlertsViewModel';

jest.mock('expo-router', () => ({ useRouter: jest.fn() }));
jest.mock('../alertsRepository', () => {
  const { useQuery } = jest.requireActual('@tanstack/react-query');
  const actual = jest.requireActual('../alertsRepository');
  const alertsRepository = { create: jest.fn(), list: jest.fn(), setActive: jest.fn() };
  return {
    ...actual,
    alertsRepository,
    useAlertsQuery: () =>
      useQuery({ queryKey: actual.ALERTS_KEY, queryFn: () => alertsRepository.list() }),
  };
});

const push = jest.fn();
jest.mocked(useRouter).mockReturnValue({ push } as unknown as ReturnType<typeof useRouter>);
const mockedList = jest.mocked(alertsRepository.list);
const mockedSetActive = jest.mocked(alertsRepository.setActive);

const alert = (overrides: Partial<Alerta> = {}): Alerta => ({
  id: 'a1',
  objectiu: 'pluja_estels',
  origen: { lat: 41.39, lon: 2.17 },
  distanciaMaxKm: 115,
  indexMinim: 70,
  avisaEnArribar: false,
  horaAvis: 18,
  activa: true,
  dataCreacio: '2026-11-12T19:00:00Z',
  dataActualitzacio: '2026-11-12T19:00:00Z',
  ...overrides,
});

function renderViewModel() {
  return renderHook(() => useAlertsViewModel(), { wrapper: createQueryWrapper() });
}

describe('useAlertsViewModel', () => {
  beforeEach(async () => {
    push.mockReset();
    mockedList.mockReset();
    mockedSetActive.mockReset();
    await i18n.changeLanguage('ca');
  });

  it('carrega i resumeix cada alerta en temps de cotxe i índex', async () => {
    mockedList.mockResolvedValue([
      alert(),
      alert({
        id: 'a2',
        objectiu: 'via_lactia',
        distanciaMaxKm: 35,
        indexMinim: 80,
        activa: false,
      }),
    ]);
    const { result } = await renderViewModel();
    expect(result.current.state).toBe('loading');
    await waitFor(() => expect(result.current.state).toBe('list'));

    expect(result.current.title).toBe('Alertes');
    expect(result.current.items).toMatchObject([
      {
        name: "Pluja d'estels",
        summary: 'A menys de 2 h 30 min, índex de 70 o més',
        active: true,
        toggleLabel: "Alerta de Pluja d'estels",
      },
      { name: 'Via Làctia', summary: 'A menys de 45 min, índex de 80 o més', active: false },
    ]);
  });

  it('sense alertes, l’estat buit; amb error, es pot tornar a provar', async () => {
    mockedList.mockResolvedValueOnce([]);
    const { result } = await renderViewModel();
    await waitFor(() => expect(result.current.state).toBe('empty'));
    expect(result.current.empty.title).toBe('Encara no tens alertes');

    mockedList.mockRejectedValueOnce(new Error('network'));
    await act(() => result.current.error.retry.onPress());
    await waitFor(() => expect(result.current.state).toBe('error'));
    mockedList.mockResolvedValueOnce([alert()]);
    await act(() => result.current.error.retry.onPress());
    await waitFor(() => expect(result.current.state).toBe('list'));
  });

  it('l’interruptor canvia a l’instant i crida PATCH', async () => {
    mockedList.mockResolvedValue([alert()]);
    mockedSetActive.mockReturnValue(new Promise(() => undefined));
    const { result } = await renderViewModel();
    await waitFor(() => expect(result.current.state).toBe('list'));

    await act(() => result.current.items[0]?.onToggle(false));
    await waitFor(() => expect(result.current.items[0]?.active).toBe(false));
    expect(mockedSetActive).toHaveBeenCalledWith('a1', false);
    expect(result.current.toggleError).toBeNull();
  });

  it('si el PATCH falla, l’interruptor torna on era i ho diu', async () => {
    mockedList.mockResolvedValue([alert()]);
    mockedSetActive.mockRejectedValue(new Error('network'));
    const { result } = await renderViewModel();
    await waitFor(() => expect(result.current.state).toBe('list'));

    await act(() => result.current.items[0]?.onToggle(false));
    await waitFor(() =>
      expect(result.current.toggleError).toBe("No hem pogut canviar l'alerta. Torna-ho a provar."),
    );
    expect(result.current.items[0]?.active).toBe(true);
  });

  it('«Nova alerta» obre la pantalla de crear-ne una', async () => {
    mockedList.mockResolvedValue([]);
    const { result } = await renderViewModel();
    result.current.create.onPress();
    expect(push).toHaveBeenCalledWith('/nova-alerta');
  });
});
