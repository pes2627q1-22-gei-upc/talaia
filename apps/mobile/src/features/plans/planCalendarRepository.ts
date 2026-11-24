import { isRunningInExpoGo, requireOptionalNativeModule } from 'expo';
import type * as CalendarModule from 'expo-calendar';
import { Platform } from 'react-native';

import type { Pla } from '@talaia/shared';

import { isPlanEvent, type PlanCalendarEvent } from './planCalendarModel';

export type DeviceCalendar = { id: string; title: string; account: string };
export type CalendarAccess =
  | { status: 'ready'; calendars: DeviceCalendar[] }
  | { status: 'denied'; canAskAgain: boolean }
  | { status: 'unavailable' };

export class CalendarPermissionError extends Error {
  constructor(public readonly canAskAgain: boolean) {
    super('calendar_permission_denied');
  }
}

let calendarModule: typeof CalendarModule | null = null;

function calendar(): typeof CalendarModule {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- Expo Go no porta CalendarNext (SDK 58).
  calendarModule ??= require('expo-calendar') as typeof CalendarModule;
  return calendarModule;
}

async function permission() {
  const current = await calendar().getCalendarPermissions();
  return !current.granted && current.canAskAgain
    ? calendar().requestCalendarPermissions()
    : current;
}

/** Només llegeix metadades dels calendaris i crea esdeveniments; no llegeix esdeveniments personals. */
export const planCalendarRepository = {
  isSupported(): boolean {
    return (
      (Platform.OS === 'ios' || Platform.OS === 'android') &&
      !isRunningInExpoGo() &&
      requireOptionalNativeModule('CalendarNext') !== null
    );
  },

  async requestCalendars(): Promise<CalendarAccess> {
    if (!planCalendarRepository.isSupported()) return { status: 'unavailable' };
    const access = await permission();
    if (!access.granted) return { status: 'denied', canAskAgain: access.canAskAgain };
    const calendars = await calendar().getCalendars(calendar().EntityTypes.EVENT);
    return {
      status: 'ready',
      calendars: calendars
        .filter((item) => item.allowsModifications)
        .map((item) => ({
          id: item.id,
          title: item.title,
          account: item.source?.name || item.ownerAccount || '',
        })),
    };
  },

  async createEvent(calendarId: string, event: PlanCalendarEvent): Promise<string> {
    if (!planCalendarRepository.isSupported()) throw new Error('calendar_unavailable');
    const access = await permission();
    if (!access.granted) throw new CalendarPermissionError(access.canAskAgain);
    const target = await calendar().ExpoCalendar.get(calendarId);
    if (!target.allowsModifications) throw new Error('calendar_read_only');
    return (await target.createEvent(event)).id;
  },

  /**
   * Esborra l'esdeveniment del pla (TG-162) si encara és el que l'app va crear (`isPlanEvent`). No
   * demana permís: si no n'hi ha, o l'esdeveniment ja no hi és, no fa res i torna `false`.
   */
  async deleteEvent(plan: Pla): Promise<boolean> {
    if (!plan.calendariEventId || !planCalendarRepository.isSupported()) return false;
    if (!(await calendar().getCalendarPermissions()).granted) return false;
    let event: CalendarModule.ExpoCalendarEvent;
    try {
      event = await calendar().ExpoCalendarEvent.get(plan.calendariEventId);
    } catch {
      return false;
    }
    if (!isPlanEvent(event, plan)) return false;
    await event.delete();
    return true;
  },
};
