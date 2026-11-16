import { isRunningInExpoGo } from 'expo';

import { appUrl } from '../appUrl';

jest.mock('expo', () => ({ isRunningInExpoGo: jest.fn() }));
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { hostUri: '192-168-1-50.nip.io:8081' } },
}));
jest.mock('expo-linking', () => ({ createURL: (path: string) => `talaia://${path}` }));

it("a Expo Go torna a l'Expo Go d'on s'ha carregat l'app", () => {
  jest.mocked(isRunningInExpoGo).mockReturnValue(true);
  expect(appUrl('auth/callback')).toBe('exp://192-168-1-50.nip.io:8081/--/auth/callback');
});

it("als builds natius fa servir l'esquema de l'app", () => {
  jest.mocked(isRunningInExpoGo).mockReturnValue(false);
  expect(appUrl('auth/correu')).toBe('talaia://auth/correu');
});

it('sense host conegut (Expo Go sense Metro) cau a createURL', () => {
  expect(appUrl('auth/callback', undefined)).toBe('talaia://auth/callback');
});
