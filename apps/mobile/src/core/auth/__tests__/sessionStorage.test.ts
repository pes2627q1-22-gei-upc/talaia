import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { sessionStorage } from '../sessionStorage';

jest.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'device',
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

const nativeOS = Platform.OS;
afterEach(() => {
  Platform.OS = nativeOS;
  jest.clearAllMocks();
});

it('persisteix i elimina la sessió al magatzem segur natiu', async () => {
  Platform.OS = 'ios';
  jest.mocked(SecureStore.getItemAsync).mockResolvedValue('session');
  await sessionStorage.setItem('auth', 'session');
  expect(SecureStore.setItemAsync).toHaveBeenCalledWith('auth', 'session', {
    keychainAccessible: 'device',
  });
  expect(await sessionStorage.getItem('auth')).toBe('session');
  await sessionStorage.removeItem('auth');
  expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('auth', {
    keychainAccessible: 'device',
  });
});

it('propaga els errors de persistència en lloc de perdre silenciosament la sessió', async () => {
  Platform.OS = 'android';
  jest.mocked(SecureStore.setItemAsync).mockRejectedValueOnce(new Error('storage full'));
  await expect(sessionStorage.setItem('auth', 'large session')).rejects.toThrow('storage full');
});

it('la previsualització web només desa la sessió en memòria', async () => {
  Platform.OS = 'web';
  await sessionStorage.setItem('web-auth', 'session');
  expect(await sessionStorage.getItem('web-auth')).toBe('session');
  await sessionStorage.removeItem('web-auth');
  expect(await sessionStorage.getItem('web-auth')).toBeNull();
  expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
});
