import { act, renderHook } from '@testing-library/react-native';

import { accountBlocked } from '@/core/api/accountBlocked';
import { ApiError } from '@/core/api/httpClient';
import i18n from '@/core/i18n';

import { profileRepository } from '../profileRepository';
import { useAccountBlockedViewModel } from '../useAccountBlockedViewModel';
import { useAuthViewModel } from '../useAuthViewModel';

jest.mock('../useAuthViewModel', () => ({ useAuthViewModel: jest.fn() }));
jest.mock('@/core/config/env', () => ({ env: { contactEmail: null } }));
jest.mock('../profileRepository', () => ({ profileRepository: { ensure: jest.fn() } }));

const ensure = jest.mocked(profileRepository.ensure);

beforeEach(async () => {
  jest.clearAllMocks();
  await i18n.changeLanguage('ca');
  accountBlocked.report();
  jest.mocked(useAuthViewModel).mockReturnValue({
    error: null,
    signingOut: false,
    logoutLabel: 'Tanca la sessió',
    signOut: jest.fn(),
  } as unknown as ReturnType<typeof useAuthViewModel>);
});

afterEach(() => accountBlocked.clear());

it('si l’han desbloquejat, tornar-ho a comprovar treu l’avís', async () => {
  ensure.mockResolvedValue({ created: false });
  const { result } = await renderHook(useAccountBlockedViewModel);
  expect(result.current.retryLabel).toBe('Torna-ho a comprovar');
  await act(async () => result.current.retry());
  expect(ensure).toHaveBeenCalledTimes(1);
  expect(accountBlocked.get()).toBe(false);
  expect(result.current.checking).toBe(false);
});

it('si encara està bloquejat o no hi ha xarxa, l’avís es queda', async () => {
  ensure.mockRejectedValueOnce(new ApiError(403, 'account_blocked', 'No'));
  ensure.mockRejectedValueOnce(new Error('network'));
  const { result } = await renderHook(useAccountBlockedViewModel);
  await act(async () => result.current.retry());
  await act(async () => result.current.retry());
  expect(accountBlocked.get()).toBe(true);
});

it('mentre comprova, ho diu', async () => {
  let finish!: () => void;
  ensure.mockReturnValue(
    new Promise((done) => {
      finish = () => done({ created: false });
    }),
  );
  const { result } = await renderHook(useAccountBlockedViewModel);
  await act(async () => result.current.retry());
  expect(result.current.checking).toBe(true);
  expect(result.current.retryLabel).toBe('Comprovant…');
  await act(async () => finish());
  expect(result.current.checking).toBe(false);
});
