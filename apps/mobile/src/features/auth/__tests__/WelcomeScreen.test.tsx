import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import { Platform } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import i18n from '@/core/i18n';
import { motion } from '@/core/theme/tokens';

import { TL } from '../intro/timeline';
import { INTRO_LEAD, INTRO_SEEN_KEY, SKIP_DURATION } from '../intro/useIntro';
import { signInAndEnsureProfile } from '../signIn';
import { WelcomeScreen } from '../WelcomeScreen';

jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
  useLocalSearchParams: jest.fn(() => ({})),
}));
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
jest.mock('../signIn', () => ({ signInAndEnsureProfile: jest.fn() }));
jest.mock('../authRepository', () => ({
  authRepository: {
    signInWithGoogle: jest.fn(),
    signInWithApple: jest.fn(),
  },
}));
const replace = jest.fn();
const push = jest.fn();
jest
  .mocked(useRouter)
  .mockReturnValue({ replace, push } as unknown as ReturnType<typeof useRouter>);

const METRICS = {
  frame: { x: 0, y: 0, width: 393, height: 852 },
  insets: { top: 59, left: 0, right: 0, bottom: 34 },
};

async function renderWelcome() {
  await render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <WelcomeScreen />
    </SafeAreaProvider>,
  );
}

/** El contingut es mesura i la intro sap quin mode toca: llavors es pinten el cel i la torre. */
async function layOut() {
  await fireEvent(screen.getByTestId('welcome-content'), 'layout', {
    nativeEvent: { layout: { x: 0, y: 392, width: 393, height: 460 } },
  });
  await act(async () => {});
}

describe('WelcomeScreen', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.mocked(signInAndEnsureProfile).mockResolvedValue({ ok: true });
    await AsyncStorage.clear();
    await i18n.changeLanguage('ca');
  });

  it('mostra el logotip, els textos i les tres opcions a iOS', async () => {
    await renderWelcome();
    expect(screen.getByRole('header', { name: 'Talaia' })).toBeOnTheScreen();
    expect(screen.getByText('On i quan mirar el cel.')).toBeOnTheScreen();
    for (const label of ['Continua amb Google', 'Continua amb Apple', 'Continua amb el correu']) {
      expect(await screen.findByRole('button', { name: label })).toBeOnTheScreen();
    }
  });

  it('a Android no ofereix Apple (ADR-0016)', async () => {
    const restore = jest.replaceProperty(Platform, 'OS', 'android');
    await renderWelcome();
    expect(screen.queryByRole('button', { name: 'Continua amb Apple' })).toBeNull();
    restore.restore();
  });

  it("en entrar amb Google fa la sortida i després entra a l'app, només un cop", async () => {
    jest.useFakeTimers();
    await renderWelcome();
    await layOut();

    await fireEvent.press(screen.getByRole('button', { name: 'Continua amb Google' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Continua amb Apple' }));
    expect(replace).not.toHaveBeenCalled();

    await act(() => jest.advanceTimersByTime(motion.leave));
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith('/');
    jest.useRealTimers();
  });

  it('si falla, no surt de la benvinguda i diu per què', async () => {
    jest.mocked(signInAndEnsureProfile).mockResolvedValue({ ok: false, reason: 'network' });
    await renderWelcome();
    await layOut();
    await fireEvent.press(screen.getByRole('button', { name: 'Continua amb Google' }));
    expect(screen.getByRole('alert')).toHaveTextContent(
      'No hi ha connexió. Revisa-la i torna-ho a provar.',
    );
    expect(replace).not.toHaveBeenCalled();
  });

  it('el correu obre la seva pantalla sense fer la sortida', async () => {
    await renderWelcome();
    await fireEvent.press(screen.getByRole('button', { name: 'Continua amb el correu' }));
    expect(push).toHaveBeenCalledWith('/benvinguda-correu');
  });

  it('pinta el cel i la torre un cop sap quant ocupa el contingut', async () => {
    await renderWelcome();
    expect(
      screen.queryByTestId('welcome-illustration', { includeHiddenElements: true }),
    ).toBeNull();
    expect(screen.queryByTestId('welcome-sky')).toBeNull();

    await layOut();

    expect(
      screen.getByTestId('welcome-illustration', { includeHiddenElements: true }),
    ).toBeOnTheScreen();
    expect(screen.getByTestId('welcome-sky')).toBeOnTheScreen();
  });

  it('tocar el cel salta la intro; quan ja ha acabat, en fa sortir un estel fugaç', async () => {
    jest.useFakeTimers();
    await renderWelcome();
    await layOut();
    const touch = { nativeEvent: { locationX: 120, locationY: 90 } };

    await fireEvent.press(screen.getByTestId('welcome-sky'), touch);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(INTRO_SEEN_KEY, '1');

    await act(() => jest.advanceTimersByTime(INTRO_LEAD + SKIP_DURATION + TL.end));
    jest.mocked(AsyncStorage.setItem).mockClear();
    await fireEvent.press(screen.getByTestId('welcome-sky'), touch);
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  it('amb «reduir moviment», tot és quiet i la sortida és més curta', async () => {
    jest.useFakeTimers();
    jest.mocked(useReducedMotion).mockReturnValue(true);
    await renderWelcome();
    await layOut();
    expect(
      screen.getByTestId('welcome-illustration', { includeHiddenElements: true }),
    ).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('welcome-sky'), {
      nativeEvent: { locationX: 120, locationY: 90 },
    });
    await fireEvent.press(screen.getByRole('button', { name: 'Continua amb Google' }));
    await act(() => jest.advanceTimersByTime(motion.fast));
    expect(replace).toHaveBeenCalledWith('/');

    jest.mocked(useReducedMotion).mockReturnValue(false);
    jest.useRealTimers();
  });
});
