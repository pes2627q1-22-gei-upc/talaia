import { getAccessToken } from '../accessToken';
import { getAuthClient } from '../supabase';

jest.mock('../supabase', () => ({ getAuthClient: jest.fn() }));

const getSession = jest.fn();
beforeEach(() => {
  jest.clearAllMocks();
  jest
    .mocked(getAuthClient)
    .mockReturnValue({ auth: { getSession } } as unknown as NonNullable<
      ReturnType<typeof getAuthClient>
    >);
});

it('consulta la sessió al SDK cada vegada, inclosa la renovació', async () => {
  getSession
    .mockResolvedValueOnce({ data: { session: { access_token: 'old' } }, error: null })
    .mockResolvedValueOnce({ data: { session: { access_token: 'new' } }, error: null });
  expect(await getAccessToken()).toBe('old');
  expect(await getAccessToken()).toBe('new');
  expect(getSession).toHaveBeenCalledTimes(2);
});

it('no inventa un token si no hi ha sessió o configuració', async () => {
  getSession.mockResolvedValue({ data: { session: null }, error: null });
  expect(await getAccessToken()).toBeNull();
  jest.mocked(getAuthClient).mockReturnValue(null);
  expect(await getAccessToken()).toBeNull();
});

it('propaga els errors del SDK al client HTTP', async () => {
  getSession.mockResolvedValue({ data: { session: null }, error: new Error('refresh failed') });
  await expect(getAccessToken()).rejects.toThrow('refresh failed');
});
