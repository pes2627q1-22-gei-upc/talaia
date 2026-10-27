import { useTranslation } from 'react-i18next';

import { useHealthQuery } from './apiStatusRepository';

export type ApiStatus = 'loading' | 'ok' | 'error';

/**
 * ViewModel de l'indicador d'estat de l'API. Tradueix l'estat de la consulta a textos i
 * accions; la View no sap res de TanStack Query ni de l'API.
 */
export function useApiStatusViewModel() {
  const { t } = useTranslation();
  const health = useHealthQuery();

  // Mentre es torna a provar després d'un error, es mostra «comprovant».
  let status: ApiStatus = 'error';
  if (health.isSuccess) status = 'ok';
  else if (health.isFetching) status = 'loading';

  const messages: Record<ApiStatus, string> = {
    loading: t('apiStatus.loading'),
    ok: t('apiStatus.ok', { version: health.data?.version }),
    error: t('apiStatus.error'),
  };

  return {
    title: t('apiStatus.title'),
    status,
    message: messages[status],
    retryLabel: t('apiStatus.retry'),
    canRetry: status === 'error',
    retry: () => {
      void health.refetch();
    },
  };
}
