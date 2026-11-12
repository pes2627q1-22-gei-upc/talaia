import { fireEvent, render, screen } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import i18n from '@/core/i18n';

import { AlertsScreen } from '../AlertsScreen';

jest.mock('expo-router', () => ({ useRouter: jest.fn() }));

const push = jest.fn();
jest.mocked(useRouter).mockReturnValue({ push } as unknown as ReturnType<typeof useRouter>);

describe('AlertsScreen', () => {
  it('diu que la llista arriba aviat i obre «Nova alerta»', async () => {
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

    await fireEvent.press(screen.getByRole('button', { name: 'Nova alerta' }));
    expect(push).toHaveBeenCalledWith('/nova-alerta');
  });
});
