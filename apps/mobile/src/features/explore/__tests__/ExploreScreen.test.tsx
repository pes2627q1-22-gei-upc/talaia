import { fireEvent, render, screen } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import type { PropsWithChildren } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import i18n from '@/core/i18n';
import { createQueryWrapper } from '@/test-utils/queryWrapper';

import { ExploreScreen } from '../ExploreScreen';
import { getCurrentPlace } from '../locationRepository';

jest.mock('expo-router', () => ({ useRouter: jest.fn() }));
jest.mock('../locationRepository', () => ({ getCurrentPlace: jest.fn() }));

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
      <SafeAreaProvider initialMetrics={METRICS}>
        <QueryWrapper>{children}</QueryWrapper>
      </SafeAreaProvider>
    );
  }
  return render(<ExploreScreen />, { wrapper: Wrapper });
}

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
      screen.getByRole('button', { name: 'Constel·lacions. Amb el mite que hi ha al darrere' }),
    ).toBeOnTheScreen();
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

  it('«Tria el dia» mostra les nits que es poden triar', async () => {
    await renderScreen();
    await fireEvent.press(screen.getByRole('tab', { name: 'Tria el dia' }));
    expect(screen.getAllByText(/^(dg|dl|dt|dc|dj|dv|ds)\. \d{1,2}$/)).toHaveLength(14);
  });

  it('la franja horària s’obre en un full i es canvia d’hora en hora', async () => {
    await renderScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'De 22:00 a 06:00, Franja horària' }));
    expect(screen.getByRole('header', { name: 'Franja horària' })).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Des de: una hora abans' }));
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
});
