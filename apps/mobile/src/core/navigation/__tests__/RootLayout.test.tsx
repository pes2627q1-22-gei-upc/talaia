import { render } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { Platform } from 'react-native';

import RootLayout from '@/app/_layout';
import '@/core/i18n';

let mockExpoGo = false;
const mockStack = jest.fn();
const mockStatusBar = jest.fn();

jest.mock('expo', () => ({ isRunningInExpoGo: () => mockExpoGo }));
jest.mock('expo-font', () => ({ useFonts: () => [true, null] }));
jest.mock('@expo-google-fonts/atkinson-hyperlegible-next', () => ({}));
jest.mock('@expo-google-fonts/big-shoulders-display', () => ({}));
jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn().mockResolvedValue(undefined),
  hideAsync: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('expo-status-bar', () => ({
  StatusBar: (props: unknown) => {
    mockStatusBar(props);
    return null;
  },
}));
jest.mock('expo-router', () => ({
  DarkTheme: { dark: true, colors: {} },
  ThemeProvider: ({ children }: PropsWithChildren) => children,
  Stack: Object.assign(
    (props: unknown) => {
      mockStack(props);
      return null;
    },
    { Screen: () => null },
  ),
}));
jest.mock('expo-brightness', () => ({
  getBrightnessAsync: jest.fn().mockResolvedValue(0.5),
  setBrightnessAsync: jest.fn().mockResolvedValue(undefined),
  isUsingSystemBrightnessAsync: jest.fn().mockResolvedValue(true),
  restoreSystemBrightnessAsync: jest.fn().mockResolvedValue(undefined),
}));
// El mode nit, com quan l'activi la TG-240.
jest.mock('@/core/providers/AppProviders', () => {
  const { ThemeProvider } = jest.requireActual('@/core/theme/theme');
  return {
    AppProviders: ({ children }: PropsWithChildren) => (
      <ThemeProvider name="vermell">{children}</ThemeProvider>
    ),
  };
});
jest.mock('@/features/auth/EmailLoginCloseButton', () => ({ EmailLoginCloseButton: () => null }));

describe('RootLayout en mode nit', () => {
  const os = Platform.OS;
  beforeEach(() => {
    mockStack.mockClear();
    mockStatusBar.mockClear();
  });
  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: os });
  });

  it('a una build d’iOS, la barra la porta el Stack i no es pinta <StatusBar>', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
    mockExpoGo = false;
    await render(<RootLayout />);
    expect(mockStack).toHaveBeenLastCalledWith(
      expect.objectContaining({
        screenOptions: expect.objectContaining({ statusBarStyle: 'light', statusBarHidden: true }),
      }),
    );
    expect(mockStatusBar).not.toHaveBeenCalled();
  });

  it('a Expo Go, el Stack no en diu res i <StatusBar> l’amaga', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
    mockExpoGo = true;
    await render(<RootLayout />);
    expect(mockStack.mock.lastCall?.[0].screenOptions).not.toHaveProperty('statusBarHidden');
    expect(mockStatusBar).toHaveBeenLastCalledWith(
      expect.objectContaining({ style: 'light', hidden: true }),
    );
  });
});
