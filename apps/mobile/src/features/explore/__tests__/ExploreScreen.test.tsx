import { fireEvent, render, screen } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import type { PropsWithChildren } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import i18n from '@/core/i18n';
import { createQueryWrapper } from '@/test-utils/queryWrapper';

import { addDays, nightOf } from '../exploreModel';
import { ExploreScreen } from '../ExploreScreen';
import { getCurrentPlace } from '../locationRepository';

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
  return render(<ExploreScreen />, { wrapper: Wrapper });
}

// Pantalla sencera: en paral·lel amb la resta, l'entorn de Skia endarrereix el primer render.
jest.setTimeout(15_000);

describe('ExploreScreen', () => {
  beforeEach(async () => {
    push.mockReset();
    jest
      .mocked(getCurrentPlace)
      .mockResolvedValue({ status: 'ready', place: { name: 'Girona', lat: 41.98, lon: 2.82 } });
    await i18n.changeLanguage('ca');
  });

  it('mostra el títol, els fenòmens, l’origen, el quan i la distància', async () => {
    await renderScreen();
    expect(screen.getByRole('header', { name: 'Què vols veure?' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Cel estrellat' })).toBeSelected();
    expect(
      screen.getByRole('button', {
        name: 'Constel·lacions. Amb el mite que hi ha al darrere. Aviat',
      }),
    ).toBeDisabled();
    expect(await screen.findByLabelText('Girona, Ubicació actual')).toBeOnTheScreen();
    expect(screen.getByRole('tab', { name: 'Aquesta nit' })).toBeSelected();
    expect(screen.getByText('2 h 30 min en cotxe')).toBeOnTheScreen();
  });

  it('en triar un fenomen, queda marcat', async () => {
    await renderScreen();
    await fireEvent.press(screen.getByRole('button', { name: "Pluja d'estels" }));
    expect(screen.getByRole('button', { name: "Pluja d'estels" })).toBeSelected();
    expect(screen.getByRole('button', { name: 'Cel estrellat' })).not.toBeSelected();
  });

  it('un fenomen «Aviat» no es pot triar', async () => {
    await renderScreen();
    await screen.findByLabelText('Girona, Ubicació actual');
    const posta = screen.getByRole('button', { name: 'Posta de sol. Aviat' });
    expect(posta).toBeDisabled();
    await fireEvent.press(posta);
    expect(screen.getByRole('button', { name: 'Cel estrellat' })).toBeSelected();
  });

  it('«Tria el dia» obre el calendari; en triar un dia, el segment el mostra', async () => {
    await renderScreen();
    await fireEvent.press(screen.getByRole('tab', { name: 'Tria el dia' }));
    expect(screen.getByRole('header', { name: 'Tria el dia' })).toBeOnTheScreen();

    // D'aquí a tres nits (si és el mes que ve, primer s'hi passa).
    const tonight = nightOf(new Date());
    const target = addDays(tonight, 3);
    const monthsOf = i18n.t('explore.calendar.monthsOf', { returnObjects: true }) as string[];
    const label = i18n.t('explore.calendar.day', {
      day: Number(target.slice(8, 10)),
      month: monthsOf[Number(target.slice(5, 7)) - 1],
    });
    if (target.slice(0, 7) !== tonight.slice(0, 7)) {
      await fireEvent.press(screen.getByRole('button', { name: 'Mes següent' }));
    }
    await fireEvent.press(screen.getByRole('button', { name: label }));

    // El full es tanca amb la seva animació de sortida (ho prova el ViewModel); el segment ja ho diu.
    expect(
      screen.getByRole('tab', { name: /^(dg|dl|dt|dc|dj|dv|ds)\. \d{1,2} \S+$/ }),
    ).toBeSelected();
  });

  it('la franja horària s’obre en un full amb dues rodes', async () => {
    await renderScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'De 22:00 a 06:00, Franja horària' }));
    expect(screen.getByRole('header', { name: 'Franja horària' })).toBeOnTheScreen();

    await fireEvent(screen.getByRole('adjustable', { name: 'Des de' }), 'accessibilityAction', {
      nativeEvent: { actionName: 'decrement' },
    });
    expect(screen.getByText('De 21:00 a 06:00')).toBeOnTheScreen();
    expect(screen.getByText("9 hores d'observació")).toBeOnTheScreen();
  });

  it('la distància es pot ajustar amb el lector de pantalla', async () => {
    await renderScreen();
    await fireEvent(
      screen.getByRole('adjustable', { name: 'Fins a quina distància' }),
      'accessibilityAction',
      {
        nativeEvent: { actionName: 'increment' },
      },
    );
    expect(screen.getByText('2 h 45 min en cotxe')).toBeOnTheScreen();
  });

  it('«Troba el millor lloc» obre les recomanacions', async () => {
    await renderScreen();
    await screen.findByLabelText('Girona, Ubicació actual');
    await fireEvent.press(screen.getByRole('button', { name: 'Troba el millor lloc' }));
    expect(push).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/recomanacions',
        params: expect.objectContaining({ objectiu: 'cel_estrellat', lat: '41.98' }),
      }),
    );
  });

  it('«Mostra el mapa» obre el mapa sense cercar, també sense ubicació', async () => {
    jest.mocked(getCurrentPlace).mockResolvedValue({ status: 'denied', canAskAgain: true });
    await renderScreen();
    await screen.findByText('Activa la ubicació');
    await fireEvent.press(screen.getByRole('button', { name: 'Mostra el mapa' }));
    expect(push).toHaveBeenCalledWith('/recomanacions');
  });
});
