import { render, screen } from '@testing-library/react-native';
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

const withPermission = (permission: 'granted' | 'denied') =>
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
});
