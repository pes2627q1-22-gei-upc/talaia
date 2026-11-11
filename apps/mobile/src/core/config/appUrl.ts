import Constants from 'expo-constants';
import { isRunningInExpoGo } from 'expo';
import * as Linking from 'expo-linking';

/**
 * Adreça per tornar a l'app des del navegador (OAuth, enllaç del correu).
 *
 * A Expo Go ha de ser `exp://<hostUri>/--/<path>`, amb el host d'on s'ha carregat l'app (nip.io:
 * Supabase rebutja les IP). No fem servir `Linking.createURL`: només hi posa `exp` si
 * `Constants.executionEnvironment` és `storeClient`, i Expo Go 58 hi diu `bare`, de manera que
 * tornava `talaia://`, que Expo Go no obre. Als builds natius, `talaia://<path>`.
 */
export function appUrl(
  path: string,
  expoGoHostUri: string | null | undefined = isRunningInExpoGo()
    ? Constants.expoConfig?.hostUri
    : null,
): string {
  return expoGoHostUri ? `exp://${expoGoHostUri}/--/${path}` : Linking.createURL(path);
}
