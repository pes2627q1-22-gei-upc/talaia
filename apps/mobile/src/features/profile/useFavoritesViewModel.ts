import { useRouter } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { Favorit } from '@talaia/shared';

import { useAuthViewModel } from '@/features/auth/useAuthViewModel';
import {
  favoritesKey,
  favoritesRepository,
  useFavoritesQuery,
} from '@/features/point/favoritesRepository';

/** Llista personal compartida amb el botó de la fitxa del punt. */
export function useFavoritesViewModel() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuthViewModel();
  const favorites = useFavoritesQuery(user !== null);
  const key = favoritesKey(i18n.resolvedLanguage ?? 'ca');
  const remove = useMutation({
    mutationFn: (id: string) => favoritesRepository.remove(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Favorit[]>(key);
      queryClient.setQueryData<Favorit[]>(key, (current) =>
        current?.filter((point) => point.id !== id),
      );
      return { previous };
    },
    onError: (_error, _id, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['favorits'] }),
  });

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
    removeLabel: (name: string) => t('profile.removeSavedPoint', { name }),
    removeError: remove.isError ? t('point.favoriteRemoveError') : null,
    removing: remove.isPending,
    removePoint: (id: string) => {
      if (remove.isPending) return;
      remove.reset();
      remove.mutate(id);
    },
    retryLabel: t('profile.retry'),
    retry: () => void favorites.refetch(),
    openPoint: (id: string) => router.push({ pathname: '/punt/[id]', params: { id } }),
  };
}
