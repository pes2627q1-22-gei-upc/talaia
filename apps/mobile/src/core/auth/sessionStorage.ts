import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// La previsualització web és efímera: mai desem credencials a localStorage.
const memory = new Map<string, string>();
const options = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };

export const sessionStorage = {
  async getItem(key: string): Promise<string | null> {
    return Platform.OS === 'web'
      ? (memory.get(key) ?? null)
      : SecureStore.getItemAsync(key, options);
  },
  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') memory.set(key, value);
    else await SecureStore.setItemAsync(key, value, options);
  },
  async removeItem(key: string): Promise<void> {
    if (Platform.OS === 'web') memory.delete(key);
    else await SecureStore.deleteItemAsync(key, options);
  },
};
