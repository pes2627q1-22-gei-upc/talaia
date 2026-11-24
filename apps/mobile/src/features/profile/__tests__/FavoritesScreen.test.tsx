import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { apiDelete, apiGet, apiPost } from '@/core/api/httpClient';
import i18n from '@/core/i18n';
import { ThemeProvider, type ThemeName } from '@/core/theme/theme';
import { colorsVermell } from '@/core/theme/tokens';
import { useAuthViewModel } from '@/features/auth/useAuthViewModel';
import { createQueryWrapper } from '@/test-utils/queryWrapper';

import { FavoritesScreen } from '../FavoritesScreen';

jest.mock('@/core/api/httpClient', () => ({
  ...jest.requireActual('@/core/api/httpClient'),
  apiGet: jest.fn(),
  apiDelete: jest.fn(),
  apiPost: jest.fn(),
}));
jest.mock('@/features/auth/useAuthViewModel', () => ({ useAuthViewModel: jest.fn() }));
jest.mock('expo-router', () => ({ useRouter: jest.fn() }));

const get = jest.mocked(apiGet);
const del = jest.mocked(apiDelete);
const post = jest.mocked(apiPost);
const push = jest.fn();
const back = jest.fn();

async function show(theme: ThemeName = 'normal') {
  const QueryWrapper = createQueryWrapper();
  return render(
    <QueryWrapper>
      <ThemeProvider name={theme}>
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
  del.mockResolvedValue(undefined);
  post.mockResolvedValue({ id: 'montsec', nom: 'Montsec', municipi: 'Àger' });
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
  expect(await screen.findByText('2 llocs desats per tornar-hi')).toBeOnTheScreen();
  expect(screen.getByText('Toca el cor per treure un punt dels favorits.')).toBeOnTheScreen();
  const row = await screen.findByRole('button', { name: 'Parc Astronòmic del Montsec, Àger' });
  expect(screen.getByText('Parc Astronòmic del Montsec')).toHaveProp('numberOfLines', 2);
  expect(screen.getByText('Àger')).toHaveProp('numberOfLines', 1);
  expect(screen.getByRole('button', { name: 'Mirador del Pirineu, Sort' })).toBeOnTheScreen();
  expect(screen.getAllByTestId(/^favorite-card-/).map((item) => item.props.testID)).toEqual([
    'favorite-card-pirineu',
    'favorite-card-montsec',
  ]);
  const card = screen.getByTestId('favorite-card-montsec');
  expect(card.props.style[0]).toMatchObject({
    flexDirection: 'row',
    alignItems: 'stretch',
    minHeight: expect.any(Number),
    borderRadius: expect.any(Number),
  });
  expect(row.props.style[0]).toMatchObject({ flexDirection: 'row', alignItems: 'center' });
  expect(screen.getByText('Àger').parent?.props.style.flexDirection).toBe('row');
  expect(screen.getByTestId('favorite-chevron-montsec')).toBeOnTheScreen();
  const heart = screen.getByTestId('favorite-icon-montsec');
  expect(card.children[0]).toBe(heart);
  expect(heart.props.style[0].width).toBeGreaterThanOrEqual(44);
  expect(heart.props.style[0].minHeight).toBeGreaterThanOrEqual(44);
  await fireEvent.press(row);
  expect(push).toHaveBeenCalledWith({ pathname: '/punt/[id]', params: { id: 'montsec' } });
  await fireEvent.press(screen.getByRole('button', { name: 'Torna al perfil' }));
  expect(back).toHaveBeenCalledTimes(1);
  expect(get).toHaveBeenCalledWith('/favorits', undefined, { signal: expect.any(AbortSignal) });
});

it('buida el cor, deixa acabar la sortida i permet desfer l’eliminació', async () => {
  get
    .mockResolvedValueOnce([
      { id: 'montsec', nom: 'Montsec', municipi: 'Àger' },
      { id: 'pirineu', nom: 'Pirineu', municipi: 'Sort' },
    ])
    .mockResolvedValueOnce([{ id: 'pirineu', nom: 'Pirineu', municipi: 'Sort' }])
    .mockResolvedValue([
      { id: 'pirineu', nom: 'Pirineu', municipi: 'Sort' },
      { id: 'montsec', nom: 'Montsec', municipi: 'Àger' },
    ]);
  let finish!: () => void;
  del.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  await show();
  const remove = await screen.findByRole('button', { name: 'Treu Montsec dels favorits' });
  await fireEvent.press(remove);
  expect(screen.getByText('Montsec')).toBeOnTheScreen();
  expect(screen.getByTestId('favorite-heart-montsec').props.source).toEqual([
    require('@/assets/images/point/heart-outline.svg'),
  ]);
  expect(screen.getByText('Pirineu')).toBeOnTheScreen();
  expect(push).not.toHaveBeenCalled();
  expect(del).toHaveBeenCalledWith('/favorits/montsec');
  await act(async () => finish());
  await waitFor(() => expect(screen.queryByText('Montsec')).toBeNull());
  expect(await screen.findByRole('button', { name: 'Desfés' })).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Desfés' }));
  expect(post).toHaveBeenCalledWith('/favorits', { puntId: 'montsec' });
  expect(await screen.findByText('Montsec')).toBeOnTheScreen();
  await waitFor(() => expect(get).toHaveBeenCalledTimes(3));
  expect(screen.getAllByTestId(/^favorite-card-/).map((item) => item.props.testID)).toEqual([
    'favorite-card-montsec',
    'favorite-card-pirineu',
  ]);
});

it('restaura el punt i mostra un error si falla l’eliminació', async () => {
  get
    .mockResolvedValueOnce([{ id: 'montsec', nom: 'Montsec', municipi: 'Àger' }])
    .mockResolvedValue([]);
  del.mockRejectedValueOnce(new Error('offline'));
  await show();
  await fireEvent.press(await screen.findByRole('button', { name: 'Treu Montsec dels favorits' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'No hem pogut treure el favorit. Torna-ho a provar.',
  );
  expect(screen.getByText('Montsec')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Treu Montsec dels favorits' }));
  await waitFor(() => expect(screen.queryByText('Montsec')).toBeNull());
});

it('manté les targetes coherents en mode nit sense fer dependre la llista de l’índex horari', async () => {
  get.mockResolvedValue([
    {
      id: 'montsec',
      nom: 'Montsec',
      municipi: 'Àger',
      index: { valor: 82, franja: 'ras', deDia: false },
    },
    {
      id: 'garraf',
      nom: 'Garraf',
      municipi: 'Sitges',
      index: { valor: 0, franja: 'tap', deDia: true },
    },
    { id: 'prades', nom: 'Prades', municipi: 'Prades', index: null },
  ]);
  await show('vermell');
  expect(await screen.findByText('3 llocs desats per tornar-hi')).toBeOnTheScreen();
  expect(screen.queryByText('82')).toBeNull();
  expect(screen.queryByText('0')).toBeNull();
  expect(screen.getByTestId('favorite-card-montsec').props.style[0]).toMatchObject({
    backgroundColor: colorsVermell.card,
  });
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
