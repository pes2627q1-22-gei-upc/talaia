import { renderHook } from '@testing-library/react-native';
import { Linking } from 'react-native';

import i18n from '@/core/i18n';
import { usePushPermission } from '@/features/notifications/PushRegistrationProvider';
import type { PushRegistrationState } from '@/features/notifications/usePushRegistration';

import { useAlertsViewModel } from '../useAlertsViewModel';

jest.mock('@/features/notifications/PushRegistrationProvider', () => ({
  usePushPermission: jest.fn(),
}));

const withPermission = (permission: PushRegistrationState['permission']) =>
  jest.mocked(usePushPermission).mockReturnValue({
    permission,
    registered: false,
    requestPermission: jest.fn(),
  });

beforeAll(() => i18n.changeLanguage('ca'));

describe('useAlertsViewModel', () => {
  it.each(['granted', 'undetermined', null] as const)(
    'amb el permís %s no avisa de res',
    async (p) => {
      withPermission(p);
      const { result } = await renderHook(() => useAlertsViewModel());
      expect(result.current.pushNotice).toBeNull();
    },
  );

  it('sense permís, ho diu i ofereix obrir la configuració', async () => {
    withPermission('denied');
    const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue();
    const { result } = await renderHook(() => useAlertsViewModel());
    expect(result.current.pushNotice?.message).toMatch(/notificacions estan desactivades/);
    result.current.pushNotice?.action?.onPress();
    expect(openSettings).toHaveBeenCalled();
  });

  it('a un dispositiu sense push (Expo Go, simulador), ho diu sense cap acció', async () => {
    withPermission('unavailable');
    const { result } = await renderHook(() => useAlertsViewModel());
    expect(result.current.pushNotice).toEqual({
      message: expect.stringMatching(/no pot rebre notificacions/),
    });
  });
});
