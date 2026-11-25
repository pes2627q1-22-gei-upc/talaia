import type { Pla, PlaCanvis } from '@talaia/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking } from 'react-native';

import { useMapPointsQuery } from '@/features/map/mapRepository';

import {
  departureIso,
  isFuture,
  isPlanFinished,
  planChanges,
  planForm,
  planUpdateErrorKey,
  type PointOption,
  sameDeparture,
  searchPoints,
} from './planModel';
import { PLANS_KEY, plansRepository, usePlanQuery } from './plansRepository';
import { type CalendarUpdateResult, usePlanCalendar } from './usePlanCalendar';
import type { PlanFormViewModel } from './useNewPlanViewModel';
import { usePlanCalendarFields, usePlanFormFields } from './usePlanFormFields';

/** L'avís del calendari després de desar els canvis: el pla ja és desat. */
type CalendarNotice = Exclude<CalendarUpdateResult, 'updated' | 'skipped'>;

/**
 * «Edita el pla» (`/pla/[id]`, HU14, TG-161): carrega el pla i, quan el té, el formulari. Des
 * d'«Els meus plans» el pla surt de la memòria cau de la llista, sense esquelet.
 */
export function usePlanLoader(planId: string) {
  const { t } = useTranslation();
  const router = useRouter();
  const query = usePlanQuery(planId);
  // Un cop carregat, el pla es queda: desar-lo el torna a demanar i el formulari no s'ha de refer.
  const [plan, setPlan] = useState<Pla | undefined>(query.data);
  if (!plan && query.data) setPlan(query.data);

  const state = plan
    ? ('ready' as const)
    : query.isPending
      ? ('loading' as const)
      : query.error && 'status' in query.error && query.error.status === 404
        ? ('missing' as const)
        : ('error' as const);

  return {
    state,
    plan,
    title: t('plans.edit.title'),
    back: { label: t('plans.new.back'), onPress: () => router.back() },
    error: {
      title: t('plans.edit.errorTitle'),
      action: { label: t('plans.new.retry'), onPress: () => void query.refetch() },
    },
    missing: {
      title: t('plans.edit.missingTitle'),
      message: t('plans.edit.missingMessage'),
      action: { label: t('plans.new.back'), onPress: () => router.back() },
    },
  };
}

/**
 * El formulari d'un pla desat: els mateixos camps que «Crea un pla» més el punt, que es pot
 * canviar amb un full de cerca. Només s'envien els camps canviats (`planChanges`) i, si el pla és al
 * calendari del mòbil, després s'hi actualitza l'esdeveniment (ADR-0036). Un pla acabat s'obre en
 * mode lectura. Un pla d'un punt retirat s'obre igualment: només es desa triant-ne un altre.
 */
