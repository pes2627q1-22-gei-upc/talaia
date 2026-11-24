import type { Alerta } from '@talaia/shared';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import { Linking } from 'react-native';

import i18n from '@/core/i18n';
import { usePushPermission } from '@/features/notifications/PushRegistrationProvider';
import type { PushRegistrationState } from '@/features/notifications/usePushRegistration';
import { createQueryWrapper } from '@/test-utils/queryWrapper';

import { alertsRepository } from '../alertsRepository';
import { useAlertsViewModel } from '../useAlertsViewModel';

jest.mock('expo-router', () => ({ useRouter: jest.fn() }));
jest.mock('@/features/notifications/PushRegistrationProvider', () => ({
  usePushPermission: jest.fn(),
}));
jest.mock('../alertsRepository', () => {
  const { useQuery } = jest.requireActual('@tanstack/react-query');
  const actual = jest.requireActual('../alertsRepository');
  const alertsRepository = {
    create: jest.fn(),
    list: jest.fn(),
    setActive: jest.fn(),
    remove: jest.fn(),
  };
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
const mockedRemove = jest.mocked(alertsRepository.remove);
const withPermission = (permission: PushRegistrationState['permission']) =>
  jest.mocked(usePushPermission).mockReturnValue({
    permission,
    registered: permission === 'granted',
    requestPermission: jest.fn(),
  });

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
    mockedRemove.mockReset();
    withPermission('granted');
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
        avisaEnArribar: true,
        horaAvis: null,
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
        notify: { type: 'hour', text: 'Cada nit a les 18:00' },
        active: true,
        toggleLabel: "Alerta de Pluja d'estels",
      },
      // En arribar-hi, l'índex ja és a l'avís i no es repeteix al resum.
      {
        name: 'Via Làctia',
        summary: 'A menys de 45 min',
        notify: { type: 'reach', text: "Quan l'índex arribi a 80" },
        active: false,
      },
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

  it('si un PATCH falla, només desfà aquella alerta, no les tocades mentrestant', async () => {
    mockedList
      .mockResolvedValueOnce([alert(), alert({ id: 'a2', objectiu: 'via_lactia' })])
      .mockReturnValue(new Promise(() => undefined));
    let failA1: (error: Error) => void = () => undefined;
    mockedSetActive.mockImplementation((id) =>
      id === 'a1'
        ? new Promise((_resolve, reject) => {
            failA1 = reject;
          })
        : new Promise(() => undefined),
    );
    const { result } = await renderViewModel();
    await waitFor(() => expect(result.current.state).toBe('list'));

    await act(() => result.current.items[0]?.onToggle(false));
    await act(() => result.current.items[1]?.onToggle(false));
    await waitFor(() => expect(result.current.items[1]?.active).toBe(false));
    await act(async () => failA1(new Error('network')));

    await waitFor(() => expect(result.current.items[0]?.active).toBe(true));
    expect(result.current.items[1]?.active).toBe(false);
  });

  it('prémer una alerta l’obre per editar-la (HU18)', async () => {
    mockedList.mockResolvedValue([alert()]);
    const { result } = await renderViewModel();
    await waitFor(() => expect(result.current.state).toBe('list'));
    expect(result.current.items[0]?.editHint).toBe("Obre l'alerta per editar-la");
    result.current.items[0]?.onPress();
    expect(push).toHaveBeenCalledWith({ pathname: '/alerta/[id]', params: { id: 'a1' } });
  });

  it('«Nova alerta» obre la pantalla de crear-ne una', async () => {
    mockedList.mockResolvedValue([]);
    const { result } = await renderViewModel();
    result.current.create.onPress();
    expect(push).toHaveBeenCalledWith('/nova-alerta');
  });

  it.each(['granted', 'undetermined', null] as const)(
    'amb el permís %s no avisa de res',
    async (p) => {
      mockedList.mockResolvedValue([]);
      withPermission(p);
      const { result } = await renderViewModel();
      expect(result.current.pushNotice).toBeNull();
    },
  );

  it('sense permís de notificacions, ho diu i ofereix obrir la configuració', async () => {
    mockedList.mockResolvedValue([]);
    withPermission('denied');
    const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue();
    const { result } = await renderViewModel();
    expect(result.current.pushNotice?.message).toMatch(/notificacions estan desactivades/);
    result.current.pushNotice?.action?.onPress();
    expect(openSettings).toHaveBeenCalled();
    openSettings.mockRestore();
  });

  it('a un dispositiu sense push (Expo Go, simulador), ho diu sense cap acció', async () => {
    mockedList.mockResolvedValue([]);
    withPermission('unavailable');
    const { result } = await renderViewModel();
    expect(result.current.pushNotice).toEqual({
      message: expect.stringMatching(/no pot rebre notificacions/),
    });
  });

  describe('eliminar una alerta (HU20)', () => {
    it('demana confirmació al full i, si es confirma, l’elimina i surt de la llista', async () => {
      mockedList
        .mockResolvedValueOnce([alert(), alert({ id: 'a2' })])
        .mockResolvedValue([alert({ id: 'a2' })]);
      mockedRemove.mockResolvedValue(undefined);
      const { result } = await renderViewModel();
      await waitFor(() => expect(result.current.items).toHaveLength(2));
      expect(result.current.deleteSheet.visible).toBe(false);

      expect(result.current.items[0]?.delete.label).toBe("Elimina l'alerta de Pluja d'estels");
      await act(() => result.current.items[0]?.delete.onPress());
      expect(result.current.deleteSheet).toMatchObject({
        visible: true,
        title: "Vols eliminar l'alerta?",
        message: "L'alerta de Pluja d'estels s'esborrarà i deixarem d'avisar-te. No es pot desfer.",
        cancelLabel: 'Cancel·la',
        confirmLabel: 'Elimina',
      });
      expect(mockedRemove).not.toHaveBeenCalled();

      await act(() => result.current.deleteSheet.onConfirm());
      await waitFor(() => expect(result.current.items.map((item) => item.id)).toEqual(['a2']));
      expect(mockedRemove).toHaveBeenCalledWith('a1');
      expect(result.current.deleteSheet.visible).toBe(false);
    });

    it('si es cancel·la, el full es tanca i no elimina res', async () => {
      mockedList.mockResolvedValue([alert()]);
      const { result } = await renderViewModel();
      await waitFor(() => expect(result.current.items).toHaveLength(1));

      await act(() => result.current.items[0]?.delete.onPress());
      await act(() => result.current.deleteSheet.onCancel());
      expect(result.current.deleteSheet.visible).toBe(false);
      expect(mockedRemove).not.toHaveBeenCalled();
      expect(result.current.items).toHaveLength(1);
    });

    it('mentre s’elimina, «Cancel·la» no tanca el full (la petició ja ha sortit)', async () => {
      mockedList.mockResolvedValue([alert()]);
      let finish: () => void = () => undefined;
      mockedRemove.mockReturnValue(new Promise<void>((resolve) => (finish = resolve)));
      const { result } = await renderViewModel();
      await waitFor(() => expect(result.current.items).toHaveLength(1));

      await act(() => result.current.items[0]?.delete.onPress());
      await act(() => result.current.deleteSheet.onConfirm());
      await waitFor(() => expect(result.current.deleteSheet.disabled).toBe(true));

      await act(() => result.current.deleteSheet.onCancel());
      expect(result.current.deleteSheet.visible).toBe(true);

      await act(async () => finish());
      await waitFor(() => expect(result.current.deleteSheet.visible).toBe(false));
    });

    it('si falla, el full es queda obert amb l’error i l’alerta continua a la llista', async () => {
      mockedList.mockResolvedValue([alert()]);
      mockedRemove.mockRejectedValueOnce(new Error('xarxa')).mockResolvedValueOnce(undefined);
      const { result } = await renderViewModel();
      await waitFor(() => expect(result.current.items).toHaveLength(1));

      await act(() => result.current.items[0]?.delete.onPress());
      await act(() => result.current.deleteSheet.onConfirm());
      await waitFor(() =>
        expect(result.current.deleteSheet).toMatchObject({
          visible: true,
          title: "No hem pogut eliminar l'alerta",
          message: 'Comprova la connexió i torna-ho a provar.',
          disabled: false,
        }),
      );
      expect(result.current.items).toHaveLength(1);

      // Es pot tornar a provar des del mateix full.
      await act(() => result.current.deleteSheet.onConfirm());
      await waitFor(() => expect(result.current.deleteSheet.visible).toBe(false));
      expect(mockedRemove).toHaveBeenCalledTimes(2);
    });
  });
});
