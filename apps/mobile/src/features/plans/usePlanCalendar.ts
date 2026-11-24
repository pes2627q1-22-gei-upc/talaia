import type { Pla } from '@talaia/shared';
import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { planCalendarEvent } from './planCalendarModel';
import {
  CalendarPermissionError,
  type DeviceCalendar,
  planCalendarRepository,
} from './planCalendarRepository';
import { plansRepository } from './plansRepository';

type SetupStatus = 'idle' | 'loading' | 'ready' | 'denied' | 'error' | 'unavailable';

/**
 * Resultat d'actualitzar l'esdeveniment d'un pla editat (TG-161): `skipped` si el pla no en té o
 * el mòbil no té calendari (Expo Go); `missing` si no és en aquest mòbil; `denied` sense permís;
 * `failed` si el calendari ha fallat. En tots els casos el pla ja està desat.
 */
export type CalendarUpdateResult = 'updated' | 'skipped' | 'missing' | 'denied' | 'failed';

/** Permís només amb una acció explícita; reintents del vincle sense tornar a crear l’esdeveniment. */
export function usePlanCalendar() {
  const supported = planCalendarRepository.isSupported();
  const [enabled, setEnabled] = useState(false);
  const [status, setStatus] = useState<SetupStatus>('idle');
  const [calendars, setCalendars] = useState<DeviceCalendar[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [canAskAgain, setCanAskAgain] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [synced, setSynced] = useState(false);
  const [error, setError] = useState<'create' | 'link' | 'denied' | null>(null);
  const enabledRef = useRef(false);
  const generation = useRef(0);
  const syncingRef = useRef(false);
  // Conservat fins que es desa a l’API: un PUT fallit no ha de crear un altre esdeveniment.
  const created = useRef<{ planId: string; eventId: string } | null>(null);

  const setup = async () => {
    const attempt = ++generation.current;
    setStatus('loading');
    try {
      const access = await planCalendarRepository.requestCalendars();
      if (attempt !== generation.current) return;
      setStatus(access.status);
      if (access.status === 'ready') {
        setCalendars(access.calendars);
        setSelectedId((current) =>
          access.calendars.some((item) => item.id === current)
            ? current
            : (access.calendars[0]?.id ?? null),
        );
      } else if (access.status === 'denied') {
        setCanAskAgain(access.canAskAgain);
        setSelectedId(null);
      }
    } catch {
      if (attempt === generation.current) setStatus('error');
    }
  };

  const toggle = (value: boolean) => {
    enabledRef.current = value;
    setEnabled(value);
    if (value) void setup();
    else generation.current++;
  };

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && enabledRef.current) void setup();
    });
    return () => subscription.remove();
  }, []);

  const sync = async (plan: Pla, title: string, calendarId: string): Promise<boolean> => {
    if (syncingRef.current) return false;
    syncingRef.current = true;
    setSyncing(true);
    setSynced(false);
    setError(null);
    let stage: 'create' | 'link' = 'create';
    try {
      if (created.current?.planId !== plan.id) {
        const eventId = await planCalendarRepository.createEvent(
          calendarId,
          planCalendarEvent(plan, title),
        );
        created.current = { planId: plan.id, eventId };
      }
      stage = 'link';
      await plansRepository.linkCalendar(plan.id, { calendariEventId: created.current.eventId });
      setSynced(true);
      return true;
    } catch (cause) {
      if (cause instanceof CalendarPermissionError) {
        setCanAskAgain(cause.canAskAgain);
        setError('denied');
      } else {
        setError(stage);
      }
      return false;
    } finally {
      syncingRef.current = false;
      setSyncing(false);
    }
  };

  /**
   * Després de desar els canvis d'un pla, posa al dia el seu esdeveniment del calendari: el busca
   * amb el pla d'abans (`previous`, que és el que hi ha al calendari) i hi escriu el nou (`plan`).
   */
  const update = async (previous: Pla, plan: Pla, title: string): Promise<CalendarUpdateResult> => {
    const eventId = previous.calendariEventId;
    if (!eventId || !supported) return 'skipped';
    if (syncingRef.current) return 'failed';
    syncingRef.current = true;
    setSyncing(true);
    try {
      if (!(await planCalendarRepository.eventExists(previous))) return 'missing';
      await planCalendarRepository.updateEvent(eventId, planCalendarEvent(plan, title));
      return 'updated';
    } catch (cause) {
      if (cause instanceof CalendarPermissionError) {
        setCanAskAgain(cause.canAskAgain);
        return 'denied';
      }
      return 'failed';
    } finally {
      syncingRef.current = false;
      setSyncing(false);
    }
  };

  return {
    supported,
    update,
    enabled,
    toggle,
    status,
    calendars,
    selectedId,
    select: setSelectedId,
    canAskAgain,
    setup,
    sync,
    syncing,
    synced,
    error,
  };
}
