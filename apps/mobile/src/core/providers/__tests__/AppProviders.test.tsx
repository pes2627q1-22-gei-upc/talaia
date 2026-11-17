import { act, render, screen } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { Text } from 'react-native';

import { AppProviders } from '../AppProviders';

let mockLanguageRestored: () => void;
jest.mock('@/core/i18n', () => ({
  languageReady: new Promise<void>((resolve) => {
    mockLanguageRestored = resolve;
  }),
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
