import { act, renderHook, waitFor } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';

import { pushRepository } from '../pushRepository';
import { usePushRegistration } from '../usePushRegistration';

jest.mock('../pushRepository', () => ({
  pushRepository: {
    getPermission: jest.fn(),
    requestPermission: jest.fn(),
    registerDevice: jest.fn(),
    onTokenChange: jest.fn(),
  },
}));

const repository = jest.mocked(pushRepository);
let appStateListener: ((state: AppStateStatus) => void) | undefined;
let tokenListener: (() => void) | undefined;
const stopTokenListener = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  repository.registerDevice.mockResolvedValue('ExponentPushToken[abc]');
  repository.onTokenChange.mockImplementation((listener) => {
    tokenListener = listener;
    return stopTokenListener;
  });
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
    appStateListener = listener;
    return { remove: jest.fn() };
  });
});

describe('usePushRegistration', () => {
  it('sense sessió no mira res', async () => {
    const { result } = await renderHook(() => usePushRegistration(null));
    expect(result.current.permission).toBeNull();
    expect(repository.getPermission).not.toHaveBeenCalled();
  });

  it('amb sessió i permís concedit, registra el token', async () => {
    repository.getPermission.mockResolvedValue('granted');
    const { result } = await renderHook(() => usePushRegistration('user-1'));
    await waitFor(() => expect(result.current.registered).toBe(true));
    expect(result.current.permission).toBe('granted');
    expect(repository.registerDevice).toHaveBeenCalledWith(expect.any(String));
  });

  it.each(['denied', 'undetermined', 'unavailable'] as const)(
    'amb el permís %s, no registra res ni demana el permís',
    async (permission) => {
      repository.getPermission.mockResolvedValue(permission);
      const { result } = await renderHook(() => usePushRegistration('user-1'));
      await waitFor(() => expect(result.current.permission).toBe(permission));
      expect(result.current.registered).toBe(false);
      expect(repository.registerDevice).not.toHaveBeenCalled();
      expect(repository.requestPermission).not.toHaveBeenCalled();
    },
  );

  it('si no es pot obtenir el token, falla en silenci', async () => {
    repository.getPermission.mockResolvedValue('granted');
    repository.registerDevice.mockRejectedValue(new Error('ERR_NOTIFICATIONS_NO_EXPERIENCE_ID'));
    const { result } = await renderHook(() => usePushRegistration('user-1'));
    await waitFor(() => expect(repository.registerDevice).toHaveBeenCalled());
    expect(result.current.permission).toBe('granted');
    expect(result.current.registered).toBe(false);
  });

  it('si el mòdul natiu falla en mirar el permís, queda com a unavailable', async () => {
    repository.getPermission.mockRejectedValue(new Error('native'));
    const { result } = await renderHook(() => usePushRegistration('user-1'));
    await waitFor(() => expect(result.current.permission).toBe('unavailable'));
  });

  it('requestPermission obre el diàleg i, si el concedeixen, registra el token', async () => {
    repository.getPermission.mockResolvedValue('undetermined');
    repository.requestPermission.mockResolvedValue('granted');
    const { result } = await renderHook(() => usePushRegistration('user-1'));
    await waitFor(() => expect(result.current.permission).toBe('undetermined'));

    await act(async () => {
      await expect(result.current.requestPermission()).resolves.toBe('granted');
    });
    expect(result.current.permission).toBe('granted');
    expect(result.current.registered).toBe(true);
  });

  it('torna a mirar el permís quan l’app torna a primer pla', async () => {
    repository.getPermission.mockResolvedValue('denied');
    const { result } = await renderHook(() => usePushRegistration('user-1'));
    await waitFor(() => expect(result.current.permission).toBe('denied'));

    repository.getPermission.mockResolvedValue('granted');
    await act(async () => appStateListener?.('active'));
    await waitFor(() => expect(result.current.registered).toBe(true));
  });

  it('torna a registrar el token quan el sistema el canvia', async () => {
    repository.getPermission.mockResolvedValue('granted');
    await renderHook(() => usePushRegistration('user-1'));
    await waitFor(() => expect(repository.registerDevice).toHaveBeenCalledTimes(1));
    await act(async () => tokenListener?.());
    expect(repository.registerDevice).toHaveBeenCalledTimes(2);
  });

  it('en tancar la sessió, deixa d’escoltar i torna a l’estat inicial', async () => {
    repository.getPermission.mockResolvedValue('granted');
    const { result, rerender } = await renderHook(
      ({ user }: { user: string | null }) => usePushRegistration(user),
      { initialProps: { user: 'user-1' as string | null } },
    );
    await waitFor(() => expect(result.current.registered).toBe(true));
    await rerender({ user: null });
    expect(stopTokenListener).toHaveBeenCalled();
    expect(result.current.permission).toBeNull();
    expect(result.current.registered).toBe(false);
  });
});
