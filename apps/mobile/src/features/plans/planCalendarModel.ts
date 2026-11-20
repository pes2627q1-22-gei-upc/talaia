import type { Pla } from '@talaia/shared';

/** Durada predeterminada d'una sessió quan el pla no en defineix cap. */
const DEFAULT_EVENT_DURATION_MS = 2 * 60 * 60 * 1000;

export type PlanCalendarEvent = {
  title: string;
  location: string;
  startDate: string;
  endDate: string;
  notes: string;
  timeZone: string;
};

/** Sense final explícit, el calendari mostra una sessió de dues hores. */
export function planCalendarEvent(plan: Pla, title: string): PlanCalendarEvent {
  const startDate = Date.parse(plan.dataHoraInici);
  return {
    title,
    location: [plan.punt.nom, plan.punt.municipi].filter(Boolean).join(', '),
    startDate: plan.dataHoraInici,
    endDate: plan.dataHoraFi ?? new Date(startDate + DEFAULT_EVENT_DURATION_MS).toISOString(),
    notes: plan.notes ?? '',
    timeZone: 'Europe/Madrid',
  };
}
