import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { RestoreErrorScreen } from '../RestoreErrorScreen';
import { useAuthViewModel } from '../useAuthViewModel';

jest.mock('../useAuthViewModel', () => ({ useAuthViewModel: jest.fn() }));

const restore = jest.fn(async () => {});

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useAuthViewModel).mockReturnValue({
    errorMessage: 'No s’ha pogut recuperar la sessió. Torna-ho a provar.',
    retryLabel: 'Torna-ho a provar',
    restore,
  } as unknown as ReturnType<typeof useAuthViewModel>);
});

it('explica què ha passat i torna a provar de recuperar la sessió', async () => {
  await render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 393, height: 852 },
        insets: { top: 59, left: 0, right: 0, bottom: 34 },
      }}
    >
      <RestoreErrorScreen />
    </SafeAreaProvider>,
  );
  expect(
    screen.getByText('No s’ha pogut recuperar la sessió. Torna-ho a provar.'),
  ).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Torna-ho a provar' }));
  expect(restore).toHaveBeenCalledTimes(1);
});
