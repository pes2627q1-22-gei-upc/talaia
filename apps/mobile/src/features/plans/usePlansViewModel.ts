import type { QuanPlans } from '@talaia/shared';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { planEventsRange, planRow, type PlanRow } from './planModel';
import { useEventsBetweenQuery, usePlansQuery } from './plansRepository';

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

  return { state, rows, retry: () => void plans.refetch() };
}

/**
 * «Els meus plans» (HU13, mockup 13): els plans futurs per data i, a part, els passats, que es
 * demanen quan l'usuari obre la pestanya. Tocar un pla obre la fitxa del punt; si el punt s'ha
 * retirat, la fila no es pot obrir. L'índex de cada pla i «Veure'ls al calendari» (TG-158) no hi
 * són: l'API no dona l'índex d'un pla.
 */
export function usePlansViewModel() {
  const { t } = useTranslation();
  const router = useRouter();
  const [tab, setTab] = useState<QuanPlans>('futurs');
  // Un cop oberts, els passats es queden carregats encara que es torni a «Propers».
  const [pastRequested, setPastRequested] = useState(false);

  const upcoming = usePlansSection('futurs', true);
  const past = usePlansSection('passats', pastRequested || tab === 'passats');

  const months = t('plans.list.months', { returnObjects: true }) as string[];
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
      accessibilityHint: row.retired ? undefined : t('plans.list.openHint'),
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

  return {
    title: t('plans.list.title'),
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
    /** Obre la fitxa del punt del pla; un punt retirat ja no en té. */
    onOpen: (row: Pick<PlanListRow, 'id'>) => {
      const plan = rowsById.get(row.id);
      if (!plan || plan.retired) return;
      router.push({ pathname: '/punt/[id]', params: { id: plan.puntId } });
    },
    /** Sense plans: a Explora, on es busca el lloc i, des de la fitxa, es crea el pla. */
    create: { label: t('plans.list.create'), onPress: () => router.navigate('/') },
  };
}
