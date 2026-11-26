import type { Alerta } from '@talaia/shared';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import type { PropsWithChildren } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import i18n from '@/core/i18n';
import { getCurrentPlace, placeName } from '@/features/explore/locationRepository';
import { createQueryWrapper } from '@/test-utils/queryWrapper';

import { alertsRepository } from '../alertsRepository';
import { EditAlertScreen } from '../EditAlertScreen';

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
jest.mock('../alertsRepository', () => {
  const { useQuery } = jest.requireActual('@tanstack/react-query');
  const actual = jest.requireActual('../alertsRepository');
  const alertsRepository = {
    create: jest.fn(),
    list: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };
  return {
    ...actual,
    alertsRepository,
    useAlertsQuery: () =>
      useQuery({ queryKey: actual.ALERTS_KEY, queryFn: () => alertsRepository.list() }),
  };
});
jest.mock('../ZonePickerMap', () => () => null);

const back = jest.fn();
jest.mocked(useRouter).mockReturnValue({ back } as unknown as ReturnType<typeof useRouter>);
const mockedList = jest.mocked(alertsRepository.list);
const mockedUpdate = jest.mocked(alertsRepository.update);
const mockedRemove = jest.mocked(alertsRepository.remove);
const SAVED: Alerta = {
  id: 'a1',
  objectiu: 'pluja_estels',
  origen: { lat: 42.1, lon: 1.845 },
  distanciaMaxKm: 115,
  indexMinim: 60,
  avisaEnArribar: false,
  horaAvis: 21,
  activa: true,
  dataCreacio: '2026-11-12T19:00:00Z',
  dataActualitzacio: '2026-11-12T19:00:00Z',
};

