import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import { Platform } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import i18n from '@/core/i18n';
import { motion } from '@/core/theme/tokens';

import { WelcomeScreen } from '../WelcomeScreen';

jest.mock('expo-router', () => ({ useRouter: jest.fn() }));
// Tota la resta de Reanimated és la real; només es pot activar «reduir moviment».
jest.mock('react-native-reanimated', () => {
  const actual = jest.requireActual('react-native-reanimated');
  return {
    __esModule: true,
    ...actual,
    default: actual.default,
    useReducedMotion: jest.fn(() => false),
  };
});
const replace = jest.fn();
jest.mocked(useRouter).mockReturnValue({ replace } as unknown as ReturnType<typeof useRouter>);

const METRICS = {
  frame: { x: 0, y: 0, width: 393, height: 852 },
  insets: { top: 59, left: 0, right: 0, bottom: 34 },
};

function renderWelcome() {
  return render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <WelcomeScreen />
    </SafeAreaProvider>,
  );
}

describe('WelcomeScreen', () => {
  beforeEach(async () => {
    replace.mockReset();
    await i18n.changeLanguage('ca');
  });

  it('mostra el logotip, els textos i les tres opcions a iOS', async () => {
    await renderWelcome();
    expect(screen.getByRole('header', { name: 'Talaia' })).toBeOnTheScreen();
    expect(screen.getByText('On i quan mirar el cel.')).toBeOnTheScreen();
    for (const label of ['Continua amb Google', 'Continua amb Apple', 'Continua amb el correu']) {
      expect(screen.getByRole('button', { name: label })).toBeOnTheScreen();
    }
  });

  it('a Android no ofereix Apple (ADR-0016)', async () => {
    const restore = jest.replaceProperty(Platform, 'OS', 'android');
    await renderWelcome();
    expect(screen.queryByRole('button', { name: 'Continua amb Apple' })).toBeNull();
    restore.restore();
  });

  it("prémer una opció fa la sortida i després entra a l'app, només un cop", async () => {
    jest.useFakeTimers();
    await renderWelcome();
    const email = screen.getByRole('button', { name: 'Continua amb el correu' });

    await fireEvent.press(email);
    await fireEvent.press(screen.getByRole('button', { name: 'Continua amb Google' }));
    expect(replace).not.toHaveBeenCalled();

    await act(() => jest.advanceTimersByTime(motion.leave));
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith('/');
    jest.useRealTimers();
  });

  it('pinta la il·lustració un cop sap quant ocupa el contingut', async () => {
    await renderWelcome();
    expect(
      screen.queryByTestId('welcome-illustration', { includeHiddenElements: true }),
    ).toBeNull();

    await fireEvent(screen.getByTestId('welcome-content'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 392, width: 393, height: 460 } },
    });

    expect(
      screen.getByTestId('welcome-illustration', { includeHiddenElements: true }),
    ).toBeOnTheScreen();
  });

  it('amb «reduir moviment», tot és quiet i la sortida és més curta', async () => {
    jest.useFakeTimers();
    jest.mocked(useReducedMotion).mockReturnValue(true);
    await renderWelcome();
    await fireEvent(screen.getByTestId('welcome-content'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 392, width: 393, height: 460 } },
    });
    expect(
      screen.getByTestId('welcome-illustration', { includeHiddenElements: true }),
    ).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Continua amb Google' }));
    await act(() => jest.advanceTimersByTime(motion.fast));
    expect(replace).toHaveBeenCalledWith('/');

    jest.mocked(useReducedMotion).mockReturnValue(false);
    jest.useRealTimers();
  });
});
