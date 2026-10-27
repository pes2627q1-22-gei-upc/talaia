import Constants from 'expo-constants';

/**
 * L'API corre al mateix ordinador que Metro. A Expo Go, `hostUri` és d'on s'ha carregat l'app
 * (p. ex. `192-168-1-50.nip.io:8081`), i el mòbil ja hi arriba: no cal escriure cap IP. Amb nip.io
 * es torna a la IP: als builds natius, l'ATS d'iOS deixa fer HTTP a IP locals però no a dominis.
 */
export function apiUrlFromHost(hostUri: string | null | undefined): string | undefined {
  const host = hostUri?.split(':')[0]?.replace(/^(\d+)-(\d+)-(\d+)-(\d+)\.nip\.io$/, '$1.$2.$3.$4');
  return host ? `http://${host}:3000/api/v1` : undefined;
}

/**
 * Variables d'entorn públiques de l'app. Expo només exposa les que comencen per EXPO_PUBLIC_.
 * Els valors reals van a apps/mobile/.env (ignorat); la llista és a apps/mobile/.env.example.
 */
export const env = {
  apiUrl:
    process.env.EXPO_PUBLIC_API_URL ||
    apiUrlFromHost(Constants.expoConfig?.hostUri) ||
    'http://localhost:3000/api/v1',
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
} as const;
