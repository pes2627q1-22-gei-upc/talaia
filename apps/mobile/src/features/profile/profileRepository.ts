import type { Perfil, PerfilCanvis } from '@talaia/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiDelete, apiGet, apiPatch } from '@/core/api/httpClient';

export const profileKey = (userId: string) => ['perfil', userId] as const;

export function useProfileQuery(userId?: string) {
  return useQuery({
    queryKey: profileKey(userId ?? ''),
    queryFn: ({ signal }) => apiGet<Perfil>('/perfil', undefined, { signal }),
    enabled: !!userId,
    staleTime: 60_000,
  });
}

export function useUpdateProfileName(userId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (nom: string) => apiPatch<Perfil>('/perfil', { nom } satisfies PerfilCanvis),
    onSuccess: (profile) => queryClient.setQueryData(profileKey(userId ?? ''), profile),
  });
}

export function deleteAccount(): Promise<void> {
  return apiDelete('/perfil');
}
