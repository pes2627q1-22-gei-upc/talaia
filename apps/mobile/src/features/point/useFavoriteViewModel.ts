import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useAuthState } from '@/features/auth/AuthProvider';

import { favoritesKey, favoritesRepository, useFavoritesQuery } from './favoritesRepository';

/** Desa un punt com a favorit amb resposta immediata i recuperació si falla el POST. */
export function useFavoriteViewModel(pointId: string) {
  const { user } = useAuthState();
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const favorites = useFavoritesQuery(user !== null && pointId.trim().length > 0);
  const [optimistic, setOptimistic] = useState(false);
  const [failed, setFailed] = useState(false);
  const sending = useRef(false);
  const saved = optimistic || (favorites.data?.some((item) => item.id === pointId) ?? false);
  const add = useMutation({
    mutationFn: () => favoritesRepository.add(pointId),
    onSuccess: (favorite) => {
      const key = favoritesKey(i18n.resolvedLanguage ?? 'ca');
      queryClient.setQueryData(
        key,
        (current: Awaited<ReturnType<typeof favoritesRepository.list>> | undefined) =>
          current?.some((item) => item.id === favorite.id)
            ? current
            : [favorite, ...(current ?? [])],
      );
      void queryClient.invalidateQueries({ queryKey: ['favorits'] });
    },
    onError: () => {
      setOptimistic(false);
      setFailed(true);
    },
    onSettled: () => {
      sending.current = false;
    },
  });

  const press = () => {
    if (sending.current || saved || !user || favorites.isPending) return;
    sending.current = true;
    setOptimistic(true);
    setFailed(false);
    add.mutate();
  };

  return {
    saved,
    disabled: !user || favorites.isPending || saved || add.isPending,
    label: t(saved ? 'point.favoriteSaved' : 'point.addFavorite'),
    hint: !user ? t('point.favoriteLogin') : undefined,
    error: failed ? t('point.favoriteError') : undefined,
    press,
  };
}
