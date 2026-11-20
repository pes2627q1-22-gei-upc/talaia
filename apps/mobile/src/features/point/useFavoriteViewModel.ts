import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useAuthState } from '@/features/auth/AuthProvider';

import { favoritesKey, favoritesRepository, useFavoritesQuery } from './favoritesRepository';

type FavoriteAction = 'add' | 'remove';

/** Alterna un favorit amb resposta immediata i recuperació si falla la petició. */
export function useFavoriteViewModel(pointId: string) {
  const { user } = useAuthState();
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const favorites = useFavoritesQuery(user !== null && pointId.trim().length > 0);
  const [optimistic, setOptimistic] = useState<boolean | null>(null);
  const [failed, setFailed] = useState<FavoriteAction | null>(null);
  const sending = useRef(false);
  const saved = optimistic ?? favorites.data?.some((item) => item.id === pointId) ?? false;
  const change = useMutation({
    mutationFn: async (action: FavoriteAction) => {
      if (action === 'add') return favoritesRepository.add(pointId);
      await favoritesRepository.remove(pointId);
      return null;
    },
    onSuccess: (favorite, action) => {
      const key = favoritesKey(i18n.resolvedLanguage ?? 'ca');
      queryClient.setQueryData(
        key,
        (current: Awaited<ReturnType<typeof favoritesRepository.list>> | undefined) =>
          action === 'remove'
            ? current?.filter((item) => item.id !== pointId)
            : favorite && !current?.some((item) => item.id === favorite.id)
              ? [favorite, ...(current ?? [])]
              : current,
      );
      setOptimistic(null);
      void queryClient.invalidateQueries({ queryKey: ['favorits'] });
    },
    onError: (_error, action) => {
      setOptimistic(null);
      setFailed(action);
    },
    onSettled: () => {
      sending.current = false;
    },
  });

  const press = () => {
    if (sending.current || !user || favorites.isPending) return;
    const action = saved ? 'remove' : 'add';
    sending.current = true;
    setOptimistic(action === 'add');
    setFailed(null);
    change.mutate(action);
  };

  return {
    saved,
    disabled: !user || favorites.isPending || change.isPending,
    label: t(saved ? 'point.removeFavorite' : 'point.addFavorite'),
    hint: !user ? t('point.favoriteLogin') : undefined,
    error: failed
      ? t(failed === 'add' ? 'point.favoriteError' : 'point.favoriteRemoveError')
      : undefined,
    press,
  };
}
