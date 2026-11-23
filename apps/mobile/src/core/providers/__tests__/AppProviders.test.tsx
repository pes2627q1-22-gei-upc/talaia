import { act, render, screen } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { Text } from 'react-native';

import { AppProviders } from '../AppProviders';

let mockLanguageRestored: () => void;
let mockLanguageRejected: (reason: Error) => void;
let mockLanguageReady: Promise<void>;
jest.mock('@/core/i18n', () => ({
  get languageReady() {
    return mockLanguageReady;
  },
}));
jest.mock('@/core/api/queryClient', () => {
  const { QueryClient } = jest.requireActual('@tanstack/react-query');
  return { queryClient: new QueryClient() };
});
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }: PropsWithChildren) => children,
}));
jest.mock('@/features/auth/AuthProvider', () => ({
  AuthProvider: ({ children }: PropsWithChildren) => children,
}));
// El registre de notificacions necessita la sessió real: aquí només es prova l'espera de l'idioma.
jest.mock('@/features/notifications/PushRegistrationProvider', () => ({
  PushRegistrationProvider: ({ children }: PropsWithChildren) => children,
}));

beforeEach(() => {
  mockLanguageReady = new Promise<void>((resolve, reject) => {
    mockLanguageRestored = resolve;
    mockLanguageRejected = reject;
  });
});

it('espera la preferència d’idioma abans de muntar les pantalles que fan consultes', async () => {
  await render(
    <AppProviders>
      <Text>Pantalla</Text>
    </AppProviders>,
  );
  expect(screen.queryByText('Pantalla')).toBeNull();
  await act(async () => {
    mockLanguageRestored();
  });
  expect(screen.getByText('Pantalla')).toBeOnTheScreen();
});

it('munta les pantalles encara que falli la inicialització de l’idioma', async () => {
  await render(
    <AppProviders>
      <Text>Pantalla</Text>
    </AppProviders>,
  );
  expect(screen.queryByText('Pantalla')).toBeNull();
  await act(async () => {
    mockLanguageRejected(new Error('No s’ha pogut inicialitzar l’idioma'));
  });
  expect(screen.getByText('Pantalla')).toBeOnTheScreen();
});
