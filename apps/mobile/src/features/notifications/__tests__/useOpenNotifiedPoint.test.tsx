import { renderHook } from '@testing-library/react-native';
import { router } from 'expo-router';

import { pushRepository } from '../pushRepository';
import { useOpenNotifiedPoint } from '../useOpenNotifiedPoint';

jest.mock('expo-router', () => {
  const router = { push: jest.fn() };
  return { router, useRouter: () => router };
});
jest.mock('../pushRepository', () => ({
  pushRepository: { onPointNotificationOpened: jest.fn(), showNotificationsWhileOpen: jest.fn() },
}));

const onOpened = jest.mocked(pushRepository.onPointNotificationOpened);
const stop = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  onOpened.mockReturnValue(stop);
});

it('en tocar la notificació obre la fitxa del punt', async () => {
  await renderHook(() => useOpenNotifiedPoint(true));
  const listener = onOpened.mock.calls[0]![0];

  listener('montsec');

  expect(router.push).toHaveBeenCalledWith({ pathname: '/punt/[id]', params: { id: 'montsec' } });
});

it('sense sessió no escolta res; quan n’hi ha, sí, i en desmuntar-se deixa d’escoltar', async () => {
  const { rerender, unmount } = await renderHook(
    ({ enabled }: { enabled: boolean }) => useOpenNotifiedPoint(enabled),
    { initialProps: { enabled: false } },
  );
  expect(onOpened).not.toHaveBeenCalled();
  expect(pushRepository.showNotificationsWhileOpen).not.toHaveBeenCalled();

  await rerender({ enabled: true });
  expect(onOpened).toHaveBeenCalledTimes(1);
  expect(pushRepository.showNotificationsWhileOpen).toHaveBeenCalledTimes(1);

  await unmount();
  expect(stop).toHaveBeenCalled();
});
