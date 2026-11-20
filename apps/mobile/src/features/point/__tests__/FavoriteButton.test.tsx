import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { apiGet, apiPost } from '@/core/api/httpClient';
import i18n from '@/core/i18n';
import { useAuthState } from '@/features/auth/AuthProvider';
import { createQueryWrapper } from '@/test-utils/queryWrapper';

import { FavoriteButton } from '../FavoriteButton';
import { favoritesRepository } from '../favoritesRepository';

jest.mock('@/core/api/httpClient', () => ({
  ...jest.requireActual('@/core/api/httpClient'),
  apiGet: jest.fn(),
  apiPost: jest.fn(),
}));
jest.mock('@/features/auth/AuthProvider', () => ({ useAuthState: jest.fn() }));

const get = jest.mocked(apiGet);
const post = jest.mocked(apiPost);
const auth = jest.mocked(useAuthState);
const favorite = { id: 'montsec', nom: 'Montsec' } as Awaited<
  ReturnType<typeof favoritesRepository.add>
>;

async function show() {
  const Wrapper = createQueryWrapper();
  return render(<FavoriteButton pointId="montsec" />, { wrapper: Wrapper });
}

beforeEach(async () => {
  await i18n.changeLanguage('ca');
  auth.mockReturnValue({ user: { id: 'user-1' } } as ReturnType<typeof useAuthState>);
  get.mockReset();
  get.mockResolvedValue([]);
  post.mockReset();
  post.mockResolvedValue(favorite);
});

it('mostra el botó accessible i marca el punt immediatament, amb un sol POST', async () => {
  await show();
  const button = await screen.findByRole('button', { name: 'Desa com a favorit' });
  await waitFor(() => expect(button).toBeEnabled());
  let resolve!: (value: typeof favorite) => void;
  post.mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  await fireEvent.press(button);
  expect(
    screen.getByRole('button', { name: 'Punt desat als favorits' }).props.accessibilityState,
  ).toMatchObject({ selected: true });
  await fireEvent.press(button);
  expect(post).toHaveBeenCalledTimes(1);
  expect(post).toHaveBeenCalledWith('/favorits', { puntId: 'montsec' });
  resolve(favorite);
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Punt desat als favorits' })).toBeDisabled(),
  );
});

it('reverteix el marcatge si el POST falla i permet reintentar', async () => {
  post.mockRejectedValueOnce(new Error('offline'));
  await show();
  const button = await screen.findByRole('button', { name: 'Desa com a favorit' });
  await waitFor(() => expect(button).toBeEnabled());
  await fireEvent.press(button);
  expect(await screen.findByRole('alert')).toHaveTextContent(i18n.t('point.favoriteError'));
  expect(screen.getByRole('button', { name: 'Desa com a favorit' })).toBeEnabled();
  await fireEvent.press(screen.getByRole('button', { name: 'Desa com a favorit' }));
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Punt desat als favorits' })).toBeDisabled(),
  );
  expect(post).toHaveBeenCalledTimes(2);
  expect(screen.queryByRole('alert')).toBeNull();
});

it('respecta els favorits existents i no torna a fer POST', async () => {
  get.mockResolvedValue([favorite]);
  await show();
  const button = await screen.findByRole('button', { name: 'Punt desat als favorits' });
  expect(button).toBeDisabled();
  expect(post).not.toHaveBeenCalled();
});

it('pot desar el punt si falla la consulta inicial, perquè el POST és idempotent', async () => {
  get.mockRejectedValue(new Error('offline'));
  await show();
  const button = await screen.findByRole('button', { name: 'Desa com a favorit' });
  await waitFor(() => expect(button).toBeEnabled());
  await fireEvent.press(button);
  await waitFor(() => expect(post).toHaveBeenCalledWith('/favorits', { puntId: 'montsec' }));
});

it('sense sessió no consulta els favorits ni permet desar', async () => {
  auth.mockReturnValue({ user: null } as ReturnType<typeof useAuthState>);
  await show();
  expect(screen.getByRole('button', { name: 'Desa com a favorit' })).toBeDisabled();
  expect(get).not.toHaveBeenCalled();
});