function renderScreen(alertId = 'a1') {
  const QueryWrapper = createQueryWrapper();
  function Wrapper({ children }: PropsWithChildren) {
    return (
      <GestureHandlerRootView>
        <SafeAreaProvider
          initialMetrics={{
            frame: { x: 0, y: 0, width: 393, height: 852 },
            insets: { top: 59, left: 0, right: 0, bottom: 34 },
          }}
        >
          <QueryWrapper>{children}</QueryWrapper>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }
  return render(<EditAlertScreen alertId={alertId} />, { wrapper: Wrapper });
}

jest.setTimeout(15_000);

describe('EditAlertScreen', () => {
  beforeEach(async () => {
    back.mockReset();
    mockedList.mockReset();
    mockedUpdate.mockReset();
    mockedRemove.mockReset();
    jest
      .mocked(getCurrentPlace)
      .mockResolvedValue({ status: 'ready', place: { name: 'Girona', lat: 41.98, lon: 2.82 } });
    jest.mocked(placeName).mockResolvedValue('Berga');
    await i18n.changeLanguage('ca');
  });

  it('mostra el formulari de «Nova alerta» amb els valors de l’alerta', async () => {
    mockedList.mockResolvedValue([SAVED]);
    await renderScreen();

    // El títol ja surt mentre carrega: el formulari és a punt quan hi ha el botó de desar.
    await screen.findByRole('button', { name: 'Desa els canvis' });
    expect(screen.getByRole('header', { name: "Edita l'alerta" })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Enrere' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: "Pluja d'estels" })).toBeSelected();
    expect(screen.getByRole('tab', { name: 'Una zona concreta' })).toBeSelected();
    expect(await screen.findByText('Berga')).toBeOnTheScreen();
    expect(screen.getByText('2 h 30 min')).toBeOnTheScreen();
    expect(screen.getByText('60, justet')).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: 'A una hora concreta. Cada nit a les 21:00' }),
    ).toBeSelected();
    expect(screen.getByText("Avisa'm a les 21:00")).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Desa els canvis' })).toBeDisabled();
  });

  it('en canviar el fenomen es pot desar, i desa amb PATCH i torna a la llista', async () => {
    mockedList.mockResolvedValue([SAVED]);
    mockedUpdate.mockResolvedValue({ ...SAVED, objectiu: 'via_lactia' });
    await renderScreen();

    await fireEvent.press(await screen.findByRole('button', { name: 'Via Làctia' }));
    const save = screen.getByRole('button', { name: 'Desa els canvis' });
    expect(save).toBeEnabled();
    await fireEvent.press(save);

    await waitFor(() => expect(back).toHaveBeenCalledTimes(1));
    expect(mockedUpdate).toHaveBeenCalledWith('a1', { objectiu: 'via_lactia' });
  });

  it('«Elimina l’alerta» és al final del formulari, apartat de la barra de pestanyes (TG-267)', async () => {
    mockedList.mockResolvedValue([SAVED]);
    await renderScreen();
    const remove = await screen.findByRole('button', { name: "Elimina l'alerta" });
    expect(remove).toBeEnabled();
    const scroll = screen.getByTestId('new-alert-scroll');
    expect(scroll.props.contentInsetAdjustmentBehavior).toBe('automatic');
    expect(within(scroll).getByRole('button', { name: "Elimina l'alerta" })).toBeOnTheScreen();
  });

  it('eliminar demana confirmació, elimina l’alerta i torna a la llista (HU20)', async () => {
    mockedList.mockResolvedValueOnce([SAVED]).mockResolvedValue([]);
    mockedRemove.mockResolvedValue(undefined);
    await renderScreen();

    await fireEvent.press(await screen.findByRole('button', { name: "Elimina l'alerta" }));
    // El full de confirmació de l'app, no el diàleg natiu.
    expect(await screen.findByText("Vols eliminar l'alerta?")).toBeOnTheScreen();
    expect(
      screen.getByText(
        "L'alerta de Pluja d'estels s'esborrarà i deixarem d'avisar-te. No es pot desfer.",
      ),
    ).toBeOnTheScreen();
    expect(mockedRemove).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('button', { name: 'Elimina' }));
    await waitFor(() => expect(back).toHaveBeenCalledTimes(1));
    expect(mockedRemove).toHaveBeenCalledWith('a1');
    // Mentre la pantalla marxa, no canvia pel missatge d'alerta inexistent.
    await waitFor(() => expect(mockedList).toHaveBeenCalledTimes(2));
    expect(screen.queryByText('No hem trobat aquesta alerta')).toBeNull();
  });

  it('si es cancel·la l’eliminació, no passa res', async () => {
    mockedList.mockResolvedValue([SAVED]);
    await renderScreen();
    await fireEvent.press(await screen.findByRole('button', { name: "Elimina l'alerta" }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Cancel·la' }));
    expect(mockedRemove).not.toHaveBeenCalled();
    expect(back).not.toHaveBeenCalled();
  });

  it('el full de l’hora s’obre amb l’hora desada', async () => {
    mockedList.mockResolvedValue([SAVED]);
    await renderScreen();
    await fireEvent.press(await screen.findByText("Avisa'm a les 21:00"));
    expect(await screen.findByText("Hora de l'avís")).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Fet' })).toBeOnTheScreen();
  });

  it('mentre carrega la llista, esquelets', async () => {
    mockedList.mockReturnValue(new Promise(() => undefined));
    await renderScreen();
    expect(screen.getByTestId('edit-alert-loading')).toBeOnTheScreen();
    expect(screen.getByText("Edita l'alerta")).toBeOnTheScreen();
  });

  it('si l’alerta ja no hi és, ho diu i deixa tornar enrere', async () => {
    mockedList.mockResolvedValue([]);
    await renderScreen();
    expect(await screen.findByText('No hem trobat aquesta alerta')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Enrere' }));
    expect(back).toHaveBeenCalledTimes(1);
  });

  it('si no es pot carregar, ho diu amb un botó per tornar-ho a provar', async () => {
    mockedList.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce([SAVED]);
    await renderScreen();
    expect(await screen.findByText('No hem pogut carregar les alertes')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Torna-ho a provar' }));
    expect(await screen.findByRole('button', { name: 'Desa els canvis' })).toBeOnTheScreen();
  });
});
