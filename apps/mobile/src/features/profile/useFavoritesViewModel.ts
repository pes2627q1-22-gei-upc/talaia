import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { Favorit } from '@talaia/shared';
import { useReducedMotion } from 'react-native-reanimated';

import { motion } from '@/core/theme/tokens';
import { useAuthViewModel } from '@/features/auth/useAuthViewModel';
import {
  favoritesKey,
  favoritesRepository,
  useFavoritesQuery,
} from '@/features/point/favoritesRepository';

type RemovedPoint = { point: Favorit };
const UNDO_DURATION = 5_000;

const wait = (duration: number) => new Promise<void>((resolve) => setTimeout(resolve, duration));

/** Llista personal compartida amb el botó de la fitxa del punt. */
export function useFavoritesViewModel() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const reduceMotion = useReducedMotion();
  const { user } = useAuthViewModel();
  const favorites = useFavoritesQuery(user !== null);
  const key = favoritesKey(i18n.resolvedLanguage ?? 'ca');
  const points = useMemo(() => {
    const compare = new Intl.Collator(i18n.resolvedLanguage ?? 'ca', { sensitivity: 'base' });
    return [...(favorites.data ?? [])].sort(
      (a, b) => compare.compare(a.nom, b.nom) || a.id.localeCompare(b.id),
    );
  }, [favorites.data, i18n.resolvedLanguage]);
  const [leavingId, setLeavingId] = useState<string | null>(null);
  const [exitingId, setExitingId] = useState<string | null>(null);
  const [undo, setUndo] = useState<RemovedPoint | null>(null);

  useEffect(() => {
    if (!undo) return;
    const timeout = setTimeout(() => setUndo(null), UNDO_DURATION);
    return () => clearTimeout(timeout);
  }, [undo]);

  const remove = useMutation({
    mutationFn: async ({ point }: RemovedPoint) => {
      await Promise.all([
        favoritesRepository.remove(point.id),
        wait(reduceMotion ? 0 : motion.slow),
      ]);
    },
    onSuccess: async (_result, removed) => {
      setExitingId(removed.point.id);
      await wait(reduceMotion ? 0 : motion.base);
      await queryClient.cancelQueries({ queryKey: key });
      queryClient.setQueryData<Favorit[]>(key, (current) =>
        current?.filter((point) => point.id !== removed.point.id),
      );
      setUndo(removed);
      setLeavingId(null);
      setExitingId(null);
      void queryClient.invalidateQueries({ queryKey: ['favorits'] });
    },
    onError: () => {
      setLeavingId(null);
      setExitingId(null);
    },
  });

  const restore = useMutation({
    mutationFn: ({ point }: RemovedPoint) => favoritesRepository.add(point.id),
    onMutate: async ({ point }: RemovedPoint) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Favorit[]>(key);
      queryClient.setQueryData<Favorit[]>(key, (current) => {
        const next = [...(current ?? [])];
        if (!next.some((item) => item.id === point.id)) next.push(point);
        return next;
      });
      return { previous };
    },
    onError: (_error, removed, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
      setUndo(removed);
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
    points,
    loading: user !== null && favorites.isPending,
    error: favorites.isError ? t('profile.savedPointsError') : null,
    empty: t('profile.savedPointsEmpty'),
    help: t('profile.savedPointsHelp'),
    openHint: t('profile.openSavedPoint'),
    removeLabel: (name: string) => t('profile.removeSavedPoint', { name }),
    removeError: remove.isError ? t('point.favoriteRemoveError') : null,
    undoError: restore.isError ? t('profile.undoSavedPointError') : null,
    leavingId,
    exitingId,
    removing: leavingId !== null,
    removePoint: (id: string) => {
      if (leavingId !== null) return;
      const point = favorites.data?.find((item) => item.id === id);
      if (!point) return;
      remove.reset();
      restore.reset();
      setLeavingId(id);
      remove.mutate({ point });
    },
    undoMessage: undo ? t('profile.savedPointRemoved', { name: undo.point.nom }) : null,
    undoLabel: t('profile.undoSavedPoint'),
    undoPoint: () => {
      if (!undo || restore.isPending) return;
      const removed = undo;
      setUndo(null);
      restore.reset();
      restore.mutate(removed);
    },
    retryLabel: t('profile.retry'),
    retry: () => void favorites.refetch(),
    openPoint: (id: string) => router.push({ pathname: '/punt/[id]', params: { id } }),
  };
}
