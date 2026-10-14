import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Screen } from '../Screen';

const METRICS = {
  frame: { x: 0, y: 0, width: 393, height: 852 },
  insets: { top: 59, left: 0, right: 0, bottom: 34 },
};

describe('Screen', () => {
  it('pinta el títol com a capçalera, el subtítol i el contingut', async () => {
    await render(
      <SafeAreaProvider initialMetrics={METRICS}>
        <Screen title="Calendari" subtitle="Fenòmens del mes">
          <Text>Oriònides</Text>
        </Screen>
      </SafeAreaProvider>,
    );
    expect(screen.getByRole('header', { name: 'Calendari' })).toBeOnTheScreen();
    expect(screen.getByText('Fenòmens del mes')).toBeOnTheScreen();
    expect(screen.getByText('Oriònides')).toBeOnTheScreen();
  });

  it('sense subtítol no en pinta cap', async () => {
    await render(
      <SafeAreaProvider initialMetrics={METRICS}>
        <Screen title="Perfil" />
      </SafeAreaProvider>,
    );
    expect(screen.getByRole('header', { name: 'Perfil' })).toBeOnTheScreen();
    expect(screen.queryByText('Fenòmens del mes')).toBeNull();
  });
});
