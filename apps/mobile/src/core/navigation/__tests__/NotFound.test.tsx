import { fireEvent } from '@testing-library/react-native';
import { renderRouter, screen } from 'expo-router/testing-library';
import { Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import NotFound from '@/app/+not-found';
import i18n from '@/core/i18n';

it('una ruta inexistent explica l’error i l’enllaç torna a l’inici', async () => {
  await i18n.changeLanguage('ca');
  await renderRouter(
    {
      index: () => <Text>Inici de prova</Text>,
      '+not-found': NotFound,
    },
    {
      initialUrl: '/ruta-inexistent',
      wrapper: ({ children }) => (
        <SafeAreaProvider
          initialMetrics={{
            frame: { x: 0, y: 0, width: 393, height: 852 },
            insets: { top: 59, left: 0, right: 0, bottom: 34 },
          }}
        >
          {children}
        </SafeAreaProvider>
      ),
    },
  );
  expect(screen.getByRole('header', { name: i18n.t('notFound.title') })).toBeOnTheScreen();
  await fireEvent.press(screen.getByText(i18n.t('notFound.back')));
  expect(await screen.findByText('Inici de prova')).toBeOnTheScreen();
  expect(screen).toHavePathname('/');
});
