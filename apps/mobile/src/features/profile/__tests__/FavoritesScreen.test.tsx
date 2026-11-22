import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { apiGet } from '@/core/api/httpClient';
import i18n from '@/core/i18n';
import { ThemeProvider } from '@/core/theme/theme';
import { useAuthViewModel } from '@/features/auth/useAuthViewModel';
import { createQueryWrapper } from '@/test-utils/queryWrapper';

import { FavoritesScreen } from '../FavoritesScreen';

jest.mock('@/core/api/httpClient', () => ({
  ...jest.requireActual('@/core/api/httpClient'),
  apiGet: jest.fn(),
}));
jest.mock('@/features/auth/useAuthViewModel', () => ({ useAuthViewModel: jest.fn() }));
jest.mock('expo-router', () => ({ useRouter: jest.fn() }));

const get = jest.mocked(apiGet);
const push = jest.fn();
const back = jest.fn();

async function show() {
  const QueryWrapper = createQueryWrapper();
  return render(
    <QueryWrapper>
      <ThemeProvider name="normal">
        <SafeAreaProvider
          initialMetrics={{
            frame: { x: 0, y: 0, width: 320, height: 568 },
            insets: { top: 20, left: 0, right: 0, bottom: 0 },
          }}
        >
          <FavoritesScreen />
        </SafeAreaProvider>
      </ThemeProvider>
    </QueryWrapper>,
  );
}

beforeEach(async () => {
  jest.clearAllMocks();
  jest.mocked(useRouter).mockReturnValue({ push, back } as unknown as ReturnType<typeof useRouter>);
  jest
    .mocked(useAuthViewModel)
    .mockReturnValue({ user: { id: 'one' } } as ReturnType<typeof useAuthViewModel>);
  await i18n.changeLanguage('ca');
});

it('mostra les files sense tapar el text i obre la fitxa tocada', async () => {
  get.mockResolvedValue([
    { id: 'montsec', nom: 'Parc Astronòmic del Montsec', municipi: 'Àger' },
    { id: 'pirineu', nom: 'Mirador del Pirineu', municipi: 'Sort' },
  ]);
  await show();
  expect(screen.getByRole('header', { name: 'Punts favorits' })).toBeOnTheScreen();
  const row = await screen.findByRole('button', { name: 'Parc Astronòmic del Montsec, Àger' });
  expect(screen.getByText('Parc Astronòmic del Montsec')).toHaveProp('numberOfLines', 2);
  expect(screen.getByText('Àger')).toHaveProp('numberOfLines', 1);
  expect(screen.getByRole('button', { name: 'Mirador del Pirineu, Sort' })).toBeOnTheScreen();
  expect(row.props.style[0]).toMatchObject({ flexDirection: 'row', minHeight: expect.any(Number) });
  await fireEvent.press(row);
  expect(push).toHaveBeenCalledWith({ pathname: '/punt/[id]', params: { id: 'montsec' } });
  await fireEvent.press(screen.getByRole('button', { name: 'Torna al perfil' }));
  expect(back).toHaveBeenCalledTimes(1);
  expect(get).toHaveBeenCalledWith('/favorits', undefined, { signal: expect.any(AbortSignal) });
});

it('mostra un estat buit quan no hi ha favorits', async () => {
  get.mockResolvedValue([]);
  await show();
  expect(await screen.findByText('Encara no tens cap punt favorit.')).toBeOnTheScreen();
});

it('permet reintentar una càrrega fallida', async () => {
  get.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce([]);
  await show();
  expect(await screen.findByText("No s'han pogut carregar els punts favorits.")).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Torna-ho a provar' }));
  await waitFor(() =>
    expect(screen.getByText('Encara no tens cap punt favorit.')).toBeOnTheScreen(),
  );
  expect(get).toHaveBeenCalledTimes(2);
});
