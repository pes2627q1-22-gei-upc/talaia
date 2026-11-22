import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useAuthViewModel } from '@/features/auth/useAuthViewModel';
import { useFavoritesQuery } from '@/features/point/favoritesRepository';

/** Llista personal compartida amb el botó de la fitxa del punt. */
export function useFavoritesViewModel() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useAuthViewModel();
  const favorites = useFavoritesQuery(user !== null);

  return {
    title: t('profile.savedPoints'),
    subtitle:
      !favorites.isPending && !favorites.isError && favorites.data?.length
        ? t('profile.savedPointsCount', { count: favorites.data.length })
        : undefined,
    back: { label: t('profile.back'), onPress: () => router.back() },
    points: favorites.data ?? [],
    loading: user !== null && favorites.isPending,
    error: favorites.isError ? t('profile.savedPointsError') : null,
    empty: t('profile.savedPointsEmpty'),
    openHint: t('profile.openSavedPoint'),
    retryLabel: t('profile.retry'),
    retry: () => void favorites.refetch(),
    openPoint: (id: string) => router.push({ pathname: '/punt/[id]', params: { id } }),
  };
}
