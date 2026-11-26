import type { Pla, QuanPlans } from '@talaia/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ApiError } from '@/core/api/httpClient';

import { planCalendarRepository } from './planCalendarRepository';
import { planEventsRange, planRow, type PlanRow } from './planModel';
import {
  PLANS_KEY,
  plansRepository,
  useEventsBetweenQuery,
  usePlansQuery,
} from './plansRepository';

export type PlansSectionState = 'loading' | 'error' | 'empty' | 'ready';

/** Una fila amb els textos ja traduïts, a punt per pintar. */
export type PlanListRow = {
  id: string;
  day: string;
  month: string;
  title: string;
  subtitle: string;
  retired: boolean;
  accessibilityLabel: string;
  accessibilityHint?: string;
  deleteLabel: string;
};

export type PlansSection = {
  state: PlansSectionState;
  rows: PlanListRow[];
  retry: () => void;
  empty: { title: string; message: string };
};

/** Una llista (futurs o passats): els plans i, si n'hi ha, els noms dels seus fenòmens. */
function usePlansSection(quan: QuanPlans, enabled: boolean) {
  const plans = usePlansQuery(quan, enabled);
  const range = useMemo(() => (plans.data ? planEventsRange(plans.data) : null), [plans.data]);
  const events = useEventsBetweenQuery(range);

  const rows = useMemo(() => {
    const names = new Map((events.data?.data ?? []).map((event) => [event.id, event.nom]));
    return (plans.data ?? []).map((plan) => planRow(plan, names));
  }, [plans.data, events.data]);

  // Mentre arriben els noms dels fenòmens, esquelets: així el títol no salta de «Cel estrellat»
  // a «Oriònides». Si `/esdeveniments` falla, la llista surt igualment, sense els noms.
  const state: PlansSectionState = plans.isPending
    ? 'loading'
    : plans.isError
      ? 'error'
      : rows.length === 0
        ? 'empty'
        : range !== null && events.isPending
          ? 'loading'
          : 'ready';

  return { state, rows, plans: plans.data ?? [], retry: () => void plans.refetch() };
}

/**
 * «Els meus plans» (HU13, mockup 13): els plans futurs per data i, a part, els passats, que es
 * demanen quan l'usuari obre la pestanya. Tocar un pla l'obre per editar-lo (`/pla/[id]`, TG-161),
 * també si el punt s'ha retirat: és l'única manera de triar-ne un altre. L'índex de cada pla i
 * «Veure'ls al calendari» (TG-158) no hi són: l'API no dona l'índex d'un pla. Qualsevol pla, també
 * un de passat o d'un punt retirat, es pot eliminar amb confirmació (HU15, TG-162).
 */
