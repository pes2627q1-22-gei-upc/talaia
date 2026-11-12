import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import type { PropsWithChildren } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ApiError } from '@/core/api/httpClient';
import { colors } from '@/core/theme/tokens';
import i18n from '@/core/i18n';
import { getCurrentPlace, placeName } from '@/features/explore/locationRepository';
import { createQueryWrapper } from '@/test-utils/queryWrapper';

import { alertsRepository } from '../alertsRepository';
import { NewAlertScreen } from '../NewAlertScreen';

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
// El mapa és un WebView (DOM component): aquí n'hi ha prou amb les props que rep.
const mockZoneMap = jest.fn();
jest.mock('../ZonePickerMap', () => (props: unknown) => {
  mockZoneMap(props);
  return null;
});

const back = jest.fn();
jest.mocked(useRouter).mockReturnValue({ back } as unknown as ReturnType<typeof useRouter>);
const mockedCreate = jest.mocked(alertsRepository.create);

const METRICS = {
  frame: { x: 0, y: 0, width: 393, height: 852 },
  insets: { top: 59, left: 0, right: 0, bottom: 34 },
};

function renderScreen() {
  const QueryWrapper = createQueryWrapper();
  function Wrapper({ children }: PropsWithChildren) {
    return (
      <GestureHandlerRootView>
        <SafeAreaProvider initialMetrics={METRICS}>
          <QueryWrapper>{children}</QueryWrapper>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }
  return render(<NewAlertScreen />, { wrapper: Wrapper });
}

const increment = { nativeEvent: { actionName: 'increment' } };
const ready = () => screen.findByLabelText('Girona, Ubicació actual');

// Pantalla sencera: en paral·lel amb la resta, l'entorn de Skia endarrereix el primer render.
jest.setTimeout(15_000);

describe('NewAlertScreen', () => {
  beforeEach(async () => {
    back.mockReset();
    mockedCreate.mockReset();
    mockZoneMap.mockReset();
    jest
      .mocked(getCurrentPlace)
      .mockResolvedValue({ status: 'ready', place: { name: 'Girona', lat: 41.98, lon: 2.82 } });
    await i18n.changeLanguage('ca');
  });

  it('mostra totes les seccions del mockup 11 amb els valors per defecte', async () => {
    await renderScreen();
    expect(screen.getByRole('header', { name: 'Nova alerta' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Enrere' })).toBeOnTheScreen();
    expect(screen.getByText('Què vols veure')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Cel estrellat' })).toBeSelected();
    expect(screen.getByRole('button', { name: 'Posta de sol. Aviat' })).toBeDisabled();
    expect(screen.getByRole('tab', { name: 'La meva ubicació' })).toBeSelected();
    expect(screen.getByRole('tab', { name: 'Una zona concreta' })).toBeOnTheScreen();
    expect(await ready()).toBeOnTheScreen();
    expect(screen.getByRole('adjustable', { name: 'Distància màxima' })).toBeOnTheScreen();
    expect(screen.getByText('2 h 30 min')).toBeOnTheScreen();
    expect(screen.getByRole('adjustable', { name: 'Índex mínim' })).toBeOnTheScreen();
    expect(screen.getByText("Quan t'avisem")).toBeOnTheScreen();
    expect(screen.getByLabelText('El mateix dia a les 18:00, Canvia')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: "Crea l'alerta" })).toBeEnabled();
  });

  it('el títol i el botó enrere queden dins de l’àrea segura de dalt', async () => {
    await renderScreen();
    const safeArea = screen.getByTestId('new-alert-safe-area');
    expect(safeArea.props.edges).toMatchObject({ top: 'additive', bottom: 'off' });
    expect(within(safeArea).getByRole('header', { name: 'Nova alerta' })).toBeOnTheScreen();
    expect(within(safeArea).getByRole('button', { name: 'Enrere' })).toBeOnTheScreen();
  });

  it('els rètols llargs es poden partir en lloc de tapar el valor o sortir de la pantalla', async () => {
    await i18n.changeLanguage('es');
    await renderScreen();
    for (const text of ['Nueva alerta', 'Distancia máxima', 'Índice mínimo']) {
      expect(StyleSheet.flatten(screen.getByText(text).props.style)).toMatchObject({
        flexShrink: 1,
      });
    }
  });

  it('la barra de l’índex té els tres colors de les franges i el valor, el de la seva', async () => {
    await renderScreen();
    const segments = screen.getAllByTestId('slider-segment');
    expect(segments.map((segment) => StyleSheet.flatten(segment.props.style))).toEqual([
      { flex: 40, backgroundColor: colors.tap },
      { flex: 30, backgroundColor: colors.jus },
      { flex: 30, backgroundColor: colors.ras },
    ]);
    expect(StyleSheet.flatten(screen.getByText('75, cel ras').props.style)).toMatchObject({
      color: colors.ras,
    });
    await fireEvent(
      screen.getByRole('adjustable', { name: 'Índex mínim' }),
      'accessibilityAction',
      { nativeEvent: { actionName: 'decrement' } },
    );
    expect(StyleSheet.flatten(screen.getByText('70, cel ras').props.style)).toMatchObject({
      color: colors.ras,
    });
  });

  it('el fenomen, la distància i els avisos reflecteixen la selecció', async () => {
    await renderScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Via Làctia' }));
    expect(screen.getByRole('button', { name: 'Via Làctia' })).toBeSelected();
    expect(screen.getByRole('button', { name: 'Cel estrellat' })).not.toBeSelected();

    await fireEvent(
      screen.getByRole('adjustable', { name: 'Distància màxima' }),
      'accessibilityAction',
      increment,
    );
    expect(screen.getByText('2 h 45 min')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: "Quan s'hi arribi" }));
    expect(screen.getByRole('button', { name: "Quan s'hi arribi" })).toBeSelected();
    await fireEvent.press(screen.getByRole('button', { name: 'A una hora' }));
    expect(screen.queryByLabelText('El mateix dia a les 18:00, Canvia')).toBeNull();
  });

  it('sense cap avís triat, ho diu i el botó està desactivat', async () => {
    await renderScreen();
    await ready();
    await fireEvent.press(screen.getByRole('button', { name: 'A una hora' }));
    expect(screen.getByText("Tria com a mínim una manera d'avisar-te.")).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: "Crea l'alerta" })).toBeDisabled();
  });

  it('l’hora de l’avís s’obre en un full amb una roda', async () => {
    await renderScreen();
    await fireEvent.press(screen.getByLabelText('El mateix dia a les 18:00, Canvia'));
    expect(await screen.findByText("Hora de l'avís")).toBeOnTheScreen();
    expect(screen.getByTestId('wheel-notify-hour')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Fet' })).toBeOnTheScreen();
  });

  it('«Una zona concreta» obre el mapa i, en triar-la, la fila en diu el nom', async () => {
    jest.mocked(placeName).mockResolvedValue('Berga');
    await renderScreen();
    await ready();

    await fireEvent.press(screen.getByRole('tab', { name: 'Una zona concreta' }));
    expect(await screen.findByText('Tria la zona')).toBeOnTheScreen();
    expect(screen.getByText("Mou el mapa fins que l'agulla quedi on vols.")).toBeOnTheScreen();
    const mapProps = mockZoneMap.mock.lastCall?.[0] as {
      center: unknown;
      onCenterChange: (center: { lat: number; lon: number }) => Promise<void>;
    };
    expect(mapProps.center).toEqual({ lat: 41.98, lon: 2.82 });

    await mapProps.onCenterChange({ lat: 42.1, lon: 1.85 });
    await fireEvent.press(screen.getByRole('button', { name: 'Tria aquesta zona' }));
    expect(await screen.findByLabelText('Berga, Canvia')).toBeOnTheScreen();
  });

  it('«Crea l’alerta» desa i torna a la llista; «Enrere» hi torna sense desar', async () => {
    mockedCreate.mockResolvedValue({} as never);
    await renderScreen();
    await ready();

    await fireEvent.press(screen.getByRole('button', { name: 'Enrere' }));
    expect(back).toHaveBeenCalledTimes(1);
    expect(mockedCreate).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('button', { name: "Crea l'alerta" }));
    expect(mockedCreate.mock.calls[0]?.[0]).toMatchObject({
      objectiu: 'cel_estrellat',
      distanciaMaxKm: 115,
      indexMinim: 75,
      avisaEnArribar: false,
      horaAvis: 18,
    });
    await screen.findByRole('button', { name: "Crea l'alerta" });
    expect(back).toHaveBeenCalledTimes(2);
  });

  it('sense ubicació, el botó està desactivat i la fila demana el permís', async () => {
    jest.mocked(getCurrentPlace).mockResolvedValue({ status: 'denied', canAskAgain: true });
    await renderScreen();
    expect(await screen.findByLabelText('Activa la ubicació, Permet-ho')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: "Crea l'alerta" })).toBeDisabled();
  });

  it('si l’API diu que ja té el màxim d’alertes, ho mostra com a avís', async () => {
    mockedCreate.mockRejectedValue(new ApiError(409, 'alert_limit_reached', 'Massa alertes'));
    await renderScreen();
    await ready();
    await fireEvent.press(screen.getByRole('button', { name: "Crea l'alerta" }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Ja tens el màxim d'alertes. Esborra'n alguna per crear-ne una de nova.",
    );
    expect(back).not.toHaveBeenCalled();
  });
});
