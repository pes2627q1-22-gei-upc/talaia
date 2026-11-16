import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import type { PropsWithChildren } from 'react';
import { Linking } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import i18n from '@/core/i18n';
import { motion } from '@/core/theme/tokens';
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
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });
  beforeEach(async () => {
    push.mockReset();
    jest.mocked(getCurrentPlace).mockReset();
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

  it('el títol queda dins de l’àrea segura de dalt (Android)', async () => {
    await renderScreen();
    const safeArea = screen.getByTestId('explore-safe-area');
    expect(safeArea.props.edges).toMatchObject({ top: 'additive', bottom: 'off' });
    expect(within(safeArea).getByRole('header', { name: 'Què vols veure?' })).toBeOnTheScreen();
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

  it('no deixa cercar mentre localitza, però permet explorar el mapa', async () => {
    jest.mocked(getCurrentPlace).mockReturnValue(new Promise(() => undefined));
    await renderScreen();
    expect(screen.getByLabelText('Buscant on ets…')).toHaveProp('accessibilityState', {
      busy: true,
    });
    const search = screen.getByRole('button', { name: 'Troba el millor lloc' });
    expect(search).toBeDisabled();
    await fireEvent.press(search);
    expect(push).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Mostra el mapa' })).toBeEnabled();
  });

  it.each(['denied', 'error'] as const)(
    'recupera la ubicació des de la fila en estat %s',
    async (state) => {
      const place = jest.mocked(getCurrentPlace);
      if (state === 'denied') place.mockResolvedValueOnce({ status: 'denied', canAskAgain: true });
      else place.mockRejectedValueOnce(new Error('GPS'));
      const label =
        state === 'denied'
          ? 'Activa la ubicació, Permet-ho'
          : 'No hem trobat on ets, Torna-ho a provar';
      await renderScreen();
      const retry = await screen.findByRole('button', { name: label });
      expect(screen.getByRole('button', { name: 'Troba el millor lloc' })).toBeDisabled();
      await fireEvent.press(retry);
      expect(await screen.findByLabelText('Girona, Ubicació actual')).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: 'Troba el millor lloc' })).toBeEnabled();
      expect(place).toHaveBeenCalledTimes(2);
    },
  );

  it('obre la configuració quan no es pot tornar a demanar permís', async () => {
    const settings = jest.spyOn(Linking, 'openSettings').mockResolvedValue();
    jest.mocked(getCurrentPlace).mockResolvedValue({ status: 'denied', canAskAgain: false });
    await renderScreen();
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Activa la ubicació, Configuració' }),
    );
    expect(settings).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Troba el millor lloc' })).toBeDisabled();
  });

  it('canvia de nit amb els segments i envia la data triada a la cerca', async () => {
    await renderScreen();
    await screen.findByLabelText('Girona, Ubicació actual');
    await fireEvent.press(screen.getByRole('tab', { name: 'Demà' }));
    expect(screen.getByRole('tab', { name: 'Demà' })).toBeSelected();
    await fireEvent.press(screen.getByRole('button', { name: 'Troba el millor lloc' }));
    expect(push).toHaveBeenLastCalledWith(
      expect.objectContaining({
        params: expect.objectContaining({ data: addDays(nightOf(new Date()), 1) }),
      }),
    );
    await fireEvent.press(screen.getByRole('tab', { name: 'Aquesta nit' }));
    expect(screen.getByRole('tab', { name: 'Aquesta nit' })).toBeSelected();
    await fireEvent.press(screen.getByRole('button', { name: 'Troba el millor lloc' }));
    expect(push).toHaveBeenLastCalledWith(
      expect.objectContaining({
        params: expect.objectContaining({ data: nightOf(new Date()) }),
      }),
    );
  });

  it('cancel·la el calendari sense canviar la nit i reobre un dia personalitzat', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-15T12:00:00Z'));
    await renderScreen();
    await fireEvent.press(screen.getByRole('tab', { name: 'Demà' }));
    await fireEvent.press(screen.getByRole('tab', { name: 'Tria el dia' }));
    await fireEvent.press(
      screen.getByRole('button', { name: 'Tanca', includeHiddenElements: true }),
    );
    await act(() => jest.advanceTimersByTime(motion.base + 100));
    expect(screen.queryByRole('header', { name: 'Tria el dia' })).toBeNull();
    expect(screen.getByRole('tab', { name: 'Demà' })).toBeSelected();
    await fireEvent.press(screen.getByRole('tab', { name: 'Tria el dia' }));
    await fireEvent.press(screen.getByRole('button', { name: "18 d'octubre" }));
    await act(() => jest.advanceTimersByTime(motion.base + 100));
    const picked = screen.getByRole('tab', { name: 'dg. 18 oct.' });
    expect(picked).toBeSelected();
    await fireEvent.press(picked);
    expect(screen.getByRole('header', { name: 'Tria el dia' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: "18 d'octubre" })).toBeSelected();
  });

  it('ajusta l’hora final, tanca amb Fet i conserva la franja en reobrir', async () => {
    jest.useFakeTimers();
    await renderScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'De 22:00 a 06:00, Franja horària' }));
    await fireEvent(screen.getByRole('adjustable', { name: 'Fins a' }), 'accessibilityAction', {
      nativeEvent: { actionName: 'increment' },
    });
    expect(screen.getByText("9 hores d'observació")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Fet' }));
    await act(() => jest.advanceTimersByTime(motion.base + 100));
    expect(screen.queryByRole('header', { name: 'Franja horària' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'De 22:00 a 07:00, Franja horària' }));
    expect(screen.getByRole('adjustable', { name: 'Fins a' })).toHaveAccessibilityValue({
      text: '07:00',
    });
  });
});