export function usePlansViewModel() {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteFailed, setDeleteFailed] = useState(false);
  // El pla ja s'ha esborrat a l'API, però el seu esdeveniment s'ha quedat al calendari del mòbil.
  const [eventLeft, setEventLeft] = useState<Pla | null>(null);
  const [tab, setTab] = useState<QuanPlans>('futurs');
  // Un cop oberts, els passats es queden carregats encara que es torni a «Propers».
  const [pastRequested, setPastRequested] = useState(false);

  const upcoming = usePlansSection('futurs', true);
  const past = usePlansSection('passats', pastRequested || tab === 'passats');

  // Les abreviatures normatives del Calendari («febr.», «març»); la vista les posa en majúscules.
  const months = t('explore.calendar.monthsShort', { returnObjects: true }) as string[];
  const monthsOf = t('explore.calendar.monthsOf', { returnObjects: true }) as string[];

  const toListRow = (row: PlanRow): PlanListRow => {
    const title = t('plans.list.rowTitle', {
      phenomenon: row.phenomenon ?? t('plans.list.starrySky'),
      place: row.place.name,
      context: row.place.article ?? undefined,
    });
    const subtitle = row.retired
      ? t('plans.list.retired')
      : t('plans.list.departure', {
          time: row.time,
          point: row.pointName,
          context: row.hour === 1 ? 'single' : undefined,
        });
    return {
      id: row.id,
      day: row.day,
      month: months[row.month] ?? '',
      title,
      subtitle,
      retired: row.retired,
      accessibilityLabel: t('plans.list.a11y', {
        title,
        day: Number(row.day),
        month: monthsOf[row.month] ?? '',
        subtitle,
      }),
      accessibilityHint: t('plans.list.openHint'),
      deleteLabel: t('plans.delete.button', { title }),
    };
  };

  const section = (
    data: ReturnType<typeof usePlansSection>,
    empty: PlansSection['empty'],
  ): PlansSection => ({
    state: data.state,
    rows: data.state === 'ready' ? data.rows.map(toListRow) : [],
    retry: data.retry,
    empty,
  });

  const rowsById = new Map([...upcoming.rows, ...past.rows].map((row) => [row.id, row]));
  const pendingPlan = [...upcoming.plans, ...past.plans].find((plan) => plan.id === deleteId);
  const pendingRow = deleteId ? rowsById.get(deleteId) : undefined;

  /** `false` si esborrar l'esdeveniment ha fallat; no trobar-lo o no ser el del pla no és un error. */
  const removeEvent = (plan: Pla) =>
    planCalendarRepository.deleteEvent(plan).then(
      () => true,
      () => false,
    );

  /**
   * Primer l'API i, si va bé, l'esdeveniment del calendari del mòbil: si l'API falla, el pla
   * continua existint i l'esdeveniment s'ha de quedar. Un 404 vol dir que ja no hi era (esborrat
   * des d'un altre mòbil): compta com a fet. Si el calendari falla, el pla ja està esborrat, i el
   * full ho diu i deixa tornar-ho a provar (HU15: també s'ha d'eliminar del calendari).
   */
  const confirmDelete = async () => {
    if (!pendingPlan || deleting) return;
    setDeleting(true);
    setDeleteFailed(false);
    try {
      await plansRepository.remove(pendingPlan.id);
    } catch (error) {
      if (!(error instanceof ApiError && error.status === 404)) {
        setDeleteFailed(true);
        setDeleting(false);
        return;
      }
    }
    setEventLeft((await removeEvent(pendingPlan)) ? null : pendingPlan);
    setDeleteId(null);
    setDeleting(false);
    await queryClient.invalidateQueries({ queryKey: PLANS_KEY });
  };

  /** Torna a provar d'esborrar l'esdeveniment d'un pla ja eliminat. */
  const retryEvent = async () => {
    if (!eventLeft || deleting) return;
    setDeleting(true);
    if (await removeEvent(eventLeft)) setEventLeft(null);
    setDeleting(false);
  };

  return {
    title: t('plans.list.title'),
    back: { label: t('plans.list.back'), onPress: () => router.back() },
    tab,
    tabs: (['futurs', 'passats'] as const).map((key) => ({
      key,
      label: t(key === 'futurs' ? 'plans.list.upcoming' : 'plans.list.past'),
      selected: key === tab,
      onSelect: () => {
        if (key === 'passats') setPastRequested(true);
        setTab(key);
      },
    })),
    upcoming: section(upcoming, {
      title: t('plans.list.emptyUpcomingTitle'),
      message: t('plans.list.emptyUpcomingMessage'),
    }),
    past: section(past, {
      title: t('plans.list.emptyPastTitle'),
      message: t('plans.list.emptyPastMessage'),
    }),
    error: { title: t('plans.list.errorTitle'), retryLabel: t('plans.list.retry') },
    /** Obre el pla per editar-lo (TG-161); des d'allà, «Veure el punt» porta a la fitxa. */
    onOpen: (row: Pick<PlanListRow, 'id'>) => {
      if (!rowsById.has(row.id)) return;
      router.push({ pathname: '/pla/[id]', params: { id: row.id } });
    },
    onDelete: (row: Pick<PlanListRow, 'id'>) => {
      setDeleteFailed(false);
      setDeleteId(row.id);
    },
    deletion: eventLeft
      ? {
          visible: true,
          title: t('plans.delete.eventLeftTitle'),
          message: t('plans.delete.eventLeftMessage'),
          cancelLabel: t('plans.delete.close'),
          confirmLabel: t('plans.delete.retry'),
          disabled: deleting,
          onCancel: () => {
            if (!deleting) setEventLeft(null);
          },
          onConfirm: () => void retryEvent(),
        }
      : {
          visible: pendingPlan !== undefined,
          title: t('plans.delete.title'),
          message: deleteFailed
            ? t('plans.delete.error')
            : t(
                pendingPlan?.calendariEventId
                  ? 'plans.delete.messageCalendar'
                  : 'plans.delete.message',
                {
                  title: pendingRow ? toListRow(pendingRow).title : '',
                },
              ),
          cancelLabel: t('plans.delete.cancel'),
          confirmLabel: t('plans.delete.confirm'),
          disabled: deleting,
          onCancel: () => {
            if (!deleting) setDeleteId(null);
          },
          onConfirm: () => void confirmDelete(),
        },
    /** Sense plans: a Explora, on es busca el lloc i, des de la fitxa, es crea el pla. */
    create: { label: t('plans.list.create'), onPress: () => router.navigate('/') },
  };
}
