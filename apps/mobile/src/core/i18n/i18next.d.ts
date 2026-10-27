import 'i18next';

import type ca from './locales/ca.json';

// Claus de traducció tipades: t('map.titol') és un error de compilació.
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: { translation: typeof ca };
  }
}