export function useEditPlanViewModel(plan: Pla): PlanFormViewModel {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const calendar = usePlanCalendar();
  const focused = useRef(false);
  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      return () => {
        focused.current = false;
      };
    }, []),
  );

  // El pla desat: canvia després de cada PATCH, i els canvis es calculen respecte a ell.
  const [saved, setSaved] = useState(plan);
  const [initial] = useState(() => planForm(plan));
  const [readOnly] = useState(() => isPlanFinished(plan));
  const [chosenPoint, setChosenPoint] = useState<PointOption | null>(null);
  const [pointQuery, setPointQuery] = useState('');
  const [notice, setNotice] = useState<CalendarNotice | null>(null);
  // L'esdeveniment vinculat no és en aquest mòbil: el pla es pot tornar a afegir al calendari.
  const [eventMissing, setEventMissing] = useState(false);
  const pendingCalendar = useRef<{ previous: Pla; plan: Pla } | null>(null);
  // `isPending` arriba un render tard: el ref atura el doble toc del mateix instant.
  const sending = useRef(false);
  const [busy, setBusy] = useState(false);

  const update = useMutation({
    mutationFn: (changes: PlaCanvis) => plansRepository.update(plan.id, changes),
  });

  const form = usePlanFormFields(
    { departure: initial.departure, esdevenimentId: initial.esdevenimentId, notes: initial.notes },
    () => update.reset(),
  );
  const point = chosenPoint ?? saved.punt;
  const pointRetired = !chosenPoint && !saved.punt.publicat;
  const changes = planChanges(saved, {
    puntId: point.id,
    esdevenimentId: form.esdevenimentId,
    departure: form.departure,
    durationMs: initial.durationMs,
    notes: form.notes,
  });
  const moved = !sameDeparture(saved, form.departure);
  const past = moved && !isFuture(departureIso(form.departure));

  const linked = saved.calendariEventId !== null && !eventMissing;
  const calendarFields = usePlanCalendarFields(calendar, form, busy);
  const wantsCalendar =
    !linked && calendar.enabled && calendar.status === 'ready' && calendar.selectedId !== null;

  const points = useMapPointsQuery(form.sheet === 'point');
  const pointOptions = useMemo(
    () =>
      searchPoints(
        (points.data?.features ?? []).map(({ properties: { id, nom, municipi } }) => ({
          id,
          nom,
          municipi,
        })),
        pointQuery,
      ),
    [points.data, pointQuery],
  );

  const eventTitle = (target: Pla) => {
    const phenomenon = form.chosenEvent?.nom;
    return phenomenon
      ? t('plans.calendar.eventTitleWithPhenomenon', { point: target.punt.nom, phenomenon })
      : t('plans.calendar.eventTitle', { point: target.punt.nom });
  };

  const finish = async () => {
    await queryClient.invalidateQueries({ queryKey: PLANS_KEY });
    if (focused.current) router.back();
  };

  /** Actualitza l'esdeveniment vinculat; si no es pot, el pla ja és desat i es mostra l'avís. */
  const updateCalendar = async (previous: Pla, next: Pla): Promise<boolean> => {
    pendingCalendar.current = { previous, plan: next };
    const result = await calendar.update(previous, next, eventTitle(next));
    if (result === 'updated' || result === 'skipped') {
      pendingCalendar.current = null;
      return true;
    }
    if (result === 'missing') setEventMissing(true);
    setNotice(result);
    return false;
  };

  const run = async (task: () => Promise<void>) => {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    try {
      await task();
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };

  const save = () =>
    void run(async () => {
      if (readOnly || pointRetired || calendarFields.blocking) return;
      if (!changes && !wantsCalendar) return;
      // L'hora pot haver passat amb la pantalla oberta: es torna a mirar en el moment d'enviar.
      if (moved && !isFuture(departureIso(form.departure))) {
        form.setPastError(true);
        return;
      }
      setNotice(null);
      let current = saved;
      if (changes) {
        try {
          current = await update.mutateAsync(changes);
        } catch {
          return; // L'error el pinta `update.error`.
        }
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setSaved(current);
        setChosenPoint(null);
        await queryClient.invalidateQueries({ queryKey: PLANS_KEY });
      }
      if (wantsCalendar && calendar.selectedId) {
        // Sense cap altre canvi, només es crea l'esdeveniment i es vincula (sense PATCH).
        if (await calendar.sync(current, eventTitle(current), calendar.selectedId)) await finish();
        return;
      }
      if (changes && linked && !(await updateCalendar(saved, current))) return;
      await finish();
    });

  const retryCalendar = () =>
    void run(async () => {
      const pending = pendingCalendar.current;
      if (!pending) return;
      setNotice(null);
      if (await updateCalendar(pending.previous, pending.plan)) await finish();
    });

  const errorKey = update.isError ? planUpdateErrorKey(update.error) : null;
  const noticeMessage = notice ? t(`plans.edit.calendarNotice.${notice}`) : null;
  const syncError =
    !linked && calendar.error ? t(`plans.calendar.syncErrors.${calendar.error}`) : null;
  const working = busy || update.isPending || calendar.syncing;

  return {
    header: t('plans.edit.header'),
    title: readOnly ? t('plans.edit.readOnlyTitle') : t('plans.edit.title'),
    back: { label: t('plans.new.back'), onPress: () => router.back() },
    busy: working,
    readOnly,
    readOnlyMessage: readOnly ? t('plans.edit.readOnly') : null,
    saved: null,
    point: {
      label: t('plans.new.point'),
      loading: false,
      name: point.nom,
      accessibilityLabel: t(readOnly ? 'plans.new.pointA11y' : 'plans.edit.pointA11y', {
        name: point.nom,
        municipality: point.municipi,
      }),
      onPress: readOnly ? undefined : () => form.setSheet('point'),
      error: pointRetired ? t('plans.edit.pointRetired') : null,
      link:
        pointRetired || !point.id
          ? null
          : {
              label: t('plans.edit.viewPoint'),
              onPress: () => router.push({ pathname: '/punt/[id]', params: { id: point.id } }),
            },
    },
    day: form.day,
    time: form.time,
    pastMessage: form.pastError || past ? t('plans.new.past') : undefined,
    event: form.event,
    notes: form.notesField,
    calendar: readOnly
      ? null
      : linked
        ? {
            ...calendarFields.calendar,
            linkedHint: t(
              calendar.supported ? 'plans.edit.calendarLinked' : 'plans.edit.calendarUnavailable',
            ),
          }
        : calendarFields.calendar,
    calendarNotice: noticeMessage
      ? {
          message: noticeMessage,
          action:
            notice === 'missing'
              ? {
                  label: t('plans.edit.addToCalendar'),
                  onPress: () => {
                    setNotice(null);
                    calendar.toggle(true);
                  },
                }
              : notice === 'denied' && !calendar.canAskAgain
                ? {
                    label: t('plans.calendar.settings'),
                    onPress: () => void Linking.openSettings(),
                  }
                : { label: t('plans.new.retry'), onPress: retryCalendar },
          finish: { label: t('plans.calendar.continue'), onPress: () => void finish() },
        }
      : syncError
        ? {
            message: syncError,
            action: null,
            finish: { label: t('plans.calendar.continue'), onPress: () => void finish() },
          }
        : null,
    save: readOnly
      ? null
      : {
          label: working
            ? t('plans.new.saving')
            : !changes && wantsCalendar
              ? t('plans.edit.addToCalendar')
              : t('plans.edit.save'),
          disabled:
            working ||
            past ||
            pointRetired ||
            calendarFields.blocking ||
            notice !== null ||
            (!changes && !wantsCalendar),
          onPress: save,
        },
    error: errorKey ? t(`plans.edit.errors.${errorKey}`) : undefined,
    calendarSheet: calendarFields.calendarSheet,
    dateSheet: form.dateSheet,
    timeSheet: form.timeSheet,
    eventSheet: form.eventSheet,
    pointSheet: {
      visible: form.sheet === 'point',
      title: t('plans.edit.pointSheet'),
      closeLabel: t('plans.new.close'),
      onClose: () => form.setSheet(null),
      search: {
        label: t('plans.edit.pointSearch'),
        value: pointQuery,
        onChange: setPointQuery,
      },
      status: (points.isPending ? 'loading' : points.isError ? 'error' : 'ok') as
        'loading' | 'error' | 'ok',
      errorMessage: t('plans.edit.pointsError'),
      retryLabel: t('plans.new.retry'),
      retry: () => void points.refetch(),
      emptyMessage: t('plans.edit.noPoints'),
      options: pointOptions.map((option) => ({
        id: option.id,
        label: option.nom,
        hint: option.municipi,
        selected: option.id === point.id,
        onPress: () => {
          setChosenPoint(option.id === saved.punt.id && saved.punt.publicat ? null : option);
          update.reset();
          form.setSheet(null);
        },
      })),
    },
  };
}
