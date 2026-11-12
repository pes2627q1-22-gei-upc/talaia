import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import type { PropsWithChildren } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ApiError } from '@/core/api/httpClient';
import i18n from '@/core/i18n';
import { getCurrentPlace } from '@/features/explore/locationRepository';
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

// Pantalla sencera: en paral·lel amb la resta, l'entorn de Skia endarrereix el primer render.
jest.setTimeout(15_000);

describe('NewAlertScreen', () => {
  beforeEach(async () => {
    back.mockReset();
    mockedCreate.mockReset();
    jest
      .mocked(getCurrentPlace)
      .mockResolvedValue({ status: 'ready', place: { name: 'Girona', lat: 41.98, lon: 2.82 } });
    await i18n.changeLanguage('ca');
  });

  it('mostra el títol, el fenomen, l’origen, la distància, l’índex i el botó', async () => {
    await renderScreen();
    expect(screen.getByRole('header', { name: 'Nova alerta' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Enrere' })).toBeOnTheScreen();
    expect(screen.getByText('Què vols veure')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Cel estrellat' })).toBeSelected();
    expect(screen.getByRole('button', { name: 'Posta de sol. Aviat' })).toBeDisabled();
    expect(await screen.findByLabelText('Girona, Ubicació actual')).toBeOnTheScreen();
    expect(screen.getByRole('adjustable', { name: 'Fins a quina distància' })).toBeOnTheScreen();
    expect(screen.getByText('50 km')).toBeOnTheScreen();
    expect(screen.getByRole('adjustable', { name: 'Índex mínim' })).toBeOnTheScreen();
    expect(screen.getByText('70 o més')).toBeOnTheScreen();
    expect(screen.getByText("T'avisarem quan algun punt hi arribi.")).toBeOnTheScreen();
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
    for (const text of ['Nueva alerta', 'Hasta qué distancia', 'Índice mínimo']) {
      expect(StyleSheet.flatten(screen.getByText(text).props.style)).toMatchObject({
        flexShrink: 1,
      });
    }
  });

  it('el fenomen, la distància i l’índex reflecteixen la selecció', async () => {
    await renderScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Via Làctia' }));
    expect(screen.getByRole('button', { name: 'Via Làctia' })).toBeSelected();
    expect(screen.getByRole('button', { name: 'Cel estrellat' })).not.toBeSelected();

    await fireEvent(
      screen.getByRole('adjustable', { name: 'Fins a quina distància' }),
      'accessibilityAction',
      increment,
    );
    expect(screen.getByText('55 km')).toBeOnTheScreen();
    await fireEvent(
      screen.getByRole('adjustable', { name: 'Índex mínim' }),
      'accessibilityAction',
      increment,
    );
    expect(screen.getByText('75 o més')).toBeOnTheScreen();
  });

  it('«Crea l’alerta» desa i torna a la llista; «Enrere» hi torna sense desar', async () => {
    mockedCreate.mockResolvedValue({} as never);
    await renderScreen();
    await screen.findByLabelText('Girona, Ubicació actual');

    await fireEvent.press(screen.getByRole('button', { name: 'Enrere' }));
    expect(back).toHaveBeenCalledTimes(1);
    expect(mockedCreate).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('button', { name: "Crea l'alerta" }));
    expect(mockedCreate.mock.calls[0]?.[0]).toMatchObject({
      objectiu: 'cel_estrellat',
      distanciaMaxKm: 50,
      indexMinim: 70,
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
    await screen.findByLabelText('Girona, Ubicació actual');
    await fireEvent.press(screen.getByRole('button', { name: "Crea l'alerta" }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Ja tens el màxim d'alertes. Esborra'n alguna per crear-ne una de nova.",
    );
    expect(back).not.toHaveBeenCalled();
  });
});
