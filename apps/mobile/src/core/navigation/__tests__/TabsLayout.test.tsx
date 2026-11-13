import { render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import TabsLayout from '@/app/(tabs)/_layout';
import i18n from '@/core/i18n';
import { useSessionGate } from '@/features/auth/useSessionGate';

jest.mock('@/features/auth/useSessionGate', () => ({ useSessionGate: jest.fn() }));
// Les pantalles d’error tenen tests propis; aquí es prova quina munta el layout.
jest.mock('@/features/auth/RestoreErrorScreen', () => ({
  RestoreErrorScreen: () => {
    const { Text } = jest.requireActual('react-native');
    return <Text>Error de restauració</Text>;
  },
}));
jest.mock('@/features/auth/AccountBlockedScreen', () => ({
  AccountBlockedScreen: () => {
    const { Text } = jest.requireActual('react-native');
    return <Text>Compte bloquejat</Text>;
  },
}));
jest.mock('expo-router', () => ({
  Redirect: ({ href }: { href: string }) => {
    const { Text } = jest.requireActual('react-native');
    return <Text>{`Redirecció: ${href}`}</Text>;
  },
}));
jest.mock('expo-router/native-tabs', () => {
  const { View, Text } = jest.requireActual('react-native');
  const NativeTabs = Object.assign(
    ({ children }: { children: ReactNode }) => <View>{children}</View>,
    {
      Trigger: Object.assign(({ children }: { children: ReactNode }) => <View>{children}</View>, {
        Label: Text,
        Icon: () => null,
      }),
    },
  );
  return { NativeTabs };
});

beforeEach(async () => {
  await i18n.changeLanguage('ca');
});

it.each([
  ['restoreFailed', 'Error de restauració'],
  ['blocked', 'Compte bloquejat'],
  ['signedOut', 'Redirecció: /benvinguda'],
] as const)(
  'en estat %s mostra la sortida corresponent sense les pestanyes',
  async (gate, label) => {
    jest.mocked(useSessionGate).mockReturnValue(gate);
    await render(<TabsLayout />);
    expect(screen.getByText(label)).toBeOnTheScreen();
    expect(screen.queryByText(i18n.t('tabs.explore'))).toBeNull();
  },
);

it('no mostra contingut privat mentre restaura la sessió', async () => {
  jest.mocked(useSessionGate).mockReturnValue('restoring');
  await render(<TabsLayout />);
  expect(screen.queryByText(i18n.t('tabs.explore'))).toBeNull();
  expect(screen.queryByText('Compte bloquejat')).toBeNull();
  expect(screen.queryByText('Redirecció: /benvinguda')).toBeNull();
});

it('amb sessió vàlida mostra les quatre pestanyes traduïdes', async () => {
  jest.mocked(useSessionGate).mockReturnValue('signedIn');
  await render(<TabsLayout />);
  for (const key of ['tabs.explore', 'tabs.calendar', 'tabs.alerts', 'tabs.profile'] as const) {
    expect(screen.getByText(i18n.t(key))).toBeOnTheScreen();
  }
});
