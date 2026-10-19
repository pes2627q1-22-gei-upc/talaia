import { render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import i18n from '@/core/i18n';

import { AlertsScreen } from '../AlertsScreen';

describe('AlertsScreen', () => {
  it('diu que les alertes arriben aviat', async () => {
    await i18n.changeLanguage('ca');
    await render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 393, height: 852 },
          insets: { top: 59, left: 0, right: 0, bottom: 34 },
        }}
      >
        <AlertsScreen />
      </SafeAreaProvider>,
    );
    expect(screen.getByRole('header', { name: 'Alertes' })).toBeOnTheScreen();
    expect(screen.getByText('Aviat')).toBeOnTheScreen();
  });
});
