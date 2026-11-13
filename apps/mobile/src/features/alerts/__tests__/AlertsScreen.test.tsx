import { fireEvent, render, screen } from '@testing-library/react-native';
import { Linking } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import i18n from '@/core/i18n';

import { usePushPermission } from '@/features/notifications/PushRegistrationProvider';

import { AlertsScreen } from '../AlertsScreen';

jest.mock('@/features/notifications/PushRegistrationProvider', () => ({
  usePushPermission: jest.fn(),
}));

const renderScreen = () =>
  render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 393, height: 852 },
        insets: { top: 59, left: 0, right: 0, bottom: 34 },
      }}
    >
      <AlertsScreen />
    </SafeAreaProvider>,
  );

type Permission = ReturnType<typeof usePushPermission>['permission'];

const withPermission = (permission: Permission) =>
  jest.mocked(usePushPermission).mockReturnValue({
    permission,
    registered: permission === 'granted',
    requestPermission: jest.fn(),
  });

describe('AlertsScreen', () => {
  it('diu que les alertes arriben aviat', async () => {
    await i18n.changeLanguage('ca');
    withPermission('granted');
    await renderScreen();
    expect(screen.getByRole('header', { name: 'Alertes' })).toBeOnTheScreen();
    expect(screen.getByText('Aviat')).toBeOnTheScreen();
    expect(screen.queryByText(/notificacions estan desactivades/)).toBeNull();
  });

  it('sense permís de notificacions, ho indica i continua funcionant (HU17)', async () => {
    await i18n.changeLanguage('ca');
    withPermission('denied');
    await renderScreen();
    expect(screen.getByText(/notificacions estan desactivades/)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Obre la configuració' })).toBeOnTheScreen();
    expect(screen.getByText('Aviat')).toBeOnTheScreen();
  });

  it("el botó de l'avís obre la configuració del sistema", async () => {
    await i18n.changeLanguage('ca');
    withPermission('denied');
    const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue();
    await renderScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Obre la configuració' }));
    expect(openSettings).toHaveBeenCalledTimes(1);
    openSettings.mockRestore();
  });

  it('a Expo Go o al simulador diu que no hi ha notificacions, sense botó', async () => {
    await i18n.changeLanguage('ca');
    withPermission('unavailable');
    await renderScreen();
    expect(screen.getByText(/no pot rebre notificacions/)).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Obre la configuració' })).toBeNull();
    expect(screen.getByText('Aviat')).toBeOnTheScreen();
  });

  it.each([['undetermined' as const], [null]])(
    'amb el permís %s no mostra cap avís',
    async (permission) => {
      await i18n.changeLanguage('ca');
      withPermission(permission);
      await renderScreen();
      expect(screen.queryByText(/notificacions estan desactivades/)).toBeNull();
      expect(screen.queryByText(/no pot rebre notificacions/)).toBeNull();
      expect(screen.getByText('Aviat')).toBeOnTheScreen();
    },
  );
});
