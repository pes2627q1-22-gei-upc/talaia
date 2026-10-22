import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import i18n, { changeLanguage } from 'i18next';
import { initReactI18next } from 'react-i18next';

import ca from './locales/ca.json';
import en from './locales/en.json';
import es from './locales/es.json';

export const SUPPORTED_LANGUAGES = ['ca', 'es', 'en'] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];
export const DEFAULT_LANGUAGE: Language = 'ca';

export const resources = {
  ca: { translation: ca },
  es: { translation: es },
  en: { translation: en },
} as const;

export function isSupportedLanguage(code: string | null | undefined): code is Language {
  return SUPPORTED_LANGUAGES.includes(code as Language);
}

/** Idioma inicial: el del dispositiu si el suportem; si no, català. */
export function detectLanguage(): Language {
  const deviceLanguage = getLocales()[0]?.languageCode;
  return isSupportedLanguage(deviceLanguage) ? deviceLanguage : DEFAULT_LANGUAGE;
}

/** L'idioma triat al perfil: mana sobre el del dispositiu en les arrencades següents. */
export const LANGUAGE_KEY = 'talaia:idioma';

export async function saveLanguage(code: Language): Promise<void> {
  await changeLanguage(code);
  await AsyncStorage.setItem(LANGUAGE_KEY, code).catch(() => {});
}

export async function restoreLanguage(): Promise<void> {
  const saved = await AsyncStorage.getItem(LANGUAGE_KEY).catch(() => null);
  if (isSupportedLanguage(saved) && saved !== i18n.language) await changeLanguage(saved);
}

void i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: detectLanguage(),
    fallbackLng: DEFAULT_LANGUAGE,
    interpolation: { escapeValue: false },
    returnNull: false,
  })
  .then(restoreLanguage);

export default i18n;
