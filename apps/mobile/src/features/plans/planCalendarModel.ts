import { defaultNight, nightWindow } from '@talaia/shared';
import type { Pla } from '@talaia/shared';

export type PlanCalendarEvent = {
  title: string;
  location: string;
  startDate: string;
  endDate: string;
  notes: string;
  timeZone: string;
};

/** Sense final explícit, el pla dura fins al final de la nit, igual que a l’API de plans. */
export function planCalendarEvent(plan: Pla, title: string): PlanCalendarEvent {
  return {
    title,
    location: [plan.punt.nom, plan.punt.municipi].filter(Boolean).join(', '),
    startDate: plan.dataHoraInici,
    endDate:
      plan.dataHoraFi ?? nightWindow(defaultNight(new Date(plan.dataHoraInici))).to.toISOString(),
    notes: plan.notes ?? '',
    timeZone: 'Europe/Madrid',
  };
}
