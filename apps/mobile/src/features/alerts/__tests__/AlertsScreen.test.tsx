import type { Alerta } from '@talaia/shared';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import type { PropsWithChildren } from 'react';
import { Linking, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import i18n from '@/core/i18n';
import { usePushPermission } from '@/features/notifications/PushRegistrationProvider';
import type { PushRegistrationState } from '@/features/notifications/usePushRegistration';
import { createQueryWrapper } from '@/test-utils/queryWrapper';

import { alertsRepository } from '../alertsRepository';
import { AlertsScreen } from '../AlertsScreen';

jest.mock('expo-router', () => ({ useRouter: jest.fn() }));
jest.mock('@/features/notifications/PushRegistrationProvider', () => ({
  usePushPermission: jest.fn(),
}));
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

const withPermission = (permission: PushRegistrationState['permission']) =>
  jest.mocked(usePushPermission).mockReturnValue({
    permission,
    registered: permission === 'granted',
    requestPermission: jest.fn(),
  });

const alert = (overrides: Partial<Alerta>): Alerta => ({
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

function renderScreen() {
  const QueryWrapper = createQueryWrapper();
  function Wrapper({ children }: PropsWithChildren) {
    return (
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 393, height: 852 },
          insets: { top: 59, left: 0, right: 0, bottom: 34 },
        }}
      >
        <QueryWrapper>{children}</QueryWrapper>
      </SafeAreaProvider>
    );
  }
  return render(<AlertsScreen />, { wrapper: Wrapper });
}

jest.setTimeout(15_000);

describe('AlertsScreen', () => {
  beforeEach(async () => {
    push.mockReset();
    mockedList.mockReset();
    mockedSetActive.mockReset();
    withPermission('granted');
    await i18n.changeLanguage('ca');
  });

  it('mentre carrega, esquelets en lloc de la llista', async () => {
    mockedList.mockReturnValue(new Promise(() => undefined));
    await renderScreen();
    expect(screen.getByRole('header', { name: 'Alertes' })).toBeOnTheScreen();
    expect(screen.getByTestId('alerts-loading')).toBeOnTheScreen();
  });

  it('llista les alertes amb el resum i l’interruptor, i el botó per crear-ne', async () => {
    mockedList.mockResolvedValue([
      alert({}),
      alert({ id: 'a2', objectiu: 'via_lactia', distanciaMaxKm: 35, activa: false }),
    ]);
    await renderScreen();
    expect(await screen.findByText("Pluja d'estels")).toBeOnTheScreen();
    expect(screen.getByText("T'avisem només quan el cel acompanya.")).toBeOnTheScreen();
    expect(screen.getByText('A menys de 2 h 30 min, índex de 70 o més')).toBeOnTheScreen();
    expect(screen.getByRole('switch', { name: "Alerta de Pluja d'estels" })).toBeChecked();
    expect(screen.getByRole('switch', { name: 'Alerta de Via Làctia' })).not.toBeChecked();
    expect(screen.getByRole('button', { name: 'Nova alerta' })).toBeOnTheScreen();
  });

  it('el text de cada alerta ocupa el que queda i baixa de línia sense tapar l’interruptor', async () => {
    mockedList.mockResolvedValue([alert({})]);
    await renderScreen();
    await screen.findByText("Pluja d'estels");
    expect(StyleSheet.flatten(screen.getByTestId('alert-text-a1').props.style)).toMatchObject({
      flex: 1,
    });
  });

  it('una alerta desactivada s’apaga, però l’interruptor es veu sencer', async () => {
    mockedList.mockResolvedValue([alert({ activa: false })]);
    await renderScreen();
    await screen.findByText("Pluja d'estels");
    expect(StyleSheet.flatten(screen.getByTestId('alert-text-a1').props.style)).toMatchObject({
      opacity: 0.5,
    });
    const toggle = screen.getByRole('switch', { name: "Alerta de Pluja d'estels" });
    expect(StyleSheet.flatten(toggle.props.style).opacity).toBeUndefined();
  });

  it('tocar l’interruptor el canvia i desa; «Nova alerta» obre el formulari', async () => {
    mockedList.mockResolvedValue([alert({})]);
    mockedSetActive.mockReturnValue(new Promise(() => undefined));
    await renderScreen();
    const toggle = await screen.findByRole('switch', { name: "Alerta de Pluja d'estels" });
    await fireEvent.press(toggle);
    expect(mockedSetActive).toHaveBeenCalledWith('a1', false);
    await waitFor(() =>
      expect(screen.getByRole('switch', { name: "Alerta de Pluja d'estels" })).not.toBeChecked(),
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Nova alerta' }));
    expect(push).toHaveBeenCalledWith('/nova-alerta');
  });

  it('prémer l’alerta l’obre per editar-la; l’interruptor és a part i no hi entra', async () => {
    mockedList.mockResolvedValue([alert({})]);
    mockedSetActive.mockReturnValue(new Promise(() => undefined));
    await renderScreen();
    const row = await screen.findByTestId('alert-edit-a1');
    expect(row).toHaveProp('accessibilityRole', 'button');
    expect(row).toHaveProp('accessibilityHint', "Obre l'alerta per editar-la");
    // La part que es prem ocupa el que queda i no conté l'interruptor.
    expect(StyleSheet.flatten(row.props.style)).toMatchObject({ flex: 1 });
    expect(within(row).queryByRole('switch')).toBeNull();

    await fireEvent.press(screen.getByRole('switch', { name: "Alerta de Pluja d'estels" }));
    expect(push).not.toHaveBeenCalled();

    await fireEvent.press(row);
    expect(push).toHaveBeenCalledWith({ pathname: '/alerta/[id]', params: { id: 'a1' } });
  });

  it('sense alertes, ho diu i deixa crear-ne una', async () => {
    mockedList.mockResolvedValue([]);
    await renderScreen();
    expect(await screen.findByText('Encara no tens alertes')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Nova alerta' }));
    expect(push).toHaveBeenCalledWith('/nova-alerta');
  });

  it('si no es pot carregar, ho diu amb un botó per tornar-ho a provar', async () => {
    mockedList.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce([alert({})]);
    await renderScreen();
    expect(await screen.findByText('No hem pogut carregar les alertes')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Torna-ho a provar' }));
    expect(await screen.findByText("Pluja d'estels")).toBeOnTheScreen();
  });

  it('si no es pot canviar una alerta, l’avís surt a la llista', async () => {
    mockedList.mockResolvedValue([alert({})]);
    mockedSetActive.mockRejectedValue(new Error('network'));
    await renderScreen();
    await fireEvent.press(await screen.findByRole('switch', { name: "Alerta de Pluja d'estels" }));
    const warning = await screen.findByRole('alert');
    expect(within(warning.parent ?? warning).getByText(/No hem pogut canviar/)).toBeOnTheScreen();
  });

  it('sense permís de notificacions, ho indica sobre la llista i obre la configuració (HU17)', async () => {
    mockedList.mockResolvedValue([alert({})]);
    withPermission('denied');
    const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue();
    await renderScreen();
    expect(await screen.findByText("Pluja d'estels")).toBeOnTheScreen();
    expect(screen.getByText(/notificacions estan desactivades/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Obre la configuració' }));
    expect(openSettings).toHaveBeenCalledTimes(1);
    openSettings.mockRestore();
  });

  it('a Expo Go diu que no hi ha notificacions, sense botó', async () => {
    mockedList.mockResolvedValue([]);
    withPermission('unavailable');
    await renderScreen();
    expect(await screen.findByText(/no pot rebre notificacions/)).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Obre la configuració' })).toBeNull();
  });
});
