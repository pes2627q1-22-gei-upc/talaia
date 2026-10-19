import { useTranslation } from 'react-i18next';

import { useAuthState } from './AuthProvider';

export function useAuthViewModel() {
  const state = useAuthState();
  const { t } = useTranslation();
  return {
    ...state,
    isAuthenticated: state.user !== null,
    logoutLabel: t(state.signingOut ? 'auth.signingOut' : 'auth.signOut'),
    errorMessage: state.error ? t(`auth.${state.error}Error`) : null,
    retryLabel: t('auth.retry'),
  };
}
