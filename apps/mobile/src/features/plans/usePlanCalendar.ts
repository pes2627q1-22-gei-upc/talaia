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

  return {
    supported,
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
