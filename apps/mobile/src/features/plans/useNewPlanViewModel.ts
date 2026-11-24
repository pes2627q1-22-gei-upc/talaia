import type { Pla } from '@talaia/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking } from 'react-native';

import { usePointDetailQuery } from '@/features/point/pointRepository';

import {
  buildNewPlan,
  departureIso,
  initialDeparture,
  initialDuration,
  isFuture,
  planErrorKey,
} from './planModel';
import { PLANS_KEY, plansRepository } from './plansRepository';
import { usePlanCalendar } from './usePlanCalendar';
import {
  type Action,
  type PointSheetProps,
  usePlanCalendarFields,
  usePlanFormFields,
} from './usePlanFormFields';

/** Paràmetres de la ruta `/pla/nou`: el punt, i el que la fitxa o un fenomen ja proposen. */
export type NewPlanParams = {
  puntId: string;
  /** Inici de la millor franja de la nit (ISO), per proposar l'hora de sortida. */
  inici?: string;
  /** Final de la millor franja (ISO): el pla en conserva la durada encara que es mogui la sortida. */
  fi?: string;
  /** Fenomen ja triat (el `id` de `/esdeveniments`). */
  esdevenimentId?: string;
};

/** «Pla d'observació» (HU12, mockup 06): punt, dia, hora de sortida, fenomen i notes. */
export function useNewPlanViewModel({ puntId, inici, fi, esdevenimentId }: NewPlanParams) {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const point = usePointDetailQuery(puntId);
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
  const [savedPlan, setSavedPlan] = useState<Pla | null>(null);
  const calendarRequest = useRef<{ calendarId: string; eventName: string | null } | null>(null);

  // `isPending` arriba un render tard: el ref atura el doble toc del mateix instant.
  const sending = useRef(false);
  const create = useMutation({
    mutationFn: plansRepository.create,
    onSuccess: async (plan) => {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await queryClient.invalidateQueries({ queryKey: PLANS_KEY });
      if (!focused.current) return;
      if (calendarRequest.current) {
        setSavedPlan(plan);
        await syncCalendar(plan);
      } else {
        if (focused.current) router.back();
      }
    },
    onSettled: () => {
      sending.current = false;
    },
  });

  const form = usePlanFormFields(
    {
      departure: initialDeparture(inici),
      esdevenimentId: esdevenimentId ?? null,
      notes: '',
    },
    () => create.reset(),
  );
  const { departure, chosenEvent, notes } = form;
  // Es calcula un sol cop, amb la sortida inicial: després, el final segueix la sortida.
  const [durationMs] = useState(() => initialDuration(departure, inici, fi));

  const finish = async () => {
    await queryClient.invalidateQueries({ queryKey: PLANS_KEY });
    if (focused.current) router.back();
  };

  const syncCalendar = async (plan: Pla) => {
    const request = calendarRequest.current;
    if (!request) return;
    const title = request.eventName
      ? t('plans.calendar.eventTitleWithPhenomenon', {
          point: plan.punt.nom,
          phenomenon: request.eventName,
        })
      : t('plans.calendar.eventTitle', { point: plan.punt.nom });
    if (await calendar.sync(plan, title, request.calendarId)) await finish();
  };

  const iso = departureIso(departure);
  const past = !isFuture(iso);

  const save = () => {
    if (sending.current || create.isPending || savedPlan) return;
    if (calendarFields.blocking) return;
    // L'hora pot haver passat amb la pantalla oberta: es torna a mirar en el moment d'enviar.
    if (!isFuture(departureIso(departure))) {
      form.setPastError(true);
      return;
    }
    sending.current = true;
    calendarRequest.current =
      calendar.enabled && calendar.selectedId
        ? { calendarId: calendar.selectedId, eventName: chosenEvent?.nom ?? null }
        : null;
    create.mutate(
      buildNewPlan({
        puntId,
        esdevenimentId: chosenEvent?.id ?? null,
        departure,
        durationMs,
        notes,
      }),
    );
  };

  const errorKey = create.isError ? planErrorKey(create.error) : null;
  const pointData = point.data;
  const calendarFields = usePlanCalendarFields(calendar, form, create.isPending);

  return {
    header: t('plans.new.header'),
    title: t('plans.new.title'),
    back: { label: t('plans.new.back'), onPress: () => router.back() },
    busy: create.isPending || calendar.syncing,
    readOnly: false as boolean,
    readOnlyMessage: null as string | null,
    saved: savedPlan
      ? {
          title: t('plans.calendar.savedTitle'),
          message: calendar.error
            ? t(`plans.calendar.syncErrors.${calendar.error}`)
            : t('plans.calendar.adding'),
          busy: calendar.syncing || calendar.synced || create.isPending,
          retry: { label: t('plans.new.retry'), onPress: () => void syncCalendar(savedPlan) },
          settings:
            calendar.error === 'denied' && !calendar.canAskAgain
              ? { label: t('plans.calendar.settings'), onPress: () => void Linking.openSettings() }
              : null,
          finish: { label: t('plans.calendar.continue'), onPress: () => void finish() },
        }
      : null,
    point: {
      label: t('plans.new.point'),
      loading: !pointData && point.isPending,
      name: pointData?.nom ?? (point.isError ? t('plans.new.pointUnavailable') : ''),
      accessibilityLabel: pointData
        ? t('plans.new.pointA11y', { name: pointData.nom, municipality: pointData.municipi })
        : t('plans.new.point'),
      /** A l'edició (TG-161), el punt es pot canviar, pot estar retirat i porta a la fitxa. */
      onPress: undefined as (() => void) | undefined,
      error: null as string | null,
      link: null as Action | null,
    },
    day: form.day,
    time: form.time,
    pastMessage: form.pastError || past ? t('plans.new.past') : undefined,
    event: form.event,
    notes: form.notesField,
    calendar: calendarFields.calendar,
    /** L'avís de calendari de l'edició, amb el pla ja desat (TG-161). */
    calendarNotice: null as {
      message: string;
      action: Action | null;
      finish: Action;
    } | null,
    save: {
      label: create.isPending ? t('plans.new.saving') : t('plans.new.save'),
      disabled: create.isPending || past || !puntId.trim() || calendarFields.blocking,
      onPress: save,
    },
    error: errorKey ? t(`plans.new.errors.${errorKey}`) : undefined,
    calendarSheet: calendarFields.calendarSheet,
    dateSheet: form.dateSheet,
    timeSheet: form.timeSheet,
    eventSheet: form.eventSheet,
    pointSheet: null as PointSheetProps | null,
  };
}

type NewPlanViewModel = ReturnType<typeof useNewPlanViewModel>;

/**
 * El que pinta la pantalla del formulari d'un pla, nou (TG-157) o desat (TG-161). En mode lectura
 * (un pla acabat), l'edició no té ni calendari ni «Desa».
 */
export type PlanFormViewModel = Omit<NewPlanViewModel, 'calendar' | 'save'> & {
  calendar: NewPlanViewModel['calendar'] | null;
  save: NewPlanViewModel['save'] | null;
};
