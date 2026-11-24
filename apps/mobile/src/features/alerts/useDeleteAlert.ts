import type { Alerta } from '@talaia/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ALERTS_KEY, alertsRepository } from './alertsRepository';

/**
 * Eliminar una alerta (HU20), des de la llista (lliscant la fila) o des d'«Edita l'alerta». Sempre
 * demana confirmació en un full de l'app (`ConfirmationSheet`): no es pot desfer. En acabar,
 * l'alerta surt de la llista a l'instant i la llista es torna a demanar. Si falla, el full es queda
 * obert amb l'error i es pot tornar a provar o cancel·lar.
 */
export function useDeleteAlert(onDeleted?: () => void) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  // L'alerta es queda quan el full es tanca: mentre baixa, el missatge no ha de perdre el nom.
  const [target, setTarget] = useState<{ id: string; name: string } | null>(null);
  const [open, setOpen] = useState(false);

  const remove = useMutation({
    mutationFn: (id: string) => alertsRepository.remove(id),
    onSuccess: (_result, id) => {
      setOpen(false);
      onDeleted?.();
      queryClient.setQueryData<Alerta[]>(ALERTS_KEY, (list) =>
        list?.filter((alert) => alert.id !== id),
      );
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ALERTS_KEY }),
  });

  const close = () => {
    setOpen(false);
    remove.reset();
  };

  return {
    /** Obre la confirmació; només elimina si l'usuari ho confirma al full. */
    confirmDelete: (id: string, name: string) => {
      remove.reset();
      setTarget({ id, name });
      setOpen(true);
    },
    isDeleting: remove.isPending,
    label: t('alerts.delete.action'),
    sheet: {
      visible: open,
      title: remove.isError ? t('alerts.delete.errorTitle') : t('alerts.delete.confirmTitle'),
      message: remove.isError
        ? t('alerts.delete.errorMessage')
        : t('alerts.delete.confirmMessage', { name: target?.name ?? '' }),
      cancelLabel: t('alerts.delete.cancel'),
      confirmLabel: t('alerts.delete.confirm'),
      disabled: remove.isPending,
      onCancel: close,
      onConfirm: () => {
        if (target) remove.mutate(target.id);
      },
    },
  };
}
